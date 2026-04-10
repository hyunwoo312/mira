import type { ScanResult, ATSName, WidgetType, InputType } from '../types';
import aliasData from '@/data/aliases.json';

const SKIP_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'search',
  'password',
]);

export function isVisible(el: HTMLElement): boolean {
  if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
  if (el.offsetParent === null) {
    try {
      if (getComputedStyle(el).position !== 'fixed') return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Get text content of a label, excluding any child form elements. */
export function safeText(lbl: Element, formEl?: HTMLElement): string {
  if (!formEl || !lbl.contains(formEl)) return lbl.textContent?.trim() ?? '';
  const clone = lbl.cloneNode(true) as HTMLElement;
  for (const child of clone.querySelectorAll('select, input, textarea')) child.remove();
  return clone.textContent?.trim() ?? '';
}

/**
 * Unified label resolution. Tries all known strategies in priority order.
 * All paths use safeText() to strip child form elements from label text.
 */
export function resolveLabel(
  el: HTMLElement,
  opts: { preferQuestion?: boolean; fileMode?: boolean } = {},
): string {
  // ── File-specific sources ──
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
    // Ashby/generic: file input inside a fieldEntry container with a label
    const fieldEntry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
    if (fieldEntry) {
      const lbl = fieldEntry.querySelector(':scope > label, :scope > [class*="label"]');
      if (lbl) {
        const t = safeText(lbl);
        if (t) return t;
      }
    }
    // Walk up to find nearest heading or label text
    // Skip generic file-button labels like "Attach", "Browse", "Choose File"
    const GENERIC_FILE_LABELS = /^(attach|browse|choose\s*file|upload|select\s*file|add\s*file)$/i;
    let fileParent: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 5 && fileParent; i++) {
      // Check for descriptive span/text (e.g., Greenhouse embedded: <span>Cover Letter</span>)
      const desc = fileParent.querySelector(
        ':scope > span:not([class*="required"]), :scope > [class*="label"], :scope > h3, :scope > h4',
      );
      if (desc) {
        const t = safeText(desc);
        if (t && !GENERIC_FILE_LABELS.test(t)) return t;
      }
      const lbl = fileParent.querySelector(':scope > label');
      if (lbl) {
        const t = safeText(lbl);
        if (t && !GENERIC_FILE_LABELS.test(t)) return t;
      }
      fileParent = fileParent.parentElement;
    }
    if (el.id) return el.id.replace(/_/g, ' ').trim();
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

  // ── Question-level labels first in preferQuestion mode ──
  if (opts.preferQuestion) {
    const fieldset = el.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        const t = safeText(legend);
        if (t) return t;
      }
      const questionLabel = fieldset.querySelector(':scope > label, :scope > [class*="label"]');
      if (questionLabel) {
        const t = safeText(questionLabel, el);
        if (t) return t;
      }
    }

    const fieldEntry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
    if (fieldEntry) {
      const lbl = fieldEntry.querySelector(':scope > label, :scope > [class*="label"]');
      if (lbl) {
        const t = safeText(lbl, el);
        if (t) return t;
      }
    }

    const appQ = el.closest('.application-question, .custom-question');
    if (appQ) {
      const lbl = appQ.querySelector('.application-label .text, .application-label');
      if (lbl) {
        const t = safeText(lbl, el);
        if (t) return t;
      }
    }
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

  // ── Fieldset legend (non-preferQuestion mode) ──
  if (!opts.preferQuestion) {
    const fieldset = el.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        const t = safeText(legend);
        if (t) return t;
      }
    }
  }

  // ── Lever .application-question (non-preferQuestion mode) ──
  if (!opts.preferQuestion) {
    const appQ = el.closest('.application-question, .custom-question');
    if (appQ) {
      const lbl = appQ.querySelector('.application-label .text, .application-label');
      if (lbl) {
        const t = safeText(lbl, el);
        if (t) return t;
      }
    }
  }

  // ── Wrapping label ──
  if (!opts.preferQuestion) {
    const wrapping = el.closest('label');
    if (wrapping) {
      const t = safeText(wrapping, el);
      if (t) return t;
    }
  }

  // ── Ashby fieldEntry container (non-preferQuestion mode) ──
  if (!opts.preferQuestion) {
    const fieldEntry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
    if (fieldEntry) {
      const lbl = fieldEntry.querySelector(':scope > label, :scope > [class*="label"]');
      if (lbl) {
        const t = safeText(lbl, el);
        if (t) return t;
      }
    }
  }

  // ── Walk up: check ancestors for labels and preceding headings ──
  let current: HTMLElement | null = el;
  for (let i = 0; i < (opts.preferQuestion ? 8 : 6); i++) {
    current = current?.parentElement ?? null;
    if (!current) break;

    const prev = current.previousElementSibling;
    if (prev && /^H[1-6]$/.test(prev.tagName)) {
      return prev.textContent?.trim() ?? '';
    }

    if (prev?.classList.contains('field') || prev?.classList.contains('section-header')) {
      const heading = prev.querySelector('h3, h4, h5, label, .field-label');
      if (heading) {
        const t = safeText(heading);
        if (t) return t;
      }
    }

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

/** Get the question-level label for grouped inputs (radio/checkbox groups). */
export function getGroupLabel(el: HTMLInputElement): string {
  return resolveLabel(el, { preferQuestion: true });
}

/**
 * Walk up the DOM to find the nearest section heading or question text.
 * Provides context (not the field's own label) for ML classification.
 */
export function getSectionHeading(el: HTMLElement): string {
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent?.trim()) return legend.textContent.trim();
  }

  const appQ = el.closest('.application-question, .custom-question');
  if (appQ) {
    const lbl = appQ.querySelector('.application-label .text, .application-label');
    if (lbl) {
      const t = safeText(lbl, el);
      if (t) return t;
    }
  }

  const group = el.closest('[role="group"][aria-labelledby], [role="radiogroup"][aria-labelledby]');
  if (group) {
    const target = document.getElementById(group.getAttribute('aria-labelledby')!);
    if (target?.textContent?.trim()) return target.textContent.trim();
  }

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

/** Detect the coarse InputType from a DOM element (used internally). */
export function detectType(el: HTMLElement): InputType | null {
  if (el instanceof HTMLSelectElement) return 'select';

  if (el instanceof HTMLInputElement) {
    if (SKIP_INPUT_TYPES.has(el.type)) return null;
    if (el.type === 'file') return 'file';
    if (el.type === 'checkbox') return 'checkbox';
    if (el.type === 'radio') return 'radio-group';

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

/**
 * Resolve the granular WidgetType for a field.
 * Merges the old detectType + detectWidget into one function.
 * Called at scan time so the filler never needs to re-inspect the DOM.
 */
export function resolveWidgetType(
  el: HTMLElement,
  inputType: InputType,
  groupElements?: HTMLElement[],
): WidgetType {
  if (inputType === 'file') return 'file-upload';
  if (inputType === 'button-group') return 'button-group';
  if (inputType === 'radio-group') {
    if (groupElements?.[0] instanceof HTMLInputElement && groupElements[0].type === 'checkbox') {
      return 'checkbox-group';
    }
    return 'radio-group';
  }
  if (inputType === 'checkbox') return 'checkbox';
  if (el instanceof HTMLSelectElement) return 'native-select';
  if (el instanceof HTMLTextAreaElement) return 'plain-text';

  // Datepicker (check BEFORE combobox)
  if (el instanceof HTMLInputElement && el.type === 'date') return 'datepicker';
  if (
    el.closest('.react-datepicker__input-container, [class*="datepicker"], [class*="DatePicker"]')
  )
    return 'datepicker';

  // React Select
  if (el.classList.contains('select__input') || el.closest('[class*="select__control"]'))
    return 'react-select';

  // Generic autocomplete
  if (
    el.getAttribute('role') === 'combobox' ||
    el.getAttribute('aria-autocomplete') ||
    el.getAttribute('aria-haspopup') === 'listbox'
  ) {
    return 'autocomplete';
  }
  if (inputType === 'combobox') return 'autocomplete';

  return 'plain-text';
}

let _labelCache: WeakMap<HTMLElement, string> | null = null;

export function resetLabelCache(): void {
  _labelCache = new WeakMap();
}

export function cachedResolveLabel(
  el: HTMLElement,
  opts: { preferQuestion?: boolean; fileMode?: boolean } = {},
): string {
  if (opts.preferQuestion || opts.fileMode) return resolveLabel(el, opts);
  if (!_labelCache) _labelCache = new WeakMap();
  const cached = _labelCache.get(el);
  if (cached !== undefined) return cached;
  const result = resolveLabel(el, opts);
  _labelCache.set(el, result);
  return result;
}

/** Phase: Scan fieldset-based groups (radios/checkboxes inside fieldsets with legends). */
export function scanFieldsetGroups(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const fieldsets = document.querySelectorAll('fieldset');
  for (const fs of fieldsets) {
    const legend = fs.querySelector('legend');
    // Ashby fieldsets use <label> as the question heading instead of <legend>
    const labelEl = legend ?? fs.querySelector(':scope > label, :scope > [class*="label"]');
    const label = labelEl ? safeText(labelEl) : '';
    if (!label) continue;

    const radios = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
      (r) => !r.disabled && isVisible(r),
    );
    const checkboxes = Array.from(
      fs.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).filter((c) => !c.disabled && isVisible(c));

    if (radios.length > 1) {
      const rbLabels = radios.map((r) => r.labels?.[0]?.textContent?.trim() ?? '');
      const sectionHeading = getSectionHeading(radios[0]!);
      const widgetType = resolveWidgetType(radios[0]!, 'radio-group', radios);
      results.push({
        widgetType,
        element: radios[0]!,
        label,
        category: null,
        ats,
        groupElements: radios,
        groupLabels: rbLabels,
        sectionHeading,
      });
      radios.forEach((r) => groupedElements.add(r));
    } else if (checkboxes.length > 1) {
      const cbLabels = checkboxes.map((c) => c.labels?.[0]?.textContent?.trim() ?? c.name ?? '');
      const sectionHeading = getSectionHeading(checkboxes[0]!);
      const widgetType = resolveWidgetType(checkboxes[0]!, 'radio-group', checkboxes);
      results.push({
        widgetType,
        element: checkboxes[0]!,
        label,
        category: null,
        ats,
        groupElements: checkboxes,
        groupLabels: cbLabels,
        sectionHeading,
      });
      checkboxes.forEach((c) => groupedElements.add(c));
    }
  }
}

const OPTION_SETS: { category: string; aliasKey: string; questionLabel: string }[] = [
  { category: 'race', aliasKey: 'race', questionLabel: 'Race / Ethnicity' },
  { category: 'gender', aliasKey: 'gender', questionLabel: 'Gender' },
  { category: 'veteranStatus', aliasKey: 'veteran', questionLabel: 'Veteran Status' },
  { category: 'disabilityStatus', aliasKey: 'disability', questionLabel: 'Disability Status' },
];

let _optionToCategory: Map<string, string> | null = null;
function getOptionToCategory(): Map<string, string> {
  if (_optionToCategory) return _optionToCategory;
  _optionToCategory = new Map();
  for (const { category, aliasKey } of OPTION_SETS) {
    const entries = (aliasData as Record<string, Record<string, string[]>>)[aliasKey];
    if (!entries) continue;
    for (const [canonical, aliases] of Object.entries(entries)) {
      _optionToCategory.set(canonical.toLowerCase(), category);
      for (const alias of aliases) {
        _optionToCategory.set(alias.toLowerCase(), category);
      }
    }
  }
  return _optionToCategory;
}

/** Phase: Group adjacent ungrouped checkboxes by content matching (Lever/Eightfold). */
export function scanCheckboxesByContentMatch(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const optionToCategory = getOptionToCategory();

  const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const ungroupedCbs: HTMLInputElement[] = [];
  for (const cb of allCheckboxes) {
    if (groupedElements.has(cb)) continue;
    if (cb.disabled) continue;
    ungroupedCbs.push(cb);
  }

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

  for (const [container, cbs] of cbContainerGroups) {
    if (cbs.length < 3) continue;
    if (cbs.some((c) => groupedElements.has(c))) continue;

    const cbLabels = cbs.map(
      (c) => c.labels?.[0]?.textContent?.trim() ?? c.parentElement?.textContent?.trim() ?? '',
    );

    const categoryCounts = new Map<string, number>();
    for (const lbl of cbLabels) {
      const cat = optionToCategory.get(lbl.toLowerCase());
      if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    for (const [cat, count] of categoryCounts) {
      if (count < 3) continue;
      const optSet = OPTION_SETS.find((o) => o.category === cat);
      if (!optSet) continue;

      let questionLabel = '';
      const heading = container.querySelector(
        ':scope > label, :scope > h3, :scope > h4, :scope > [class*="label"]',
      );
      if (heading?.textContent?.trim()) {
        questionLabel = heading.textContent.trim();
      }
      if (!questionLabel) {
        const prev = container.previousElementSibling;
        if (
          prev &&
          (/^H[1-6]$/.test(prev.tagName) || prev.querySelector('label, [class*="label"]'))
        ) {
          questionLabel = prev.textContent?.trim() ?? '';
        }
      }
      if (!questionLabel) questionLabel = optSet.questionLabel;

      // Override: if question label or container text mentions "pronoun", this is
      // a pronouns field even though He/Him, She/Her, They/Them match gender aliases.
      // Also detect by option content: if ALL options are pronoun-shaped (X/Y format),
      // it's pronouns not gender.
      const containerText = container.textContent?.toLowerCase() ?? '';
      const allPronounShaped =
        cbLabels.length >= 2 && cbLabels.every((l) => /^(he|she|they|ze|xe|it)\//i.test(l.trim()));
      const isPronounField =
        /pronoun/i.test(questionLabel) || /pronoun/i.test(containerText) || allPronounShaped;
      const finalCategory = isPronounField ? 'pronouns' : cat;

      const sectionHeading = getSectionHeading(cbs[0]!);
      const widgetType = resolveWidgetType(cbs[0]!, 'radio-group', cbs);
      results.push({
        widgetType,
        element: cbs[0]!,
        label: questionLabel,
        category: finalCategory,
        classifiedBy: 'options',
        ats,
        groupElements: cbs,
        groupLabels: cbLabels,
        sectionHeading,
      });
      cbs.forEach((c) => groupedElements.add(c));
      break;
    }
  }
}

/** Phase: Group ungrouped radios/checkboxes by parent container (Ashby Diversity). */
export function scanUngroupedByContainer(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
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

    let questionLabel = '';

    for (const child of container.children) {
      if (child instanceof HTMLElement && !child.querySelector('input')) {
        const text = child.textContent?.trim() ?? '';
        if (text.length > 10 || text.includes('?')) {
          questionLabel = text;
          break;
        }
      }
    }

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
    const widgetType = resolveWidgetType(inputs[0]!, 'radio-group', inputs);

    results.push({
      widgetType,
      element: inputs[0]!,
      label: questionLabel,
      category: null,
      ats,
      groupElements: inputs,
      groupLabels: inputLabels,
      sectionHeading,
    });
    inputs.forEach((i) => groupedElements.add(i));
  }
}

/**
 * Shared: Scan individual form elements (inputs, selects, textareas).
 * Groups radio buttons by name attribute. Skips already-grouped elements.
 */
export function scanIndividualElements(
  results: ScanResult[],
  seenLabels: Set<string>,
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const elements = document.querySelectorAll<HTMLElement>('input, select, textarea');
  const radioGroups = new Map<string, { elements: HTMLInputElement[]; labels: string[] }>();

  for (const el of elements) {
    if ((el as HTMLInputElement).disabled) continue;
    if (groupedElements.has(el)) continue;

    const type = detectType(el);
    if (!type) continue;

    // File inputs are commonly hidden behind styled buttons — skip visibility check.
    // Select elements with options are rarely truly hidden — relax visibility check
    // to handle embedded forms (e.g., Greenhouse on HubSpot) where computed layout
    // may report zero dimensions despite the select being interactive.
    const skipVisibility =
      type === 'file' ||
      (type === 'select' && el instanceof HTMLSelectElement && el.options.length > 1);
    if (!skipVisibility && !isVisible(el)) continue;

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
    // Skip intl-tel-input dial-code pickers
    if (type === 'combobox' && el.closest('.iti, [class*="iti__"]')) continue;
    // Skip internal (no id) combobox elements inside phone containers;
    // named elements like #country are real fields that need filling.
    if (
      type === 'combobox' &&
      !el.id &&
      el.closest('[class*="phone-input"], [class*="PhoneInput"], [class*="phone_input"]')
    )
      continue;

    const label = type === 'file' ? resolveLabel(el, { fileMode: true }) : cachedResolveLabel(el);
    if (!label) continue;

    // Skip generic placeholder labels
    if (/^select\.{0,3}$/i.test(label) || /^choose\.{0,3}$/i.test(label) || /^--$/i.test(label))
      continue;

    // Skip labels that are EEO option values
    if (/^(male|female|non.?binary|other|yes|no|decline|prefer not)$/i.test(label)) continue;

    // Skip phone country code selects
    if (type === 'select' && el instanceof HTMLSelectElement) {
      const opts = Array.from(el.options);
      // Require + prefix in values (not bare digits like "0"/"1" which are Yes/No)
      // or phone-code patterns in option text like "(+1)" or "+44"
      if (opts.some((o) => /\(\+\d{1,3}\)|\+\d{1,3}\b/.test(o.text) || /^\+\d{1,3}$/.test(o.value)))
        continue;
      if (el.closest('.iti, [class*="iti__"], [class*="phone-input"], [class*="PhoneInput"]'))
        continue;
      if (/country.?code|phone.?country|dial|prefix/i.test(el.name || el.id || '')) continue;
      if (opts.length > 100) {
        const sampleValues = opts.slice(1, 20).map((o) => o.value);
        const mostlyNumeric =
          sampleValues.filter((v) => /^\d{1,4}$/.test(v)).length > sampleValues.length * 0.5;
        if (mostlyNumeric) continue;
        const parent = el.closest('div, fieldset, li, section');
        if (
          parent?.querySelector('input[type="tel"], input[name*="phone" i], input[id*="phone" i]')
        )
          continue;
      }
    }

    const sectionHeading = getSectionHeading(el);
    const dedupeKey = label + ':' + type + ':' + sectionHeading;
    if (seenLabels.has(dedupeKey)) continue;
    seenLabels.add(dedupeKey);

    const widgetType = resolveWidgetType(el, type);

    // Collect native select option texts
    let groupLabels: string[] | undefined;
    if (el instanceof HTMLSelectElement && el.options.length > 1) {
      groupLabels = Array.from(el.options)
        .map((o) => o.text.trim())
        .filter((t) => t && !/^(--|select|choose)/i.test(t));
    }

    // Collect description text for combobox fields
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

    results.push({
      widgetType,
      element: el,
      label,
      category: null,
      ats,
      sectionHeading,
      groupLabels,
      description,
    });
  }

  // Emit grouped radio fields
  for (const [, group] of radioGroups) {
    const questionLabel = getGroupLabel(group.elements[0]!);
    const label = questionLabel || group.labels.join(' / ').substring(0, 50);
    const sectionHeading = getSectionHeading(group.elements[0]!);
    const widgetType = resolveWidgetType(group.elements[0]!, 'radio-group', group.elements);
    results.push({
      widgetType,
      element: group.elements[0]!,
      label,
      category: null,
      ats,
      groupElements: group.elements,
      groupLabels: group.labels,
      sectionHeading,
    });
  }
}

/**
 * Classify ambiguous fields by section context. Fields like "Start date month",
 * "Location", "Description" could belong to education or work sections.
 * Walks up the DOM from each unclassified field to find the nearest section heading
 * and assigns the appropriate prefixed category.
 */
export function classifyByContext(results: ScanResult[]): void {
  for (const field of results) {
    if (field.category) continue;

    const label = field.label.toLowerCase().trim();
    const heading = (field.sectionHeading || getSectionHeading(field.element)).toLowerCase();
    // Also check ancestor class names/IDs for context (Greenhouse uses education--container, etc.)
    let ancestorContext = '';
    let ancestor = field.element.parentElement;
    for (let i = 0; i < 8 && ancestor; i++) {
      const cls = (ancestor.className || '') + ' ' + (ancestor.id || '');
      if (/education|school|degree|academic/i.test(cls)) {
        ancestorContext = 'education';
        break;
      }
      if (/work|experience|employment|job/i.test(cls)) {
        ancestorContext = 'work';
        break;
      }
      ancestor = ancestor.parentElement;
    }
    const section = heading || ancestorContext;
    const isEdu = /education|school|degree|academic|university|college/i.test(section);
    const isWork = /work|experience|employment|job|company|employer/i.test(section);

    // Date month/year fields
    if (/^(start|end|from|to)\s*(date\s*)?(month|year)$/i.test(field.label)) {
      const isStart = /^(start|from)/i.test(label);
      const isMonth = /month/i.test(label);
      if (isEdu) {
        field.category = isStart
          ? isMonth
            ? 'eduStartMonth'
            : 'eduStartYear'
          : isMonth
            ? 'eduGradMonth'
            : 'eduGradYear';
        field.classifiedBy = 'heuristic';
      } else if (isWork) {
        field.category = isStart
          ? isMonth
            ? 'workStartMonth'
            : 'workStartYear'
          : isMonth
            ? 'workEndMonth'
            : 'workEndYear';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // Generic "Start date" / "End date" (combined month/year)
    if (/^(start|end|from|to)\s*date$/i.test(field.label)) {
      if (isEdu) {
        field.category = /^(start|from)/i.test(label) ? 'eduStartYear' : 'graduationDate';
        field.classifiedBy = 'heuristic';
      } else if (isWork) {
        field.category = /^(start|from)/i.test(label) ? 'workStartDate' : 'workEndDate';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "Location" in work section → workLocation, but only when we have a real heading
    // (not just ancestor class hints, which are unreliable for this ambiguous label)
    if (/^location$/i.test(field.label)) {
      if (isWork && heading) {
        field.category = 'workLocation';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "Description" in work section → workDescription
    if (/^description$/i.test(field.label)) {
      if (isWork) {
        field.category = 'workDescription';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "Name" / "Title" — depends on section (require real heading, not just ancestor class hints)
    if (/^name$/i.test(field.label)) {
      if (isWork && heading) {
        field.category = 'company';
        field.classifiedBy = 'heuristic';
      } else if (isEdu && heading) {
        field.category = 'school';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }
    if (/^title$/i.test(field.label)) {
      if (isWork && heading) {
        field.category = 'jobTitle';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "Discipline" / "Major" / "Field of Study" in education section
    if (/^(discipline|major|field.?of.?study|area.?of.?study|concentration)$/i.test(field.label)) {
      if (isEdu) {
        field.category = 'fieldOfStudy';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "Degree" in education section
    if (/^degree$/i.test(field.label)) {
      if (isEdu) {
        field.category = 'degree';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }

    // "GPA" / "Grade" in education section
    if (/^(gpa|grade|grade.*average)$/i.test(field.label)) {
      if (isEdu) {
        field.category = 'gpa';
        field.classifiedBy = 'heuristic';
      }
      continue;
    }
  }
}
