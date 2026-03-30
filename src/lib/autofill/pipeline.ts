/**
 * Autofill pipeline orchestrator.
 *
 * Three-tier classification (before any filling):
 *   Tier 1: Options-first — classify by option content (gender, race, degree, etc.)
 *   Tier 2: Heuristics — ~20 patterns for unambiguous short labels (name, email, phone)
 *   Tier 3: ML classifier — everything else (consent, sponsorship, EEO, yes/no questions)
 *
 * Fill order (text → selects → groups):
 *   Phase A: Text/file fields (don't trigger React re-renders)
 *   Phase B: Select/combobox fields (may trigger conditional reveals)
 *   Phase C: Group fields — buttons/radios/checkboxes (trigger re-renders, filled LAST)
 *   Phase D: Answer bank for remaining unmatched
 *   Phase E: Rescan for dynamically revealed fields
 */

import type { FillResult, FieldResult, FillableField, FillOutcome } from './types';
import type { FieldContext, MLClassifyResponse, MLMatchAnswersResponse } from '@/lib/ml/types';
import type { AnswerEntry } from '@/lib/schema';
import { scanPage } from './scan';
import { classifyByOptions } from './options-classify';
import { classifyField } from './patterns';
import {
  detectWidget,
  fillText,
  fillDatepicker,
  fillSelect,
  fillCheckbox,
  fillRadioGroup,
  fillCheckboxGroup,
  fillReactSelect,
  fillAutocomplete,
  fillButtonGroup,
  fillFile,
} from './fill';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const FILL_DELAY_MS = 200; // Delay between filling each field
const REACT_SETTLE_MS = 500; // Wait for React re-renders to complete
const RESCAN_DEBOUNCE_MS = 150; // Debounce before processing new mutations
const RESCAN_INITIAL_WAIT_MS = 300; // Wait before checking if mutations will come
const RESCAN_SETTLE_MS = 200; // Wait after last mutation before finishing
const RESCAN_MAX_WAIT_MS = 800; // Max time to wait for any mutations

// ══════════════════════════════════════════════════════════════════════
//  Classification
// ══════════════════════════════════════════════════════════════════════

const ML_CONFIDENCE_HIGH = 0.5;
const ML_CONFIDENCE_LOW = 0.3;

const LOW_THRESHOLD_CATEGORIES = new Set([
  'email',
  'phone',
  'resume',
  'coverLetter',
  'linkedin',
  'github',
  'twitter',
  'portfolio',
  'firstName',
  'lastName',
  'fullName',
  'location',
  'country',
  'workAuth',
  'sponsorship',
  'canWorkFromLocation',
]);

interface MLResult {
  category: string;
  confidence: number;
}

async function classifyWithML(
  fields: FillableField[],
): Promise<{ map: Map<number, MLResult>; available: boolean }> {
  const map = new Map<number, MLResult>();
  if (fields.length === 0) return { map, available: true };

  const contexts: FieldContext[] = fields.map((f) => ({
    label: f.label,
    type: f.type,
    options: f.groupLabels,
    placeholder: (f.element as HTMLInputElement).placeholder || undefined,
    name: (f.element as HTMLInputElement).name || undefined,
    ariaLabel: (f.element as HTMLElement).getAttribute('aria-label') || undefined,
    sectionHeading: f.sectionHeading || undefined,
  }));

  try {
    // Retry if model not ready yet (still loading on cold start)
    const response: MLClassifyResponse = await chrome.runtime.sendMessage({
      type: 'ML_CLASSIFY',
      fields: contexts,
    });

    if (response?.error) return { map, available: false };

    if (response?.classifications) {
      for (let i = 0; i < response.classifications.length; i++) {
        const c = response.classifications[i]!;
        if (!c.category) continue;
        const threshold = LOW_THRESHOLD_CATEGORIES.has(c.category)
          ? ML_CONFIDENCE_LOW
          : ML_CONFIDENCE_HIGH;
        if (c.confidence >= threshold) {
          map.set(i, { category: c.category, confidence: c.confidence });
        }
      }
    }
    return { map, available: true };
  } catch {
    return { map, available: false };
  }
}

/**
 * Fallback patterns for fields ML didn't classify.
 * These run AFTER options-first + heuristics + ML, so there are no
 * ordering conflicts with broad patterns like email/resume.
 * Only needed when ML is unavailable (cold start) or below threshold.
 */
const FALLBACK_PATTERNS: [RegExp, string][] = [
  // Auth / Sponsorship
  [
    /visa.*sponsor|require.*sponsor|need.*sponsor|immigration.*sponsor|require.*written.*submission/i,
    'sponsorship',
  ],
  [
    /legally.*authorized.*work|authorized.*to.*work|unrestricted.*work.*auth|work.*authorization/i,
    'workAuth',
  ],

  // Relocation / Office
  [/require.*relocation.*assist|need.*relocation.*assist/i, 'relocate'],
  [/willing.*relocat|able.*to.*relocat|open.*to.*relocat/i, 'relocate'],
  [
    /able.*to.*work.*from|can.*you.*work.*from|work.*from.*office|go.*into.*office|come.*into.*office/i,
    'canWorkFromLocation',
  ],

  // Consent
  [
    /privacy.*policy|terms.*condition|i\s+(?:acknowledge|confirm|agree|accept|understand)|arbitration/i,
    'consent',
  ],
  [/sms|whatsapp|text.*message/i, 'smsConsent'],
  [/metaview|notetaking.*tool|recording.*consent/i, 'consent'],
  [/contact.*me.*about.*future|retain.*data.*future/i, 'consent'],

  // EEO (when options-first didn't match)
  [/^gender\b|gender.*identity|what.*is.*your.*gender/i, 'gender'],
  [/transgender|trans\b.*identify/i, 'transgender'],
  [/sexual.*orient/i, 'sexualOrientation'],
  [/^race\b|race.*ethnicity|ethnicit/i, 'race'],
  [/are.*you.*hispanic|^hispanic.*latin/i, 'isHispanic'],
  [/veteran/i, 'veteranStatus'],
  [/disability|disabled/i, 'disabilityStatus'],
  [/lgbtq/i, 'lgbtq'],
  [/pronoun/i, 'pronouns'],

  // Misc
  // howDidYouHear skipped — varies per application
  [/when.*can.*you.*start|start.*date|earliest.*start/i, 'startDate'],
  [/18.*years|over.*18|at.*least.*18/i, 'isOver18'],
  [/current.*age|what.*your.*age|age.*range/i, 'ageRange'],
  [/have.*you.*worked|previously.*employed/i, 'workedHereBefore'],
  [/provide.*documentation|provide.*documents/i, 'canProvideDoc'],
  [/(?:following|which).*communit|communit.*(?:belong|identify)/i, 'communities'],
  [/accommodation/i, 'accommodationRequest'],
  [/currently.*located.*in.*(?:us|u\.s|united\s+states)/i, 'locatedInUS'],
  [/visa.*status|immigration.*status|visa.*type|what.*visa/i, 'visaType'],
];

function classifyByFallback(label: string): string | null {
  const clean = label.replace(/\s+/g, ' ').trim();
  for (const [pattern, category] of FALLBACK_PATTERNS) {
    if (pattern.test(clean)) return category;
  }
  return null;
}

/**
 * Three-tier classification + fallback: options → heuristics → ML → fallback patterns.
 * All classification happens before any filling begins.
 */
async function classifyAllFields(fields: FillableField[]): Promise<boolean> {
  const needML: FillableField[] = [];

  for (const field of fields) {
    // Tier 1: Options-first (selects, radios, button-groups with known option signatures)
    if (field.groupLabels && field.groupLabels.length >= 2) {
      const cat = classifyByOptions(field.groupLabels);
      if (cat) {
        field.category = cat;
        field.classifiedBy = 'options';
        continue;
      }
    }

    // Tier 2: Heuristic patterns (short unambiguous labels)
    const heuristicCat = classifyField(field.label);
    if (heuristicCat) {
      field.category = heuristicCat;
      field.classifiedBy = 'heuristic';
      continue;
    }

    // Tier 3: Queue for ML batch
    needML.push(field);
  }

  // Batch ML classification
  let mlAvailable = true;
  if (needML.length > 0) {
    const result = await classifyWithML(needML);
    mlAvailable = result.available;
    for (let i = 0; i < needML.length; i++) {
      const mlResult = result.map.get(i);
      if (mlResult) {
        needML[i]!.category = mlResult.category;
        needML[i]!.classifiedBy = 'ml';
        needML[i]!.mlConfidence = mlResult.confidence;
      }
    }
  }

  // Post-ML validation: if ML chose a category that contradicts the field's options,
  // override with fallback. E.g., ML says "race" but options are Yes/No → isHispanic.
  const OPTION_SPECIFIC_CATEGORIES = new Set([
    'race',
    'gender',
    'degree',
    'veteranStatus',
    'disabilityStatus',
  ]);
  for (const field of needML) {
    if (!field.category || !OPTION_SPECIFIC_CATEGORIES.has(field.category)) continue;
    if (!field.groupLabels || field.groupLabels.length < 2) continue;
    // Check: do the options match the ML category? If options are just Yes/No, the category is wrong.
    const optionsLower = field.groupLabels.map((o) => o.toLowerCase().trim());
    const isGenericYesNo = optionsLower.every((o) =>
      /^(yes|no|decline|i don'?t|prefer not|not applicable)/.test(o),
    );
    if (isGenericYesNo) {
      // ML got it wrong — override with fallback
      const fallbackCat = classifyByFallback(field.label);
      if (fallbackCat) {
        field.category = fallbackCat;
        field.classifiedBy = 'heuristic';
      }
    }
  }

  // Tier 4: Fallback patterns for fields ML didn't classify
  for (const field of needML) {
    if (field.category) continue;
    const fallbackCat = classifyByFallback(field.label);
    if (fallbackCat) {
      field.category = fallbackCat;
      field.classifiedBy = 'heuristic';
    }
  }

  return mlAvailable;
}

// ══════════════════════════════════════════════════════════════════════
//  Answer Bank
// ══════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════
//  Fill Helpers
// ══════════════════════════════════════════════════════════════════════

function isFileBlob(value: string): boolean {
  return value.startsWith('{') && value.includes('"data":');
}

async function fillField(
  field: FillableField,
  value: string,
  category?: string,
): Promise<FillOutcome> {
  const widget = detectWidget(field);

  if (widget !== 'file-upload' && isFileBlob(value))
    return { status: 'skipped', reason: 'file-on-text' };

  const isLocation = category === 'location';
  switch (widget) {
    case 'plain-text': {
      if (isLocation) {
        const el = field.element;
        // Check if it's actually a combobox (Ashby) that scan missed
        const hasComboboxAttrs =
          el.getAttribute('role') === 'combobox' ||
          el.getAttribute('aria-autocomplete') ||
          el.getAttribute('aria-haspopup') === 'listbox';
        if (hasComboboxAttrs) {
          return fillAutocomplete(el, value, true, category, field.description);
        }
        // Plain text location (Lever): go through fillAutocomplete which types,
        // waits for Google Places dropdown, and selects via direct keyboard events.
        const autoResult = await fillAutocomplete(el, value, true, category, field.description);
        if (autoResult.status === 'filled') return autoResult;
        if ((el as HTMLInputElement).value?.trim()) return { status: 'filled' };
        return autoResult;
      }
      return fillText(field.element, value);
    }
    case 'datepicker':
      return fillDatepicker(field.element, value);
    case 'native-select':
      return fillSelect(field.element, value, category);
    case 'react-select':
      return fillReactSelect(field.element, value, isLocation, category);
    case 'autocomplete':
      return fillAutocomplete(field.element, value, isLocation, category, field.description);
    case 'radio-group':
      return fillRadioGroup(field.groupElements!, field.groupLabels!, value, category);
    case 'checkbox':
      return fillCheckbox(field.element, value);
    case 'checkbox-group':
      return fillCheckboxGroup(field.groupElements!, field.groupLabels!, value, category);
    case 'button-group':
      return fillButtonGroup(field.groupElements!, field.groupLabels!, value, category);
    case 'file-upload':
      return fillFile(field.element, value);
    default:
      return { status: 'skipped', reason: 'wrong-type' };
  }
}

function fileLogValue(value: string): string {
  try {
    return (JSON.parse(value) as { name?: string }).name ?? 'file';
  } catch {
    return 'file';
  }
}

function readActualValue(field: FillableField): string {
  const el = field.element;

  if (field.type === 'combobox') {
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
  if (field.type === 'radio-group' && field.groupElements) {
    for (let i = 0; i < field.groupElements.length; i++) {
      const inp = field.groupElements[i] as HTMLInputElement;
      if (inp.checked) return field.groupLabels?.[i] ?? inp.value ?? '';
    }
    return '';
  }
  if (field.type === 'button-group' && field.groupElements) {
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

function outcomeToLog(
  field: FillableField,
  value: string,
  outcome: FillOutcome,
  source?: FieldResult['source'],
  confidence?: number,
): FieldResult {
  const label = truncateLabel(field.label);
  if (outcome.status === 'filled') {
    const actual = readActualValue(field);
    const logValue = field.type === 'file' ? fileLogValue(value) : actual || value;
    return { field: label, value: logValue, status: 'filled', source, confidence };
  }
  if (outcome.status === 'failed') {
    return { field: label, value: '', status: 'failed', source, confidence };
  }
  return { field: label, value: '', status: 'skipped', source, confidence };
}

function shouldAbort(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

/**
 * Watch for late-appearing fields via MutationObserver.
 * Resolves after mutations settle or timeout (~3s max).
 */
function watchForLateFields(
  filledLabels: Set<string>,
  fillMap: Record<string, string>,
  signal: AbortSignal | undefined,
  startTime: number,
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
        for (const field of latestFields) {
          if (filledLabels.has(field.label)) continue;

          // Quick classify: options-first + heuristics only (no ML for rescan speed)
          if (field.groupLabels && field.groupLabels.length >= 2) {
            field.category = classifyByOptions(field.groupLabels);
          }
          if (!field.category) field.category = classifyField(field.label);
          if (!field.category) continue;
          if (shouldSkipField(field, fillMap)) continue;

          const value = fillMap[field.category];
          if (!value) continue;

          const outcome = await fillField(field, value, field.category);
          if (outcome.status === 'filled') {
            logs.push({
              field: truncateLabel(field.label),
              value,
              status: 'filled',
              source: 'rescan',
            });
            filledLabels.add(field.label);
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
      if (Date.now() - lastMutationTime < RESCAN_SETTLE_MS && Date.now() - startTime < 3000) {
        setTimeout(checkFinish, RESCAN_SETTLE_MS);
      } else {
        processNewFields().finally(finish);
      }
    };
    setTimeout(checkFinish, RESCAN_MAX_WAIT_MS);

    signal?.addEventListener('abort', finish, { once: true });
  });
}

/** Check if a classified field should be skipped (e.g., veteran branch when not a veteran). */
function shouldSkipField(field: FillableField, fillMap: Record<string, string>): boolean {
  if (field.category === '__skip__' || field.category === 'customQuestion') return true;
  if (
    field.category === 'veteranStatus' &&
    (field.type === 'combobox' || field.type === 'select') &&
    /branch|service|which.*branch/i.test(field.label)
  ) {
    const val = fillMap[field.category];
    if (val && /not|no/i.test(val)) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════
//  Fill Phase Helper
// ══════════════════════════════════════════════════════════════════════

async function fillBucket(
  bucket: FillableField[],
  fillMap: Record<string, string>,
  logs: FieldResult[],
  signal?: AbortSignal,
  fillDelay = 150,
): Promise<number> {
  let filled = 0;
  for (const field of bucket) {
    if (shouldAbort(signal)) break;

    if (shouldSkipField(field, fillMap)) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
      });
      continue;
    }

    const value = fillMap[field.category!];
    if (!value) {
      logs.push({ field: truncateLabel(field.label), value: '', status: 'skipped' });
      continue;
    }

    if (field.type !== 'file' && isFileBlob(value)) {
      logs.push({
        field: truncateLabel(field.label),
        value: '',
        status: 'skipped',
        source: field.classifiedBy,
      });
      continue;
    }

    const outcome = await fillField(field, value, field.category!);
    logs.push(outcomeToLog(field, value, outcome, field.classifiedBy, field.mlConfidence));
    if (outcome.status === 'filled') filled++;

    await sleep(fillDelay);
  }
  return filled;
}

// ══════════════════════════════════════════════════════════════════════
//  Main Pipeline
// ══════════════════════════════════════════════════════════════════════

function isTextField(f: FillableField): boolean {
  return f.type === 'text' || f.type === 'file';
}

function isSelectField(f: FillableField): boolean {
  return f.type === 'select' || f.type === 'combobox';
}

function isGroupField(f: FillableField): boolean {
  return f.type === 'radio-group' || f.type === 'button-group' || f.type === 'checkbox';
}

export async function fillPage(
  fillMap: Record<string, string>,
  answerBank: AnswerEntry[] = [],
  signal?: AbortSignal,
): Promise<FillResult> {
  const startTime = performance.now();
  const fields = scanPage();
  const logs: FieldResult[] = [];

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

  // ── Classify all fields (Tier 1 → Tier 2 → Tier 3) ──
  const mlAvailable = await classifyAllFields(fields);

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
  // customQuestion → route to answer bank (Phase D), not normal fill
  const classified = fields.filter((f) => f.category && f.category !== 'customQuestion');
  const unmatched = fields.filter((f) => !f.category || f.category === 'customQuestion');

  const textFields = classified.filter((f) => isTextField(f) && f.category !== 'location');
  const locationFields = classified.filter((f) => f.category === 'location');
  const selectFields = classified.filter((f) => isSelectField(f) && f.category !== 'location');
  const groupFields = classified.filter(isGroupField);

  const fillDelay = FILL_DELAY_MS;

  // ── Phase A: Fill text/file fields ──
  let filled = await fillBucket(textFields, fillMap, logs, signal, fillDelay);

  // ── Phase B: Fill select/combobox fields (non-location) ──
  if (!shouldAbort(signal)) {
    filled += await fillBucket(selectFields, fillMap, logs, signal, fillDelay);
  }

  // ── Phase C: Fill group fields (buttons/radios/checkboxes trigger re-renders) ──
  if (!shouldAbort(signal)) {
    filled += await fillBucket(groupFields, fillMap, logs, signal, fillDelay);
  }

  // ── Phase C2: Select from location dropdowns (API had time to load during A-C) ──
  // Let page settle after group re-renders before interacting with comboboxes.
  // Ashby's React re-renders from Phase C can leave comboboxes in a transitional state.
  if (!shouldAbort(signal) && locationFields.length > 0) {
    await sleep(REACT_SETTLE_MS);
    filled += await fillBucket(locationFields, fillMap, logs, signal, fillDelay);
  }

  // ── Phase D: Answer bank for unmatched fields ──
  if (!shouldAbort(signal) && unmatched.length > 0) {
    const answerBankFields: FillableField[] = [];

    if (answerBank.length > 0) {
      const answerMatches = await matchAnswerBank(
        unmatched.map((f) => f.label),
        answerBank,
      );

      for (const field of unmatched) {
        const answer = answerMatches.get(field.label);
        if (!answer) {
          answerBankFields.push(field);
          continue;
        }
        const outcome = await fillField(field, answer);
        logs.push(outcomeToLog(field, answer, outcome, 'answer-bank'));
        if (outcome.status === 'filled') filled++;
      }
    } else {
      answerBankFields.push(...unmatched);
    }

    for (const field of answerBankFields) {
      logs.push({ field: truncateLabel(field.label), value: '', status: 'skipped' });
    }
  }

  // ── Phase E: Rescan for dynamically revealed fields ──
  if (!shouldAbort(signal) && fields.length > 0) {
    const filledLabels = new Set(logs.filter((l) => l.status === 'filled').map((l) => l.field));

    await sleep(REACT_SETTLE_MS); // Greenhouse conditional fields need time to render
    const newFields = scanPage();

    // Classify newly revealed fields
    await classifyAllFields(newFields);

    for (const field of newFields) {
      if (!field.category) continue;
      if (shouldSkipField(field, fillMap)) continue;
      const value = fillMap[field.category];
      if (!value) continue;
      if (filledLabels.has(field.label)) continue;

      const outcome = await fillField(field, value, field.category);
      if (outcome.status === 'filled') {
        logs.push({ field: truncateLabel(field.label), value, status: 'filled', source: 'rescan' });
        filledLabels.add(field.label);
      }
    }

    // Watch for late-appearing fields (up to 3s)
    const rescanResult = await watchForLateFields(filledLabels, fillMap, signal, startTime);

    logs.push(...rescanResult.logs);
  }

  void filled; // accumulated for debugging; final count comes from logs
  const finalFilled = logs.filter((l) => l.status === 'filled').length;
  const finalFailed = logs.filter((l) => l.status === 'failed').length;
  const finalSkipped = logs.filter((l) => l.status === 'skipped').length;

  const durationMs = Math.round(performance.now() - startTime);
  return {
    filled: finalFilled,
    failed: finalFailed,
    skipped: finalSkipped,
    total: fields.length,
    logs,
    mlAvailable,
    durationMs,
  };
}
