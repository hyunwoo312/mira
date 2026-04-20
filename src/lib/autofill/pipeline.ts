import type {
  FillResult,
  FieldResult,
  ScanResult,
  FillOutcome,
  FillerOptions,
  WidgetType,
} from './types';
import type { MLMatchAnswersResponse } from '@/lib/ml/types';
import type { AnswerEntry } from '@/lib/schema';
import { scanPage, detectATS } from './scanners/index';
import { classifyFields } from './classify/index';
import { fillField as fillFieldByWidget } from './fillers/index';

import { sleep } from './fillers/shared';

const FILL_DELAY_MS = 200; // Delay between field fills to allow JS framework processing
const REACT_SETTLE_MS = 500; // Wait for React to re-render after fills before rescan
const RESCAN_DEBOUNCE_MS = 150; // Debounce MutationObserver events before processing
const RESCAN_INITIAL_WAIT_MS = 500; // Initial wait for late-appearing fields
const RESCAN_SETTLE_MS = 300; // Settle time: no mutations for this long = done
const RESCAN_MAX_WAIT_MS = 3000; // Max time to watch for late fields (includes ML inference time)

//  Answer Bank

async function matchAnswerBank(
  fieldLabels: string[],
  answerBank: AnswerEntry[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (fieldLabels.length === 0 || answerBank.length === 0) return result;

  const questions = answerBank.map((a) => a.question).filter(Boolean);
  if (questions.length === 0) return result;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

  const unmatchedLabels: string[] = [];
  for (const label of fieldLabels) {
    const labelNorm = norm(label);
    let matched = false;
    for (let i = 0; i < answerBank.length; i++) {
      const qNorm = norm(answerBank[i]!.question);
      if (!qNorm) continue;
      if (labelNorm === qNorm || labelNorm.includes(qNorm) || qNorm.includes(labelNorm)) {
        const answer = answerBank[i]!.answer;
        if (answer) {
          result.set(label, answer);
          matched = true;
          break;
        }
      }
    }
    if (!matched) unmatchedLabels.push(label);
  }

  if (unmatchedLabels.length > 0) {
    try {
      const response: MLMatchAnswersResponse = await chrome.runtime.sendMessage({
        type: 'ML_MATCH_ANSWERS',
        fieldLabels: unmatchedLabels,
        questions,
      });
      if (response?.matches) {
        for (const match of response.matches) {
          const answer = answerBank[match.questionIndex]?.answer;
          if (answer) result.set(match.fieldLabel, answer);
        }
      }
    } catch {
      /* ML not available */
    }
  }

  return result;
}

//  Fill Helpers

function isFileBlob(value: string): boolean {
  return value.startsWith('{') && value.includes('"data":');
}

async function fillField(
  field: ScanResult,
  value: string,
  fillMap: Record<string, string>,
): Promise<FillOutcome> {
  if (field.widgetType !== 'file-upload' && isFileBlob(value))
    return { status: 'skipped', reason: 'file-on-text' };

  const opts: FillerOptions = {
    ats: field.ats,
    category: field.category ?? undefined,
    userLocation: fillMap['location'],
    description: field.description,
  };

  return fillFieldByWidget(field, value, opts);
}

function fileLogValue(value: string): string {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { name?: unknown }).name === 'string'
    ) {
      return (parsed as { name: string }).name;
    }
  } catch {
    /* fall through to default */
  }
  return 'file';
}

function readActualValue(field: ScanResult): string {
  const el = field.element;
  const wt = field.widgetType;

  if (wt === 'workday-dropdown') {
    const btn = el instanceof HTMLButtonElement ? el : el.querySelector('button');
    const text = btn?.textContent?.trim() ?? '';
    return text !== 'Select One' ? text : '';
  }

  if (wt === 'react-select' || wt === 'autocomplete') {
    const container =
      el.closest('.select, [class*="select__control"]')?.closest('.select') ??
      el.closest('[class*="select"]');
    if (container) {
      const sv = container.querySelector('[class*="single-value"], [class*="singleValue"]');
      if (sv?.textContent?.trim()) return sv.textContent.trim();
    }
    return '';
  }

  if (el instanceof HTMLSelectElement) {
    return el.selectedIndex > 0 ? el.options[el.selectedIndex]!.text : '';
  }
  if ((wt === 'radio-group' || wt === 'checkbox-group') && field.groupElements) {
    for (let i = 0; i < field.groupElements.length; i++) {
      const inp = field.groupElements[i] as HTMLInputElement;
      if (inp.checked) {
        // Prefer groupLabels (visible span text) over inp.value (hidden form value)
        if (field.groupLabels?.[i]) return field.groupLabels[i]!;
        // For Lever CSS-hidden radios, check the visible span text
        const span = inp.parentElement?.querySelector('.application-answer-alternative');
        if (span?.textContent?.trim()) return span.textContent.trim();
        return inp.value ?? '';
      }
    }
    return '';
  }
  if (wt === 'button-group' && field.groupElements) {
    for (let i = 0; i < field.groupElements.length; i++) {
      const btn = field.groupElements[i]!;
      if (
        btn.classList.contains('active') ||
        btn.getAttribute('aria-pressed') === 'true' ||
        btn.getAttribute('data-state') === 'on' ||
        btn.getAttribute('aria-selected') === 'true'
      ) {
        return field.groupLabels?.[i] ?? btn.textContent?.trim() ?? '';
      }
    }
    return '';
  }

  if (el instanceof HTMLInputElement) {
    if (el.type === 'file') return el.files?.[0]?.name ?? '';
    if (el.type === 'checkbox') return el.checked ? 'Yes' : 'No';
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) return el.value;
  return '';
}

function truncateLabel(label: string): string {
  return label.length > 120 ? label.slice(0, 117) + '...' : label;
}

/** Keep one entry per element (elementHint + label), priority filled > failed > skipped. */
export function dedupeLogs(logs: FieldResult[]): FieldResult[] {
  const statusPriority: Record<FieldResult['status'], number> = {
    filled: 3,
    failed: 2,
    skipped: 1,
  };
  const dedupedByKey = new Map<string, FieldResult>();
  const unkeyed: FieldResult[] = [];
  for (const log of logs) {
    const hint = log.elementHint ?? '';
    if (!hint) {
      unkeyed.push(log);
      continue;
    }
    const key = hint + '::' + log.field;
    const existing = dedupedByKey.get(key);
    if (!existing || statusPriority[log.status] > statusPriority[existing.status]) {
      dedupedByKey.set(key, log);
    }
  }
  return [...dedupedByKey.values(), ...unkeyed];
}

/** Build a short DOM hint like "input[type=text]#first_name" or "select.country" */
export function elementHint(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const type = el instanceof HTMLInputElement ? `[type=${el.type}]` : '';
  const id = el.id ? `#${el.id.slice(0, 40)}` : '';
  const name =
    !id && el.getAttribute('name') ? `[name=${el.getAttribute('name')!.slice(0, 30)}]` : '';
  return `${tag}${type}${id}${name}`;
}

/** Build scanner metadata fields for a FieldResult from a ScanResult. */
function scannerMeta(
  field: ScanResult,
): Pick<FieldResult, 'widgetType' | 'category' | 'sectionHeading' | 'groupLabels' | 'elementHint'> {
  return {
    widgetType: field.widgetType,
    category: field.category ?? undefined,
    sectionHeading: field.sectionHeading || undefined,
    groupLabels: field.groupLabels,
    elementHint: elementHint(field.element),
  };
}

function outcomeToLog(
  field: ScanResult,
  value: string,
  outcome: FillOutcome,
  source?: FieldResult['source'],
  confidence?: number,
): FieldResult {
  const label = truncateLabel(field.label);
  const meta = scannerMeta(field);
  if (outcome.status === 'filled') {
    const actual = readActualValue(field);
    const logValue =
      field.widgetType === 'file-upload'
        ? fileLogValue(value)
        : actual || outcome.matchedOption || value;
    return { field: label, value: logValue, status: 'filled', source, confidence, ...meta };
  }
  if (outcome.status === 'failed') {
    const result: FieldResult = {
      field: label,
      value: '',
      status: 'failed',
      source,
      confidence,
      ...meta,
      failReason: outcome.reason,
      attemptedValue: value,
    };
    // Only overwrite scanner's groupLabels when the filler found real options —
    // an empty array means options weren't loaded at fill time (lazy selects),
    // in which case we'd rather keep the scanner's snapshot.
    if (outcome.discoveredOptions && outcome.discoveredOptions.length > 0) {
      result.groupLabels = outcome.discoveredOptions;
    }
    return result;
  }
  return {
    field: label,
    value: '',
    status: 'skipped',
    source,
    confidence,
    ...meta,
    skipReason: outcome.reason,
    attemptedValue: value,
  };
}

function shouldAbort(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

/** Composite key for field dedup — distinguishes same-label fields in different sections. */
function fieldKey(field: ScanResult): string {
  return field.label + '::' + (field.sectionHeading || '');
}

/** Skip patterns that override ML classification. */
const SKIP_LABEL_PATTERNS = [
  /how.*hear|how.*find.*position|how.*learn.*about|where.*hear/i,
  /^if\s+(you\s+)?select|please\s+(specify|describe|explain|elaborate)/i,
];

/** Check if a classified field should be skipped. */
function shouldSkipField(field: ScanResult, fillMap: Record<string, string>): boolean {
  if (field.category === '__skip__' || field.category === 'customQuestion') return true;
  if (SKIP_LABEL_PATTERNS.some((p) => p.test(field.label))) return true;
  if (
    field.category === 'veteranStatus' &&
    (field.widgetType === 'autocomplete' ||
      field.widgetType === 'native-select' ||
      field.widgetType === 'react-select' ||
      field.widgetType === 'workday-dropdown') &&
    /branch|service|which.*branch/i.test(field.label)
  ) {
    const val = fillMap[field.category];
    if (val && /not|no/i.test(val)) return true;
  }
  return false;
}

/**
 * Watch for late-appearing fields via MutationObserver.
 */
function watchForLateFields(
  seenKeys: Set<string>,
  fillMap: Record<string, string>,
  signal: AbortSignal | undefined,
  startTime: number,
  classificationCache: WeakMap<HTMLElement, CachedClassification>,
  mlDisabled: boolean,
): Promise<{ filled: number; logs: FieldResult[] }> {
  return new Promise((resolve) => {
    let filled = 0;
    const logs: FieldResult[] = [];
    let settled = false;
    let mutationSeen = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      obs.disconnect();
      resolve({ filled, logs });
    };

    let processing = false;
    const processNewFields = async () => {
      if (settled || processing) return;
      processing = true;
      try {
        const latestFields = scanPage();
        // Reuse cached classifications from earlier phases before hitting ML.
        const needsClassify = classifyWithCache(latestFields, classificationCache);
        const newFields = needsClassify.filter((f) => !seenKeys.has(fieldKey(f)));
        if (newFields.length > 0) {
          await classifyFields(newFields, { mlDisabled });
          writeCache(newFields, classificationCache);
        }
        for (const field of latestFields) {
          if (seenKeys.has(fieldKey(field))) continue;
          if (!field.category) continue;
          if (field.widgetType === 'file-upload') continue;
          if (shouldSkipField(field, fillMap)) continue;

          const value = fillMap[field.category];
          if (!value) continue;

          const outcome = await fillField(field, value, fillMap);
          if (outcome.status === 'filled') {
            logs.push({
              field: truncateLabel(field.label),
              value,
              status: 'filled',
              source: 'rescan',
              ...scannerMeta(field),
            });
            seenKeys.add(fieldKey(field));
            filled++;
          }
        }
      } finally {
        processing = false;
      }
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMutationTime = 0;
    const obs = new MutationObserver(() => {
      mutationSeen = true;
      lastMutationTime = Date.now();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processNewFields();
      }, RESCAN_DEBOUNCE_MS);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      if (!mutationSeen) finish();
    }, RESCAN_INITIAL_WAIT_MS);
    const checkFinish = () => {
      if (settled) return;
      // Don't settle while ML classification is still processing
      if (processing) {
        setTimeout(checkFinish, RESCAN_SETTLE_MS);
        return;
      }
      if (Date.now() - lastMutationTime < RESCAN_SETTLE_MS && Date.now() - startTime < 10000) {
        setTimeout(checkFinish, RESCAN_SETTLE_MS);
      } else {
        processNewFields().finally(finish);
      }
    };
    setTimeout(checkFinish, RESCAN_MAX_WAIT_MS);

    signal?.addEventListener('abort', finish, { once: true });
  });
}

//  Fill Phase Helper

async function fillBucket(
  bucket: ScanResult[],
  fillMap: Record<string, string>,
  logs: FieldResult[],
  signal?: AbortSignal,
  fillDelay = FILL_DELAY_MS,
): Promise<void> {
  for (const field of bucket) {
    if (shouldAbort(signal)) break;

    // Re-find element if React re-rendered and detached the original DOM node
    if (!field.element.isConnected) {
      const id = field.element.id;
      const miraId = field.element.getAttribute('data-mira-id');
      const fresh =
        (id && document.getElementById(id)) ||
        (miraId && document.querySelector(`[data-mira-id="${miraId}"]`)) ||
        null;
      if (fresh instanceof HTMLElement) {
        field.element = fresh;
      }
    }

    const meta = scannerMeta(field);

    if (shouldSkipField(field, fillMap)) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
        confidence: field.mlConfidence,
        skipReason: 'no-value',
        ...meta,
      });
      continue;
    }

    const value = fillMap[field.category!];
    if (!value) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
        confidence: field.mlConfidence,
        skipReason: 'no-value',
        ...meta,
        attemptedValue: undefined,
      });
      continue;
    }

    if (field.widgetType !== 'file-upload' && isFileBlob(value)) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
        skipReason: 'file-on-text',
        ...meta,
      });
      continue;
    }

    const outcome = await fillField(field, value, fillMap);
    logs.push(outcomeToLog(field, value, outcome, field.classifiedBy, field.mlConfidence));

    await sleep(fillDelay);
  }
}

//  Bucket Sorting (by widgetType instead of InputType)

const TEXT_WIDGETS = new Set<WidgetType>(['plain-text', 'datepicker']);
const SELECT_WIDGETS = new Set<WidgetType>([
  'native-select',
  'react-select',
  'autocomplete',
  'workday-dropdown',
  'workday-multiselect',
  'icims-typeahead',
]);
const GROUP_WIDGETS = new Set<WidgetType>([
  'radio-group',
  'checkbox',
  'checkbox-group',
  'button-group',
  'workday-virtualized-checkbox',
  'workday-date',
  'icims-date',
]);
// File uploads fire framework-specific side-effects (iCIMS auto-submits the
// form after a resume upload, for example). Fill them LAST so every other
// field is already populated before the navigation happens.
const FILE_WIDGETS = new Set<WidgetType>(['file-upload']);

//  Main Pipeline

export interface FillOptions {
  mlDisabled?: boolean;
}

interface CachedClassification {
  category: string | null;
  classifiedBy?: ScanResult['classifiedBy'];
  mlConfidence?: number;
}

/**
 * Apply cached classifications to unclassified fields in-place; return the
 * subset that still needs real classification. Rescans reuse DOM elements
 * for fields that were present earlier, so we key the cache by element ref.
 */
function classifyWithCache(
  fields: ScanResult[],
  cache: WeakMap<HTMLElement, CachedClassification>,
): ScanResult[] {
  const unclassified: ScanResult[] = [];
  for (const field of fields) {
    if (field.category && field.classifiedBy) continue;
    const cached = cache.get(field.element);
    if (cached) {
      field.category = cached.category;
      field.classifiedBy = cached.classifiedBy;
      field.mlConfidence = cached.mlConfidence;
      continue;
    }
    unclassified.push(field);
  }
  return unclassified;
}

function writeCache(fields: ScanResult[], cache: WeakMap<HTMLElement, CachedClassification>): void {
  for (const f of fields) {
    if (f.classifiedBy) {
      cache.set(f.element, {
        category: f.category,
        classifiedBy: f.classifiedBy,
        mlConfidence: f.mlConfidence,
      });
    }
  }
}

export async function fillPage(
  fillMap: Record<string, string>,
  answerBank: AnswerEntry[] = [],
  signal?: AbortSignal,
  opts: FillOptions = {},
): Promise<FillResult> {
  const startTime = performance.now();
  const ats = detectATS();
  const totalFormElements = document.querySelectorAll('input, select, textarea').length;
  const fields = scanPage();
  const logs: FieldResult[] = [];
  const classificationCache = new WeakMap<HTMLElement, CachedClassification>();

  if (shouldAbort(signal))
    return {
      filled: 0,
      failed: 0,
      skipped: 0,
      total: fields.length,
      logs,
      mlAvailable: false,
      durationMs: 0,
    };

  const unclassified = classifyWithCache(fields, classificationCache);
  let mlAvailable = !opts.mlDisabled;
  if (unclassified.length > 0) {
    mlAvailable = await classifyFields(unclassified, { mlDisabled: opts.mlDisabled === true });
  }
  writeCache(fields, classificationCache);

  if (shouldAbort(signal))
    return {
      filled: 0,
      failed: 0,
      skipped: 0,
      total: fields.length,
      logs,
      mlAvailable,
      durationMs: Math.round(performance.now() - startTime),
    };

  // ── Sort classified fields into fill buckets ──
  const classified = fields.filter((f) => f.category && f.category !== 'customQuestion');
  const unmatched = fields.filter((f) => !f.category || f.category === 'customQuestion');

  const textFields = classified.filter(
    (f) => TEXT_WIDGETS.has(f.widgetType) && f.category !== 'location',
  );
  const locationFields = classified.filter((f) => f.category === 'location');
  const selectFields = classified.filter(
    (f) => SELECT_WIDGETS.has(f.widgetType) && f.category !== 'location',
  );
  const groupFields = classified.filter(
    (f) => GROUP_WIDGETS.has(f.widgetType) && f.category !== 'location',
  );
  const fileFields = classified.filter((f) => FILE_WIDGETS.has(f.widgetType));

  await fillBucket(textFields, fillMap, logs, signal);

  if (!shouldAbort(signal)) {
    await fillBucket(selectFields, fillMap, logs, signal);
  }

  if (!shouldAbort(signal)) {
    await fillBucket(groupFields, fillMap, logs, signal);
  }

  // ── Phase C2: Location dropdowns (API had time to load during A-C) ──
  if (!shouldAbort(signal) && locationFields.length > 0) {
    await sleep(REACT_SETTLE_MS);
    await fillBucket(locationFields, fillMap, logs, signal);
  }

  // ── Phase C3: File uploads last — iCIMS etc. auto-submit the form on
  // resume select, which navigates the iframe and nukes any still-pending
  // fills. Running files after everything else means we only lose the
  // answer-bank / rescan phases if navigation happens.
  if (!shouldAbort(signal) && fileFields.length > 0) {
    await fillBucket(fileFields, fillMap, logs, signal);
  }

  // ── Phase D: Answer bank for unmatched fields ──
  if (!shouldAbort(signal) && unmatched.length > 0) {
    const answerBankFields: ScanResult[] = [];

    if (answerBank.length > 0) {
      const answerMatches = await matchAnswerBank(
        unmatched.map((f) => f.label),
        answerBank,
      );

      // Widget types that accept free-text answers from the answer bank.
      // Dropdowns/selects need exact option matches, not free-text — skip them.
      const TEXT_ANSWER_WIDGETS = new Set(['plain-text', 'datepicker']);
      for (const field of unmatched) {
        const answer = answerMatches.get(field.label);
        if (!answer || !TEXT_ANSWER_WIDGETS.has(field.widgetType)) {
          answerBankFields.push(field);
          continue;
        }
        const outcome = await fillField(field, answer, fillMap);
        logs.push(outcomeToLog(field, answer, outcome, 'answer-bank'));
      }
    } else {
      answerBankFields.push(...unmatched);
    }

    for (const field of answerBankFields) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
        skipReason: 'no-value',
        ...scannerMeta(field),
      });
    }
  }

  // ── Phase E: Rescan for dynamically revealed fields ──
  if (!shouldAbort(signal) && fields.length > 0) {
    const seenKeys = new Set(fields.filter((f) => f.category).map((f) => fieldKey(f)));

    await sleep(REACT_SETTLE_MS);
    const newFields = scanPage();

    // Classify newly revealed fields (reusing cache hits for fields already seen)
    const newUnclassified = classifyWithCache(newFields, classificationCache);
    if (newUnclassified.length > 0) {
      await classifyFields(newUnclassified, { mlDisabled: opts.mlDisabled === true });
    }
    writeCache(newFields, classificationCache);

    for (const field of newFields) {
      if (!field.category) continue;
      // File uploads are one-time fills; label changes after upload (e.g., "resume.pdf")
      // causing dedup to miss them. Skip them in rescan entirely.
      if (field.widgetType === 'file-upload') continue;
      if (shouldSkipField(field, fillMap)) continue;
      const value = fillMap[field.category];
      if (!value) continue;
      if (seenKeys.has(fieldKey(field))) continue;

      const outcome = await fillField(field, value, fillMap);
      if (outcome.status === 'filled') {
        logs.push({
          field: truncateLabel(field.label),
          value,
          status: 'filled',
          source: 'rescan',
          ...scannerMeta(field),
        });
        seenKeys.add(fieldKey(field));
      }
    }

    // Watch for late-appearing fields (up to 3s)
    const rescanResult = await watchForLateFields(
      seenKeys,
      fillMap,
      signal,
      startTime,
      classificationCache,
      opts.mlDisabled === true,
    );
    logs.push(...rescanResult.logs);
  }

  const dedupedLogs = dedupeLogs(logs);

  // Sort logs by original scan order (DOM position) instead of fill order.
  // Fields from rescan/late-discovery stay at the end.
  const scanOrder = new Map<string, number>();
  for (let i = 0; i < fields.length; i++) {
    const key = truncateLabel(fields[i]!.label);
    if (!scanOrder.has(key)) scanOrder.set(key, i);
  }
  dedupedLogs.sort((a, b) => {
    const ia = scanOrder.get(a.field) ?? Infinity;
    const ib = scanOrder.get(b.field) ?? Infinity;
    return ia - ib;
  });

  const finalFilled = dedupedLogs.filter((l) => l.status === 'filled').length;
  const finalFailed = dedupedLogs.filter((l) => l.status === 'failed').length;
  const finalSkipped = dedupedLogs.filter((l) => l.status === 'skipped').length;

  const durationMs = Math.round(performance.now() - startTime);
  return {
    filled: finalFilled,
    failed: finalFailed,
    skipped: finalSkipped,
    total: finalFilled + finalFailed + finalSkipped,
    logs: dedupedLogs,
    mlAvailable,
    durationMs,
    ats,
    totalFormElements,
  };
}
