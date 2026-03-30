/**
 * Scans the page for all fillable form fields.
 * Detects input type purely from DOM structure.
 * Groups radio buttons and button pairs into single fields.
 *
 * Dispatches to ATS-specific scanners when the ATS is recognized,
 * falling back to a generic multi-phase scanner for unknown sites.
 */

import type { FillableField, InputType } from './types';
import aliasData from '@/data/aliases.json';

// ══════════════════════════════════════════════════════════════════════
//  ATS Detection
// ══════════════════════════════════════════════════════════════════════

export type ATSType = 'greenhouse' | 'lever' | 'ashby' | 'unknown';

export function detectATS(): ATSType {
  const host = window.location.hostname;

  if (host.includes('greenhouse.io') || host.includes('boards.greenhouse')) return 'greenhouse';
  if (host.includes('lever.co') || host.includes('jobs.lever')) return 'lever';
  if (host.includes('ashbyhq.com') || host.includes('jobs.ashby')) return 'ashby';

  // DOM fingerprints for embedded forms
  if (document.querySelector('[class*="fieldEntry"]')) return 'ashby';
  if (document.querySelector('.application-question')) return 'lever';
  if (document.querySelector('#app_body, .job-app')) return 'greenhouse';

  return 'unknown';
}

// ══════════════════════════════════════════════════════════════════════
//  Shared Utilities
// ══════════════════════════════════════════════════════════════════════

const SKIP_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'search',
  'password',
]);

function isVisible(el: HTMLElement): boolean {
  if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
  if (el.offsetParent === null) {
    // Only call getComputedStyle if offsetParent is null (position:fixed elements)
    try {
      if (getComputedStyle(el).position !== 'fixed') return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Get text content of a label, excluding any child form elements (select options, input values) */
function safeText(lbl: Element, formEl?: HTMLElement): string {
  if (!formEl || !lbl.contains(formEl)) return lbl.textContent?.trim() ?? '';
  const clone = lbl.cloneNode(true) as HTMLElement;
  for (const child of clone.querySelectorAll('select, input, textarea')) child.remove();
  return clone.textContent?.trim() ?? '';
}

/**
 * Unified label resolution. Tries all known strategies in priority order.
 * All paths use safeText() to strip child form elements from label text.
 *
 * @param el — the form element to find a label for
 * @param opts.preferQuestion — for radio/checkbox groups: prefer the question text over option text
 * @param opts.fileMode — for file inputs: check aria-labelledby, .upload-label, fallback to id
 */
function resolveLabel(
  el: HTMLElement,
  opts: { preferQuestion?: boolean; fileMode?: boolean } = {},
): string {
  // ── File-specific sources (checked first in file mode) ──
  if (opts.fileMode) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const target = document.getElementById(labelledBy);
      if (target) {
        const t = safeText(target);
        if (t) return t;
      }
    }
    const fileUpload = el.closest('.file-upload');
    if (fileUpload) {
      const ul = fileUpload.querySelector('.upload-label');
      if (ul) {
        const t = safeText(ul);
        if (t) return t;
      }
    }
    const group = el.closest('[role="group"][aria-labelledby]');
    if (group) {
      const target = document.getElementById(group.getAttribute('aria-labelledby')!);
      if (target) {
        const t = safeText(target);
        if (t) return t;
      }
    }
    if (el.id) return el.id.replace(/_/g, ' ');
  }

  // ── aria-labelledby on the element or parent group ──
  const ariaLabelledBy =
    el.getAttribute('aria-labelledby') ??
    el
      .closest('[role="group"][aria-labelledby], [role="radiogroup"][aria-labelledby]')
      ?.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const target = document.getElementById(ariaLabelledBy);
    if (target) {
      const t = safeText(target, el);
      if (t) return t;
    }
  }

  // ── aria-label ──
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // ── React Select internal label ──
  const reactLabel = el.querySelector(
    ':scope > .select__container > label, :scope label.select__label',
  );
  if (reactLabel) {
    const t = safeText(reactLabel);
    if (t) return t;
  }

  // ── Explicit label via for/id ──
  const id = el.id || (el.querySelector('input, select, textarea') as HTMLElement)?.id;
  if (id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (forLabel) {
      const t = safeText(forLabel, el);
      if (t) return t;
    }
  }

  // ── Fieldset legend ──
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const t = safeText(legend);
      if (t) return t;
    }
  }

  // ── Lever .application-question .application-label ──
  const appQ = el.closest('.application-question, .custom-question');
  if (appQ) {
    const lbl = appQ.querySelector('.application-label .text, .application-label');
    if (lbl) {
      const t = safeText(lbl, el);
      if (t) return t;
    }
  }

  // ── Wrapping label (skip in question mode — wrapping label is the option text, not the question) ──
  if (!opts.preferQuestion) {
    const wrapping = el.closest('label');
    if (wrapping) {
      const t = safeText(wrapping, el);
      if (t) return t;
    }
  }

  // ── Ashby fieldEntry / field-entry container ──
  const fieldEntry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
  if (fieldEntry) {
    const lbl = fieldEntry.querySelector(':scope > label, :scope > [class*="label"]');
    if (lbl) {
      const t = safeText(lbl, el);
      if (t) return t;
    }
  }

  // ── Walk up: check ancestors for labels and preceding headings ──
  let current: HTMLElement | null = el;
  for (let i = 0; i < (opts.preferQuestion ? 8 : 6); i++) {
    current = current?.parentElement ?? null;
    if (!current) break;

    // Preceding heading sibling (check BEFORE child labels in question mode)
    const prev = current.previousElementSibling;
    if (prev && /^H[1-6]$/.test(prev.tagName)) {
      return prev.textContent?.trim() ?? '';
    }

    // Greenhouse section headers
    if (prev?.classList.contains('field') || prev?.classList.contains('section-header')) {
      const heading = prev.querySelector('h3, h4, h5, label, .field-label');
      if (heading) {
        const t = safeText(heading);
        if (t) return t;
      }
    }

    // Direct child labels in ancestor (skip in question mode — these are often option labels)
    if (!opts.preferQuestion) {
      const lbl = current.querySelector(':scope > label, :scope > [class*="label"]');
      if (lbl) {
        const t = safeText(lbl, el);
        if (t) return t;
      }
    }
  }

  // ── Placeholder or name fallback ──
  return (el as HTMLInputElement).placeholder || el.getAttribute('name') || '';
}

/** Get the question-level label for grouped inputs (radio/checkbox groups) */
function getGroupLabel(el: HTMLInputElement): string {
  return resolveLabel(el, { preferQuestion: true });
}

/**
 * Walk up the DOM to find the nearest section heading or question text.
 * Provides context (not the field's own label) for ML classification.
 */
function getSectionHeading(el: HTMLElement): string {
  // Fieldset legend
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent?.trim()) return legend.textContent.trim();
  }

  // Lever .application-question
  const appQ = el.closest('.application-question, .custom-question');
  if (appQ) {
    const lbl = appQ.querySelector('.application-label .text, .application-label');
    if (lbl) {
      const t = safeText(lbl, el);
      if (t) return t;
    }
  }

  // aria-labelledby on parent group
  const group = el.closest('[role="group"][aria-labelledby], [role="radiogroup"][aria-labelledby]');
  if (group) {
    const target = document.getElementById(group.getAttribute('aria-labelledby')!);
    if (target?.textContent?.trim()) return target.textContent.trim();
  }

  // Walk up for preceding headings
  let current: HTMLElement | null = el.parentElement;
  for (let i = 0; i < 8; i++) {
    if (!current) break;
    const prev = current.previousElementSibling;
    if (prev && /^H[1-6]$/.test(prev.tagName)) {
      return prev.textContent?.trim() ?? '';
    }
    if (prev?.classList.contains('field') || prev?.classList.contains('section-header')) {
      const heading = prev.querySelector('h3, h4, h5, label, .field-label');
      if (heading?.textContent?.trim()) return heading.textContent.trim();
    }
    current = current.parentElement;
  }

  return '';
}

function detectType(el: HTMLElement): InputType | null {
  if (el instanceof HTMLSelectElement) return 'select';

  if (el instanceof HTMLInputElement) {
    if (SKIP_INPUT_TYPES.has(el.type)) return null;
    if (el.type === 'file') return 'file';
    if (el.type === 'checkbox') return 'checkbox';
    if (el.type === 'radio') return 'radio-group';

    // Combobox detection
    if (el.getAttribute('role') === 'combobox') return 'combobox';
    if (el.getAttribute('aria-autocomplete')) return 'combobox';
    if (el.getAttribute('aria-haspopup') === 'listbox') return 'combobox';
    if (el.closest('[class*="select__control"], [class*="select-shell"]')) return 'combobox';
    if (el.classList.contains('select__input')) return 'combobox';

    return 'text';
  }

  if (el instanceof HTMLTextAreaElement) return 'text';
  return null;
}

// Label resolution cache — cleared per scanPage() call
let _labelCache: WeakMap<HTMLElement, string> | null = null;

function cachedResolveLabel(
  el: HTMLElement,
  opts: { preferQuestion?: boolean; fileMode?: boolean } = {},
): string {
  // Only cache default (no opts) calls — specialized calls bypass cache
  if (opts.preferQuestion || opts.fileMode) return resolveLabel(el, opts);
  if (!_labelCache) _labelCache = new WeakMap();
  const cached = _labelCache.get(el);
  if (cached !== undefined) return cached;
  const result = resolveLabel(el, opts);
  _labelCache.set(el, result);
  return result;
}

/**
 * Shared: Scan individual form elements (inputs, selects, textareas).
 * Groups radio buttons by name attribute. Skips already-grouped elements.
 * Used by all ATS-specific scanners and the generic fallback.
 */
function scanIndividualElements(
  fields: FillableField[],
  seenLabels: Set<string>,
  groupedElements: Set<HTMLElement>,
): void {
  const elements = document.querySelectorAll<HTMLElement>('input, select, textarea');
  const radioGroups = new Map<string, { elements: HTMLInputElement[]; labels: string[] }>();

  for (const el of elements) {
    if ((el as HTMLInputElement).disabled) continue;
    if (groupedElements.has(el)) continue; // Already in a group

    const type = detectType(el);
    if (!type) continue;

    // File inputs are commonly hidden behind styled buttons — skip visibility check
    if (type !== 'file' && !isVisible(el)) continue;

    // Group radios by name
    if (type === 'radio-group') {
      const name = (el as HTMLInputElement).name;
      if (!name) continue;
      if (!radioGroups.has(name)) radioGroups.set(name, { elements: [], labels: [] });
      const group = radioGroups.get(name)!;
      group.elements.push(el as HTMLInputElement);
      group.labels.push(
        (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
          (el as HTMLInputElement).value ??
          '',
      );
      continue;
    }

    // Skip internal combobox/search inputs
    if (el.classList.contains('iti__search-input')) continue;
    if (type === 'text' && el.closest('[class*="select__"], [role="combobox"]')) continue;
    // Skip combobox inputs inside phone country code pickers
    if (
      type === 'combobox' &&
      el.closest(
        '.iti, [class*="iti__"], [class*="phone-input"], [class*="PhoneInput"], [class*="phone_input"]',
      )
    )
      continue;

    const label = type === 'file' ? resolveLabel(el, { fileMode: true }) : cachedResolveLabel(el);
    if (!label) continue;

    // Skip generic placeholder labels that aren't real field names
    if (/^select\.{0,3}$/i.test(label) || /^choose\.{0,3}$/i.test(label) || /^--$/i.test(label))
      continue;

    // Skip labels that are clearly EEO option values, not questions
    if (/^(male|female|non.?binary|other|yes|no|decline|prefer not)$/i.test(label)) continue;

    // Skip phone country code selects
    if (type === 'select' && el instanceof HTMLSelectElement) {
      const opts = Array.from(el.options);
      // Dial code patterns in option text or value
      if (
        opts.some((o) => /\(\+\d{1,3}\)|\+\d{1,3}\b/.test(o.text) || /^\+?\d{1,3}$/.test(o.value))
      )
        continue;
      // Inside intl-tel-input widget
      if (el.closest('.iti, [class*="iti__"], [class*="phone-input"], [class*="PhoneInput"]'))
        continue;
      // Select whose name/id suggests phone code
      if (/country.?code|phone.?country|dial|prefix/i.test(el.name || el.id || '')) continue;
      // Greenhouse pattern: select with 200+ options where values are short numbers (1, 7, 44, 91)
      // These are country dial codes, not real country dropdowns
      if (opts.length > 100) {
        const sampleValues = opts.slice(1, 20).map((o) => o.value);
        const mostlyNumeric =
          sampleValues.filter((v) => /^\d{1,4}$/.test(v)).length > sampleValues.length * 0.5;
        if (mostlyNumeric) continue;
        // Also check: if a sibling input is type="tel", this is a dial code picker
        const parent = el.closest('div, fieldset, li, section');
        if (
          parent?.querySelector('input[type="tel"], input[name*="phone" i], input[id*="phone" i]')
        )
          continue;
      }
    }

    const dedupeKey = label + ':' + type;
    if (seenLabels.has(dedupeKey)) continue;
    seenLabels.add(dedupeKey);

    const sectionHeading = getSectionHeading(el);

    // Collect native select option texts for Tier 1 options-first classification
    let groupLabels: string[] | undefined;
    if (el instanceof HTMLSelectElement && el.options.length > 1) {
      groupLabels = Array.from(el.options)
        .map((o) => o.text.trim())
        .filter((t) => t && !/^(--|select|choose)/i.test(t));
    }

    // Collect description text for combobox fields (helps determine search strategy)
    let description: string | undefined;
    if (type === 'combobox') {
      const entry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
      if (entry) {
        const desc = entry.querySelector('[class*="description"], p');
        if (desc && !desc.querySelector('input, select')) {
          description = desc.textContent?.trim()?.slice(0, 100);
        }
      }
    }

    fields.push({
      type,
      element: el,
      label,
      category: null,
      sectionHeading,
      groupLabels,
      description,
    });
  }

  // Emit grouped radio fields with proper question labels
  for (const [, group] of radioGroups) {
    if (group.elements.some((r) => r.checked)) continue;
    const questionLabel = getGroupLabel(group.elements[0]!);
    const label = questionLabel || group.labels.join(' / ').substring(0, 50);
    // Classify by question label first; only use option labels if question is empty
    const sectionHeading = getSectionHeading(group.elements[0]!);
    fields.push({
      type: 'radio-group',
      element: group.elements[0]!,
      label,
      category: null,
      groupElements: group.elements,
      groupLabels: group.labels,
      sectionHeading,
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
//  ATS-Specific Scanners
// ══════════════════════════════════════════════════════════════════════

/**
 * Greenhouse forms use:
 * - label[for] + input/select/textarea by id (standard pattern)
 * - Radio buttons grouped by name attribute
 * - EEO section with React Select comboboxes
 * - Phone country code selects with short numeric option values
 */
function scanGreenhouse(): FillableField[] {
  const fields: FillableField[] = [];
  const seenLabels = new Set<string>();
  const groupedElements = new Set<HTMLElement>();

  // Greenhouse-specific: skip phone country code selects.
  // These are large selects (200+ options with country names) adjacent to tel inputs.
  // They share the "Phone" or "Country" label with the real field.
  for (const sel of document.querySelectorAll<HTMLSelectElement>('select')) {
    if (sel.options.length < 100) continue;
    const parent = sel.closest('div, li, fieldset, section');
    if (parent?.querySelector('input[type="tel"]')) {
      groupedElements.add(sel);
    }
  }

  // Greenhouse is primarily label[for] + input[id] based.
  scanIndividualElements(fields, seenLabels, groupedElements);

  return fields;
}

/**
 * Lever forms use:
 * - .application-question containers with .application-label
 * - Radio buttons grouped by preceding <h4> headings
 * - Checkbox-based race/gender sections (individual checkboxes, no fieldset)
 * - Comboboxes via select__ class pattern
 */
function scanLever(): FillableField[] {
  const fields: FillableField[] = [];
  const seenLabels = new Set<string>();
  const groupedElements = new Set<HTMLElement>();

  // Phase: Lever multiple-choice radio groups
  // Lever hides native radio inputs with CSS — scan by container structure
  // (ul[data-qa="multiple-choice"]) regardless of radio visibility.
  scanLeverMultipleChoice(fields, groupedElements);

  // Phase: Group adjacent ungrouped checkboxes by content matching (Phase 0d)
  // Handles Lever patterns where race/gender checkboxes appear as individual
  // options without a shared fieldset or ID prefix.
  scanCheckboxesByContentMatch(fields, groupedElements);

  // Standard individual element scan (radio by name, label[for], combobox detection)
  scanIndividualElements(fields, seenLabels, groupedElements);

  return fields;
}

/**
 * Lever multiple-choice questions: <ul data-qa="multiple-choice"> with
 * CSS-hidden <input type="radio"> inside <label> + visible
 * <span class="application-answer-alternative">.
 * Native radios may fail isVisible, so detect by container structure.
 */
function scanLeverMultipleChoice(fields: FillableField[], groupedElements: Set<HTMLElement>): void {
  const containers = document.querySelectorAll<HTMLElement>('ul[data-qa="multiple-choice"]');
  for (const ul of containers) {
    const radios = Array.from(ul.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    if (radios.length < 2) continue;
    if (radios.some((r) => r.checked)) continue;

    const labels = radios.map((r) => {
      const span = r.parentElement?.querySelector('.application-answer-alternative');
      return span?.textContent?.trim() ?? r.labels?.[0]?.textContent?.trim() ?? r.value ?? '';
    });

    const question = ul.closest('.application-question, .custom-question');
    const labelEl = question?.querySelector('.application-label .text, .application-label');
    const questionLabel = labelEl?.textContent?.trim() ?? '';
    if (!questionLabel) continue;

    const sectionHeading = getSectionHeading(radios[0]!);

    fields.push({
      type: 'radio-group',
      element: radios[0]!,
      label: questionLabel,
      category: null,
      groupElements: radios,
      groupLabels: labels,
      sectionHeading,
    });
    radios.forEach((r) => groupedElements.add(r));
  }
}

/**
 * Ashby forms use:
 * - [class*="fieldEntry"] containers with child labels
 * - Button groups (Yes/No pairs)
 * - Fieldset-based radio/checkbox groups with legends
 * - Checkbox groups by shared ID prefix (DEI questions)
 * - Ungrouped radios/checkboxes in containers (Diversity Survey)
 */
function scanAshby(): FillableField[] {
  const fields: FillableField[] = [];
  const seenLabels = new Set<string>();
  const groupedElements = new Set<HTMLElement>();

  // Phase: Fieldset-based groups (radios/checkboxes in fieldsets with legends)
  scanFieldsetGroups(fields, groupedElements);

  // Phase: fieldEntry button groups and single checkboxes
  scanFieldEntryGroups(fields, groupedElements);

  // Phase: Checkboxes grouped by shared ID prefix (Ashby DEI)
  scanCheckboxesByIdPrefix(fields, groupedElements);

  // Phase: Ungrouped radios/checkboxes by parent container (Diversity Survey)
  scanUngroupedByContainer(fields, groupedElements);

  // Standard individual element scan
  scanIndividualElements(fields, seenLabels, groupedElements);

  return fields;
}

/**
 * Generic scanner: runs ALL grouping phases for unknown ATS sites.
 * This is the original 6-phase approach as fallback.
 */
function scanGeneric(): FillableField[] {
  const fields: FillableField[] = [];
  const seenLabels = new Set<string>();
  const groupedElements = new Set<HTMLElement>();

  // Phase 0: Fieldset-based groups
  scanFieldsetGroups(fields, groupedElements);

  // Phase 0b: Ashby fieldEntry button groups + single checkboxes
  scanFieldEntryGroups(fields, groupedElements);

  // Phase 0c: Checkboxes by shared ID prefix
  scanCheckboxesByIdPrefix(fields, groupedElements);

  // Phase 0d: Adjacent ungrouped checkboxes by content matching
  scanCheckboxesByContentMatch(fields, groupedElements);

  // Phase 0e: Ungrouped radios/checkboxes by parent container
  scanUngroupedByContainer(fields, groupedElements);

  // Phase 1: Individual form elements
  scanIndividualElements(fields, seenLabels, groupedElements);

  return fields;
}

// ══════════════════════════════════════════════════════════════════════
//  Grouping Phase Functions (extracted from original phases)
// ══════════════════════════════════════════════════════════════════════

/**
 * Phase 0: Scan fieldset-based groups (radios/checkboxes inside fieldsets with legends).
 * Common in Ashby forms.
 */
function scanFieldsetGroups(fields: FillableField[], groupedElements: Set<HTMLElement>): void {
  const fieldsets = document.querySelectorAll('fieldset');
  for (const fs of fieldsets) {
    const legend = fs.querySelector('legend');
    const label = legend?.textContent?.trim() ?? '';
    if (!label) continue;

    const radios = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const checkboxes = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    if (radios.length > 1) {
      const rbLabels = radios.map((r) => r.labels?.[0]?.textContent?.trim() ?? '');
      const sectionHeading = getSectionHeading(radios[0]!);
      fields.push({
        type: 'radio-group',
        element: radios[0]!,
        label,
        category: null,
        groupElements: radios,
        groupLabels: rbLabels,
        sectionHeading,
      });
      radios.forEach((r) => groupedElements.add(r));
    } else if (checkboxes.length > 1) {
      const cbLabels = checkboxes.map((c) => c.labels?.[0]?.textContent?.trim() ?? c.name ?? '');
      const sectionHeading = getSectionHeading(checkboxes[0]!);
      fields.push({
        type: 'radio-group',
        element: checkboxes[0]!,
        label,
        category: null,
        groupElements: checkboxes,
        groupLabels: cbLabels,
        sectionHeading,
      });
      checkboxes.forEach((c) => groupedElements.add(c));
    }
  }
}

/**
 * Phase 0b: Scan Ashby fieldEntry button groups and single checkboxes.
 */
function scanFieldEntryGroups(fields: FillableField[], groupedElements: Set<HTMLElement>): void {
  const fieldEntries = document.querySelectorAll('[class*="fieldEntry"], [class*="field-entry"]');
  for (const entry of fieldEntries) {
    const label =
      entry.querySelector(':scope > label, :scope > [class*="label"]')?.textContent?.trim() ?? '';
    if (!label) continue;

    // Button groups: Yes/No pairs, or any 2-6 option buttons in a field entry
    const buttons = Array.from(entry.querySelectorAll<HTMLButtonElement>('button')).filter((b) => {
      const text = b.textContent?.trim() ?? '';
      // Skip generic UI buttons (submit, save, etc.)
      return (
        text.length > 0 && text.length < 80 && !/(submit|save|cancel|close|back|next)/i.test(text)
      );
    });
    if (buttons.length >= 2 && buttons.length <= 6) {
      const sectionHeading = getSectionHeading(buttons[0]!);
      fields.push({
        type: 'button-group',
        element: buttons[0]!,
        label,
        category: null,
        groupElements: buttons,
        groupLabels: buttons.map((b) => b.textContent?.trim() ?? ''),
        sectionHeading,
      });
      // Mark ALL inputs inside this entry as grouped so scanIndividualElements
      // doesn't pick up hidden checkboxes/radios as separate fields.
      entry.querySelectorAll('input').forEach((inp) => groupedElements.add(inp as HTMLElement));
      continue;
    }

    // Single checkboxes with fieldEntry context (consent/acknowledgement)
    const checkboxes = entry.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (checkboxes.length === 1 && !groupedElements.has(checkboxes[0]!)) {
      const sectionHeading = getSectionHeading(checkboxes[0]!);
      fields.push({
        type: 'checkbox',
        element: checkboxes[0]!,
        label,
        category: null,
        sectionHeading,
      });
      groupedElements.add(checkboxes[0]!);
    }
  }
}

/**
 * Phase 0c: Group checkboxes by shared ID prefix (Ashby DEI groups).
 * Ashby puts related checkboxes under a container with a shared name-prefix
 * (e.g. "74d3a3f5-..._8d7dcc65-..." for all options of a single question).
 */
function scanCheckboxesByIdPrefix(
  fields: FillableField[],
  groupedElements: Set<HTMLElement>,
): void {
  const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const cbByName = new Map<string, HTMLInputElement[]>();
  for (const cb of allCheckboxes) {
    if (groupedElements.has(cb)) continue;
    // Use the id prefix up to the last segment as group key (Ashby pattern: parentId_questionId-labeled-checkbox-N)
    const id = cb.id || '';
    const nameKey = id.replace(/-labeled-checkbox-\d+$/, '');
    if (!nameKey) continue;
    if (!cbByName.has(nameKey)) cbByName.set(nameKey, []);
    cbByName.get(nameKey)!.push(cb);
  }
  for (const [, cbs] of cbByName) {
    if (cbs.length < 2) continue; // Only group multi-checkbox questions
    if (cbs.some((c) => groupedElements.has(c))) continue;

    // Find the parent question label — walk up from first checkbox
    let label = '';
    const container = cbs[0]!.closest('[class*="fieldEntry"], [class*="field-entry"]');
    if (container) {
      label =
        container.querySelector(':scope > label, :scope > [class*="label"]')?.textContent?.trim() ??
        '';
    }
    if (!label) {
      label = getSectionHeading(cbs[0]!);
    }
    if (!label) continue;

    const cbLabels = cbs.map((c) => c.labels?.[0]?.textContent?.trim() ?? c.name ?? '');
    const sectionHeading = getSectionHeading(cbs[0]!);
    fields.push({
      type: 'radio-group',
      element: cbs[0]!,
      label,
      category: null,
      groupElements: cbs,
      groupLabels: cbLabels,
      sectionHeading,
    });
    cbs.forEach((c) => groupedElements.add(c));
  }
}

/**
 * Phase 0d: Group adjacent ungrouped checkboxes by content matching.
 * Handles Lever/Eightfold patterns where race/gender checkboxes appear as
 * individual options without a shared fieldset or ID prefix.
 */
function scanCheckboxesByContentMatch(
  fields: FillableField[],
  groupedElements: Set<HTMLElement>,
): void {
  const OPTION_SETS: { category: string; aliasKey: string; questionLabel: string }[] = [
    { category: 'race', aliasKey: 'race', questionLabel: 'Race / Ethnicity' },
    { category: 'gender', aliasKey: 'gender', questionLabel: 'Gender' },
    { category: 'veteranStatus', aliasKey: 'veteran', questionLabel: 'Veteran Status' },
    { category: 'disabilityStatus', aliasKey: 'disability', questionLabel: 'Disability Status' },
  ];

  // Build a lookup: normalized option text -> category
  const optionToCategory = new Map<string, string>();
  for (const { category, aliasKey } of OPTION_SETS) {
    const entries = (aliasData as Record<string, Record<string, string[]>>)[aliasKey];
    if (!entries) continue;
    for (const [canonical, aliases] of Object.entries(entries)) {
      optionToCategory.set(canonical.toLowerCase(), category);
      for (const alias of aliases) {
        optionToCategory.set(alias.toLowerCase(), category);
      }
    }
  }

  // Collect remaining ungrouped checkboxes
  const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const ungroupedCbs: HTMLInputElement[] = [];
  for (const cb of allCheckboxes) {
    if (groupedElements.has(cb)) continue;
    if (cb.disabled) continue;
    ungroupedCbs.push(cb);
  }

  // Group by closest shared container (walk up to find a common parent with multiple checkboxes)
  const cbContainerGroups = new Map<HTMLElement, HTMLInputElement[]>();
  for (const cb of ungroupedCbs) {
    let container: HTMLElement | null = cb.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!container) break;
      const cbsInContainer = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      if (cbsInContainer.length >= 3) {
        if (!cbContainerGroups.has(container)) cbContainerGroups.set(container, []);
        const group = cbContainerGroups.get(container)!;
        if (!group.includes(cb)) group.push(cb);
        break;
      }
      container = container.parentElement;
    }
  }

  // Check each container group for content-matched options
  for (const [container, cbs] of cbContainerGroups) {
    if (cbs.length < 3) continue;
    if (cbs.some((c) => groupedElements.has(c))) continue;

    const cbLabels = cbs.map(
      (c) => c.labels?.[0]?.textContent?.trim() ?? c.parentElement?.textContent?.trim() ?? '',
    );

    // Count how many labels match a known category
    const categoryCounts = new Map<string, number>();
    for (const lbl of cbLabels) {
      const cat = optionToCategory.get(lbl.toLowerCase());
      if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    // If 3+ labels match the same category, group them
    for (const [cat, count] of categoryCounts) {
      if (count < 3) continue;
      const optSet = OPTION_SETS.find((o) => o.category === cat);
      if (!optSet) continue;

      // Find a heading for this group
      let questionLabel = '';
      const heading = container.querySelector(
        ':scope > label, :scope > h3, :scope > h4, :scope > [class*="label"]',
      );
      if (heading?.textContent?.trim()) {
        questionLabel = heading.textContent.trim();
      }
      if (!questionLabel) {
        // Check preceding sibling heading
        const prev = container.previousElementSibling;
        if (
          prev &&
          (/^H[1-6]$/.test(prev.tagName) || prev.querySelector('label, [class*="label"]'))
        ) {
          questionLabel = prev.textContent?.trim() ?? '';
        }
      }
      if (!questionLabel) questionLabel = optSet.questionLabel;

      const sectionHeading = getSectionHeading(cbs[0]!);
      fields.push({
        type: 'radio-group',
        element: cbs[0]!,
        label: questionLabel,
        category: cat,
        groupElements: cbs,
        groupLabels: cbLabels,
        sectionHeading,
      });
      cbs.forEach((c) => groupedElements.add(c));
      break; // One category per container
    }
  }
}

/**
 * Phase 0e: Group ungrouped radios/checkboxes by parent container.
 * Handles Ashby Diversity Survey and similar forms where radios/checkboxes
 * have no name attribute, no fieldset, no fieldEntry class, but share a
 * common parent container with a question label.
 */
function scanUngroupedByContainer(
  fields: FillableField[],
  groupedElements: Set<HTMLElement>,
): void {
  const allRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const ungroupedInputs = [...Array.from(allRadios), ...Array.from(allCheckboxes)];
  const containerGroups = new Map<
    HTMLElement,
    { inputs: HTMLInputElement[]; type: 'radio' | 'checkbox' }
  >();

  for (const input of ungroupedInputs) {
    if (groupedElements.has(input)) continue;
    if (input.disabled) continue;
    if (!isVisible(input)) continue;

    // Walk up to find a container with a question-like label and multiple sibling inputs
    let container: HTMLElement | null = input.parentElement;
    for (let depth = 0; depth < 5 && container; depth++) {
      const siblings = container.querySelectorAll<HTMLInputElement>(`input[type="${input.type}"]`);
      const ungroupedSiblings = Array.from(siblings).filter((s) => !groupedElements.has(s));
      if (ungroupedSiblings.length >= 2) {
        const key = container;
        if (!containerGroups.has(key)) {
          containerGroups.set(key, { inputs: [], type: input.type as 'radio' | 'checkbox' });
        }
        const group = containerGroups.get(key)!;
        if (!group.inputs.includes(input)) group.inputs.push(input);
        break;
      }
      container = container.parentElement;
    }
  }

  for (const [container, { inputs }] of containerGroups) {
    if (inputs.length < 2) continue;
    if (inputs.some((i) => groupedElements.has(i))) continue;

    // Find the question label — look for a label/heading that's NOT a radio option label
    let questionLabel = '';

    // Direct child label/heading of container
    for (const child of container.children) {
      if (child instanceof HTMLElement && !child.querySelector('input')) {
        const text = child.textContent?.trim() ?? '';
        // Must be a question (longer than typical option labels, or contains '?')
        if (text.length > 10 || text.includes('?')) {
          questionLabel = text;
          break;
        }
      }
    }

    // Try preceding sibling heading
    if (!questionLabel) {
      const prev = container.previousElementSibling;
      if (prev && /^(H[1-6]|LABEL|P|SPAN|DIV)$/.test(prev.tagName)) {
        const text = prev.textContent?.trim() ?? '';
        if (text.length > 5 && !prev.querySelector('input')) {
          questionLabel = text;
        }
      }
    }

    if (!questionLabel) continue;

    const inputLabels = inputs.map(
      (i) =>
        i.labels?.[0]?.textContent?.trim() ?? i.parentElement?.textContent?.trim() ?? i.value ?? '',
    );

    const sectionHeading = getSectionHeading(inputs[0]!);

    fields.push({
      type: 'radio-group',
      element: inputs[0]!,
      label: questionLabel,
      category: null,
      groupElements: inputs,
      groupLabels: inputLabels,
      sectionHeading,
    });
    inputs.forEach((i) => groupedElements.add(i));
  }
}

// ══════════════════════════════════════════════════════════════════════
//  Public API
// ══════════════════════════════════════════════════════════════════════

export function scanPage(): FillableField[] {
  _labelCache = new WeakMap(); // Reset cache per scan

  const ats = detectATS();

  let fields: FillableField[];
  switch (ats) {
    case 'greenhouse':
      fields = scanGreenhouse();
      break;
    case 'lever':
      fields = scanLever();
      break;
    case 'ashby':
      fields = scanAshby();
      break;
    default:
      fields = scanGeneric();
      break;
  }
  return fields;
}
