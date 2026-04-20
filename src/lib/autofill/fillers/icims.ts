import type { FillOutcome } from '../types';
import { bridgeClick, bridgeSetText, bridgeSetSelect } from '../bridge';
import { sleep, findBestOptionIndex } from './shared';

const OPEN_WAIT_MS = 500;
const RESULTS_WAIT_MS = 1500;
const OPTION_SELECTOR = '.dropdown-results li, [class*="dropdown-results"] li';

function findDropdownResults(anchor: HTMLElement): HTMLElement | null {
  // Prefer the anchor-specific results list (`<anchor-id>_dropdown-results`),
  // then the dropdown container, then field container, then global fallback.
  if (anchor.id) {
    const byId = document.getElementById(`${anchor.id}_dropdown-results`);
    if (byId instanceof HTMLElement) return byId;
    const ctnr = document.getElementById(`${anchor.id}_ctnr`);
    const localInCtnr = ctnr?.querySelector<HTMLElement>(
      '.dropdown-results, [class*="dropdown-results"]',
    );
    if (localInCtnr) return localInCtnr;
  }
  const container = anchor.closest<HTMLElement>(
    '.iCIMS_TextInputField, .iCIMS_AddressTown, .iCIMS_TextInput, .iCIMS_InfoData, .iCIMS_TableRow, .row, [class*="field" i]',
  );
  if (container) {
    const local = container.querySelector<HTMLElement>(
      '.dropdown-results, [class*="dropdown-results"]',
    );
    if (local) return local;
  }
  return document.querySelector<HTMLElement>(
    '.dropdown-results:not([style*="display: none"]), [class*="dropdown-results"]:not([style*="display: none"])',
  );
}

function getVisibleOptions(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(OPTION_SELECTOR)).filter((li) => {
    if (li.offsetHeight === 0 || li.offsetParent === null) return false;
    // Skip the placeholder row (`dropdown-index="-1"`, "— Make a Selection —")
    if (li.getAttribute('dropdown-index') === '-1') return false;
    if (li.querySelector('.dropdown-placeholder, [class*="dropdown-placeholder"]')) return false;
    return true;
  });
}

async function waitForDropdownOptions(
  anchor: HTMLElement,
  timeout: number,
): Promise<HTMLElement[]> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const root = findDropdownResults(anchor);
    if (root) {
      const options = getVisibleOptions(root);
      if (options.length > 0) return options;
    }
    await sleep(50);
  }
  return [];
}

/**
 * After typing into the search input, iCIMS fires an AJAX refetch. Poll the
 * DOM until options reflect the search term — either by matching the value
 * directly, or by stabilizing on a new set that differs from `initial`.
 */
async function waitForFilteredOptions(
  anchor: HTMLElement,
  initial: HTMLElement[],
  valueLower: string,
  searchLower: string,
  timeout = 2500,
): Promise<HTMLElement[]> {
  const initialSignature = initial.map(getOptionText).join('|');
  const deadline = Date.now() + timeout;
  let stableSignature = '';
  let stableSince = 0;
  while (Date.now() < deadline) {
    await sleep(100);
    const root = findDropdownResults(anchor);
    if (!root) continue;
    const opts = getVisibleOptions(root);
    if (opts.length === 0) continue;
    const texts = opts.map(getOptionText);
    const signature = texts.join('|');
    // Winning case: an option now contains the search/value text → result of refetch
    const anyMatch = texts.some(
      (t) =>
        t.toLowerCase().includes(searchLower) ||
        valueLower.includes(t.toLowerCase()) ||
        t.toLowerCase().includes(valueLower),
    );
    if (anyMatch && signature !== initialSignature) return opts;
    // Fallback: signature has been stable for ~300ms AND differs from initial
    if (
      signature === stableSignature &&
      Date.now() - stableSince > 300 &&
      signature !== initialSignature
    ) {
      return opts;
    }
    if (signature !== stableSignature) {
      stableSignature = signature;
      stableSince = Date.now();
    }
  }
  // Timed out — return whatever's visible now; caller can still try matching.
  const root = findDropdownResults(anchor);
  return root ? getVisibleOptions(root) : [];
}

function getOptionText(li: HTMLElement): string {
  return li.getAttribute('title')?.trim() || li.textContent?.trim() || '';
}

export async function fillIcimsTypeahead(
  el: HTMLElement,
  value: string,
  category?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  // The scanner may pass the <select>, the <a> anchor, or the wrapper.
  // Resolve to the real trigger anchor (`<a id="<select-id>_icimsDropdown">`).
  let anchor: HTMLElement | null = null;
  if (el.tagName === 'A') {
    anchor = el;
  } else {
    if (el.id) {
      const byId = document.getElementById(`${el.id}_icimsDropdown`);
      if (byId instanceof HTMLElement) anchor = byId;
    }
    if (!anchor) {
      anchor =
        el
          .closest<HTMLElement>(
            '.iCIMS_TextInputField, .iCIMS_AddressTown, .iCIMS_TextInput, .iCIMS_InfoData, .iCIMS_TableRow, .row, [class*="field" i]',
          )
          ?.querySelector<HTMLElement>('a[id*="_icimsDropdown"]') ?? null;
    }
  }
  if (!anchor) return { status: 'failed', reason: 'element-error' };

  // The selected value lives in `<span class="dropdown-text">`; when nothing
  // is selected, that span holds an inner `<span class="dropdown-placeholder">`.
  // Use the placeholder-class probe instead of a text regex so the em-dash
  // "— Make a Selection —" doesn't slip past and cause a false already-filled.
  const textSpan = anchor.querySelector<HTMLElement>('.dropdown-text, [class*="dropdown-text"]');
  const hasPlaceholder = !!textSpan?.querySelector(
    '.dropdown-placeholder, [class*="dropdown-placeholder"]',
  );
  if (textSpan && !hasPlaceholder && textSpan.textContent?.trim()) {
    return { status: 'skipped', reason: 'already-filled' };
  }

  anchor.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeClick(anchor);
  await sleep(OPEN_WAIT_MS);

  // Scope the search input to this specific dropdown's container
  // (`<anchor-id>_ctnr`) so a stale `.dropdown-search` from a previously
  // opened field doesn't get targeted.
  const dropdownCtnr = anchor.id ? document.getElementById(`${anchor.id}_ctnr`) : null;
  const searchInput =
    dropdownCtnr?.querySelector<HTMLInputElement>('.dropdown-search, [class*="dropdown-search"]') ??
    document.querySelector<HTMLInputElement>(
      '.dropdown-search:not([style*="display: none"]), [class*="dropdown-search"]:not([style*="display: none"])',
    );

  // Build the search term — strip apostrophes and truncate after a separator
  // so iCIMS's AJAX endpoint doesn't choke on exotic punctuation or an
  // overly-specific query (e.g. "Pennsylvania State University - University
  // Park" → "Pennsylvania State").
  const primaryChunk = (value.split(',')[0] ?? value).split(/\s*[-–—(]\s*/)[0] ?? value;
  const searchTerm = primaryChunk.trim().replace(/['']/g, '').slice(0, 20);
  const valueLower = value.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  let options = await waitForDropdownOptions(anchor, RESULTS_WAIT_MS);
  let texts = options.map(getOptionText);

  // First try matching against the initial (unfiltered) options. This avoids
  // a race condition on short dropdowns (~10 items like Degree) where the
  // initial batch already contains a match; typing into the search box
  // triggers a DOM swap that can invalidate the <li> reference we'd click.
  let idx = options.length > 0 ? await findBestOptionIndex(texts, value, category, fieldLabel) : -1;

  // Fall back to server-side search only if the initial list didn't have a
  // match — this is the usual path for long lists (schools, countries, etc.).
  if (idx < 0 && searchInput) {
    await bridgeSetText(searchInput, searchTerm);
    const filtered = await waitForFilteredOptions(anchor, options, valueLower, searchLower);
    if (filtered.length > 0) {
      options = filtered;
      texts = options.map(getOptionText);
      idx = await findBestOptionIndex(texts, value, category, fieldLabel);
    }
  }

  if (options.length === 0) {
    return { status: 'failed', reason: 'no-dropdown' };
  }

  if (idx < 0) {
    return {
      status: 'failed',
      reason: 'no-option-match',
      discoveredOptions: texts.slice(0, 10),
    };
  }

  await bridgeClick(options[idx]!);
  await sleep(150);

  // Success check: the anchor's `.dropdown-text` span should no longer contain
  // a `.dropdown-placeholder`. Text-based matching is unreliable because the
  // placeholder uses em-dashes ("— Make a Selection —") that slip past simple
  // prefix regexes.
  const newTextSpan = anchor.querySelector<HTMLElement>('.dropdown-text, [class*="dropdown-text"]');
  const stillPlaceholder = !!newTextSpan?.querySelector(
    '.dropdown-placeholder, [class*="dropdown-placeholder"]',
  );
  const selectedText = newTextSpan?.textContent?.trim() ?? '';
  if (newTextSpan && !stillPlaceholder && selectedText) {
    return { status: 'filled', matchedOption: texts[idx] };
  }

  return {
    status: 'failed',
    reason: 'select-failed',
    discoveredOptions: texts.slice(0, 10),
  };
}

function parseDateTriple(value: string): { month: string; day: string; year: string } | null {
  // ISO: YYYY-MM-DD
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: iso[1]!, month: String(Number(iso[2])), day: String(Number(iso[3])) };
  // US: MM/DD/YYYY
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return { month: String(Number(us[1])), day: String(Number(us[2])), year: us[3]! };
  // MM/YYYY
  const ym = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (ym) return { month: String(Number(ym[1])), day: '1', year: ym[2]! };
  // Month name + year
  const MONTHS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const lower = value.toLowerCase();
  const monthIdx = MONTHS.findIndex((m) => lower.includes(m));
  const yearMatch = value.match(/\d{4}/);
  if (monthIdx >= 0 && yearMatch) {
    return { month: String(monthIdx + 1), day: '1', year: yearMatch[0] };
  }
  if (yearMatch) return { month: '1', day: '1', year: yearMatch[0] };
  if (/^immediately|^asap/i.test(value)) {
    const d = new Date();
    return {
      month: String(d.getMonth() + 1),
      day: String(d.getDate()),
      year: String(d.getFullYear()),
    };
  }
  return null;
}

const MONTH_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

async function setDatePart(
  el: HTMLInputElement | HTMLSelectElement,
  numericValue: string,
): Promise<boolean> {
  if (el instanceof HTMLSelectElement) {
    const numIdx = Number(numericValue);
    const opts = Array.from(el.options);
    // Try: value === numericValue, then text === numericValue, then short month name
    const targets: string[] = [];
    for (const o of opts) {
      const label = o.text.trim().toLowerCase();
      if (
        o.value === numericValue ||
        o.value === String(numIdx) ||
        label === numericValue ||
        label === String(numIdx) ||
        (numIdx >= 1 && numIdx <= 12 && label.startsWith(MONTH_SHORT[numIdx - 1]!))
      ) {
        targets.push(o.value);
        break;
      }
    }
    if (targets.length === 0) return false;
    return bridgeSetSelect(el, targets[0]!);
  }
  await bridgeSetText(el, numericValue);
  return !!el.value.trim();
}

export async function fillIcimsDate(el: HTMLElement, value: string): Promise<FillOutcome> {
  // The scanner passes the Month element as the primary. Resolve its two
  // siblings by stripping the suffix and looking them up by ID so Start Date
  // and End Date don't collide when they share an outer wrapper.
  const base = el.id.replace(/_(Mon|Month|Dat|Date|Day|Yea|Year)$/, '');
  const byId = <T extends HTMLElement>(suffixes: string[]): T | null => {
    for (const s of suffixes) {
      const found = document.getElementById(`${base}${s}`);
      if (found instanceof HTMLInputElement || found instanceof HTMLSelectElement) {
        return found as unknown as T;
      }
    }
    return null;
  };
  const monthEl = byId<HTMLInputElement | HTMLSelectElement>(['_Mon', '_Month']);
  const dayEl = byId<HTMLInputElement | HTMLSelectElement>(['_Dat', '_Date', '_Day']);
  const yearEl = byId<HTMLInputElement | HTMLSelectElement>(['_Yea', '_Year']);

  if (!monthEl || !yearEl) return { status: 'failed', reason: 'element-error' };
  const monthHas =
    monthEl instanceof HTMLSelectElement ? monthEl.selectedIndex > 0 : !!monthEl.value.trim();
  const yearHas =
    yearEl instanceof HTMLSelectElement ? yearEl.selectedIndex > 0 : !!yearEl.value.trim();
  if (monthHas && yearHas) return { status: 'skipped', reason: 'already-filled' };

  const parts = parseDateTriple(value);
  if (!parts) return { status: 'skipped', reason: 'wrong-type' };

  monthEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await setDatePart(monthEl, parts.month);
  if (dayEl) await setDatePart(dayEl, parts.day);
  await setDatePart(yearEl, parts.year);
  await sleep(50);

  const monthOk =
    monthEl instanceof HTMLSelectElement ? monthEl.selectedIndex > 0 : !!monthEl.value.trim();
  const yearOk =
    yearEl instanceof HTMLSelectElement ? yearEl.selectedIndex > 0 : !!yearEl.value.trim();
  return monthOk && yearOk ? { status: 'filled' } : { status: 'failed', reason: 'element-error' };
}
