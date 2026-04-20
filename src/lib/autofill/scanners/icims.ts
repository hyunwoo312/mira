import type { ATSScanner, ScanResult, WidgetType } from '../types';
import {
  scanFieldsetGroups,
  scanIndividualElements,
  classifyByContext,
  resolveLabel,
} from './shared';
import { lookupIcimsCategory, detectIcimsWidget, type IcimsWidgetHint } from '../icims/utils';

function applyStaticMap(results: ScanResult[]): void {
  for (const field of results) {
    if (field.category) continue;
    const rawId = field.element.id || field.element.getAttribute('name') || '';
    if (!rawId) continue;
    // Composite widgets carry a suffixed id (`..._Mon` for date triples,
    // `..._icimsDropdown` for typeaheads). Strip the suffix so the base
    // (e.g. "AddressCountry", "GraduationDate") matches the map.
    let id = rawId;
    if (field.widgetType === 'icims-date') {
      id = id.replace(/_(Mon|Month|Dat|Date|Day|Yea|Year)$/, '');
    } else if (field.widgetType === 'icims-typeahead') {
      id = id.replace(/_icimsDropdown$/, '');
    }
    const category = lookupIcimsCategory(id);
    if (category) {
      field.category = category === '__skip__' ? '__skip__' : category;
      field.classifiedBy = 'static-map';
    }
  }
}

const DATE_PART_SUFFIX = /_(Mon|Month|Dat|Date|Day|Yea|Year)$/;

const MONTH_INPUT_SEL =
  'input[id$="_Mon"], select[id$="_Mon"], input[id$="_Month"], select[id$="_Month"]';

/**
 * Walk up to find the nearest ancestor that contains all three date-triple
 * siblings (Month/Day/Year). Each date part may be wrapped in its own
 * `.iCIMS_TextInputField`, so the naive per-field container check fails —
 * we need to go up one more level to reach the composite row.
 */
function commonAncestor(a: HTMLElement, b: HTMLElement): HTMLElement | null {
  const ancestors = new Set<HTMLElement>();
  let cur: HTMLElement | null = a;
  while (cur) {
    ancestors.add(cur);
    cur = cur.parentElement;
  }
  cur = b;
  while (cur) {
    if (ancestors.has(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Locate the other two parts of the date triple for `el`, then return their
 * tightest common ancestor. Using the ID base (everything before the suffix)
 * keeps Start Date and End Date siblings distinct when they live in the same
 * outer section wrapper.
 */
function findDateTripleSiblings(
  el: HTMLElement,
): { container: HTMLElement; monthEl: HTMLElement } | null {
  const base = el.id.replace(DATE_PART_SUFFIX, '');
  if (!base) return null;

  const monthEl =
    document.getElementById(`${base}_Mon`) ?? document.getElementById(`${base}_Month`);
  const dayEl =
    document.getElementById(`${base}_Dat`) ??
    document.getElementById(`${base}_Date`) ??
    document.getElementById(`${base}_Day`);
  const yearEl = document.getElementById(`${base}_Yea`) ?? document.getElementById(`${base}_Year`);

  if (!monthEl || !yearEl) return null;
  const primary =
    monthEl instanceof HTMLInputElement || monthEl instanceof HTMLSelectElement
      ? monthEl
      : (dayEl ?? yearEl);

  let ancestor = commonAncestor(monthEl, yearEl);
  if (dayEl && ancestor) ancestor = commonAncestor(ancestor, dayEl);
  if (!ancestor) return null;
  return { container: ancestor, monthEl: primary as HTMLElement };
}

const DATE_PART_WORD = /^(month|day|date|year|mon|dat|yea)\s*\*?$/i;

/**
 * Walk backward from the Month element through preceding DOM siblings (and up
 * one level) looking for a composite label like "Start Date (Month / Day /
 * Year)". Skips trivial "Month"/"Day"/"Year" sub-labels.
 */
function findCompositeDateLabel(monthEl: HTMLElement): string | null {
  // Start from the immediate wrapper of the month element. Walk backward
  // through prior siblings; if none match, step up to the wrapper's parent
  // and continue.
  let cursor: HTMLElement | null = monthEl;
  for (let steps = 0; steps < 10 && cursor; steps++) {
    let sib = cursor.previousElementSibling as HTMLElement | null;
    while (sib) {
      if (sib.tagName === 'LABEL' || sib.matches?.('[class*="label"], legend, h3, h4, h5')) {
        const text = sib.textContent?.trim() ?? '';
        if (text && text.length < 120 && !DATE_PART_WORD.test(text)) return text;
      } else {
        const labelEl = sib.querySelector?.('label, [class*="label"], legend');
        const text = labelEl?.textContent?.trim() ?? '';
        if (text && text.length < 120 && !DATE_PART_WORD.test(text)) return text;
      }
      sib = sib.previousElementSibling as HTMLElement | null;
    }
    cursor = cursor.parentElement;
  }
  return null;
}

/**
 * iCIMS composite widgets (triple-input dates, typeahead dropdowns) are
 * scanned as multiple individual fields. We collapse them here so the filler
 * sees a single entry per composite, with the appropriate widgetType + primary
 * element.
 */
function collapseCompositeWidgets(results: ScanResult[]): ScanResult[] {
  const seenContainers = new Set<HTMLElement>();
  const seenDateBases = new Set<string>();
  const collapsed: ScanResult[] = [];

  for (const field of results) {
    const id = field.element.id || '';

    // Date triple: resolve siblings by ID base so Start Date / End Date in the
    // same section don't collide on a shared outer container.
    if (DATE_PART_SUFFIX.test(id)) {
      const base = id.replace(DATE_PART_SUFFIX, '');
      if (seenDateBases.has(base)) continue;
      const triple = findDateTripleSiblings(field.element);
      if (triple) {
        seenDateBases.add(base);
        const containerLabel =
          findCompositeDateLabel(triple.monthEl) ?? resolveLabel(triple.monthEl) ?? field.label;
        collapsed.push({
          ...field,
          element: triple.monthEl,
          widgetType: 'icims-date',
          label: containerLabel || field.label,
        });
        continue;
      }
    }

    // Typeahead: look for the dropdown anchor within an immediate wrapper.
    // Start from the parent so a field element whose OWN class matches
    // `[class*="field" i]` (e.g. "customFieldContainer") doesn't resolve to
    // itself — the anchor lives next to the element, not inside it.
    const container =
      field.element.parentElement?.closest<HTMLElement>(
        '.iCIMS_TextInputField, .iCIMS_InfoData, .iCIMS_TableRow, .row, [class*="field" i]',
      ) ?? null;
    const widgetHint: IcimsWidgetHint | null = container ? detectIcimsWidget(container) : null;

    if (!widgetHint || !container) {
      collapsed.push(field);
      continue;
    }

    if (seenContainers.has(container)) continue;
    seenContainers.add(container);

    const widgetType: WidgetType = widgetHint;
    let element = field.element;

    if (widgetHint === 'icims-typeahead') {
      const anchor = container.querySelector<HTMLElement>('a[id*="_icimsDropdown"]');
      if (anchor) element = anchor;
    } else if (widgetHint === 'icims-date') {
      const monthInput = container.querySelector<HTMLElement>(MONTH_INPUT_SEL);
      if (monthInput) element = monthInput;
    }

    collapsed.push({ ...field, element, widgetType });
  }

  return collapsed;
}

export const icims: ATSScanner = {
  name: 'icims',

  detect() {
    const host = window.location.hostname;
    if (host.endsWith('.icims.com') || host.includes('icims.com')) return true;
    // Inside the job-board iframe URL is cross-origin; fall back to DOM
    if (document.querySelector('[id^="icims_"], .iCIMS_Anchor, .iCIMS_InnerIframe')) return true;
    if (document.querySelector('[id*="ProfileFields."]')) return true;
    return false;
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenLabels = new Set<string>();
    const groupedElements = new Set<HTMLElement>();

    scanFieldsetGroups(results, groupedElements, 'icims');
    scanIndividualElements(results, seenLabels, groupedElements, 'icims');

    const collapsed = collapseCompositeWidgets(results);
    applyStaticMap(collapsed);
    classifyByContext(collapsed);

    return collapsed.filter((f) => f.category !== '__skip__');
  },
};
