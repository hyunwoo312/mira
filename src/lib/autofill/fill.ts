/**
 * Fill functions for each widget type.
 * Routes all DOM interaction through the MAIN world page script
 * via the bridge (postMessage). Uses Simplify-style dual dispatch:
 * DOM events + direct __reactProps$ handler calls.
 */

import { fuzzyMatchOption } from './match';
import type { FillOutcome, FillableField, WidgetType } from './types';
import {
  bridgeSetText,
  bridgeSetTextNoBlur,
  bridgeSetComboboxValue,
  bridgeClick,
  bridgeSetChecked,
  bridgeKeyDown,
  bridgeSetSelect,
  bridgeGetSelectState,
  bridgeSetSelectValue,
  bridgeClickButtonGroup,
} from './bridge';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const DROPDOWN_WAIT_MS = 300; // Default wait for dropdown options to appear
const DROPDOWN_WAIT_FILTERED_MS = 400; // Wait after typing a search filter
const LOCATION_API_WAIT_MS = 5000; // Lever/Places API can be slow
const LOCATION_API_RETRY_MS = 3000; // Retry timeout for location API
const PLACES_COLD_START_MS = 800; // Google Places initial API latency
const LARGE_DROPDOWN_THRESHOLD = 20; // Above this, type to filter instead of scanning

// ══════════════════════════════════════════════════════════════════════
//  Widget Detection (fill-time)
// ══════════════════════════════════════════════════════════════════════

export function detectWidget(field: FillableField): WidgetType {
  const el = field.element;

  if (field.type === 'file') return 'file-upload';
  if (field.type === 'button-group') return 'button-group';
  if (field.type === 'radio-group') {
    if (
      field.groupElements?.[0] instanceof HTMLInputElement &&
      field.groupElements[0].type === 'checkbox'
    ) {
      return 'checkbox-group';
    }
    return 'radio-group';
  }
  if (field.type === 'checkbox') return 'checkbox';
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
  if (field.type === 'combobox') return 'autocomplete';

  return 'plain-text';
}

// ══════════════════════════════════════════════════════════════════════
//  Shared Utilities
// ══════════════════════════════════════════════════════════════════════

function findClickTarget(el: HTMLElement): HTMLElement {
  if (el.offsetWidth > 0 && el.offsetHeight > 0) return el;

  if (el instanceof HTMLInputElement) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`) as HTMLElement;
      if (label && label.offsetWidth > 0) return label;
    }
    if (el.labels && el.labels.length > 0) {
      const label = el.labels[0] as HTMLElement;
      if (label.offsetWidth > 0) return label;
    }
    const wrapping = el.closest('label') as HTMLElement;
    if (wrapping && wrapping.offsetWidth > 0) return wrapping;
    const parent = el.parentElement;
    if (parent && parent.offsetWidth > 0) return parent;
  }

  return el;
}

/** Scroll into view and click via bridge (dual dispatch) */
async function clickElement(el: HTMLElement): Promise<void> {
  const target = findClickTarget(el);
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeClick(target);
}

// ══════════════════════════════════════════════════════════════════════
//  Fill Functions
// ══════════════════════════════════════════════════════════════════════

export async function fillText(el: HTMLElement, value: string): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return { status: 'skipped', reason: 'wrong-type' };
  }
  if (el.value.trim()) return { status: 'skipped', reason: 'already-filled' };

  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeSetText(el, value);
  // Check value after a microtask (bridge setText may report false due to timing)
  await sleep(10);
  return el.value.trim() ? { status: 'filled' } : { status: 'failed', reason: 'element-error' };
}

function toDisplayDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const us = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (us) return value;
  if (/immediately|asap|as soon as|2 weeks|right away/i.test(value)) {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return null;
}

function toISODate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const us = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  if (/immediately|asap|as soon as|2 weeks|right away/i.test(value)) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

export async function fillDatepicker(el: HTMLElement, value: string): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (el.value.trim()) return { status: 'skipped', reason: 'already-filled' };

  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });

  if (el.type === 'date') {
    const isoDate = toISODate(value);
    if (!isoDate) return { status: 'skipped', reason: 'wrong-type' };
    await bridgeSetText(el, isoDate);
  } else {
    const displayDate = toDisplayDate(value);
    if (!displayDate) return { status: 'skipped', reason: 'wrong-type' };
    await bridgeSetText(el, displayDate);
  }

  // Datepickers may reformat the value — check if any value was set, not exact match
  await sleep(50);
  return el.value.trim() ? { status: 'filled' } : { status: 'failed', reason: 'element-error' };
}

export async function fillSelect(
  el: HTMLElement,
  value: string,
  category?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLSelectElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (el.selectedIndex > 0) return { status: 'skipped', reason: 'already-filled' };

  const texts = Array.from(el.options).map((o) => o.text);
  const match = fuzzyMatchOption(texts, value, false, category);
  if (match.index >= 0) {
    await bridgeSetSelect(el, el.options[match.index]!.value);
    return { status: 'filled' };
  }

  const conceptIdx = matchByConcept(texts, value);
  if (conceptIdx >= 0) {
    await bridgeSetSelect(el, el.options[conceptIdx]!.value);
    return { status: 'filled' };
  }

  return { status: 'failed', reason: 'no-option-match' };
}

export async function fillCheckbox(el: HTMLElement, value: string): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  const shouldCheck = /^(yes|true|1|i agree|i acknowledge|i consent|i accept|i understand)$/i.test(
    value,
  );
  const shouldUncheck = /^(no|false|0)$/i.test(value);

  if (shouldCheck && !el.checked) {
    // Scroll via visible target, but always pass the actual checkbox input to
    // bridgeSetChecked — findClickTarget may redirect to a label/span which
    // the page script can't set checked on.
    const target = findClickTarget(el);
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await bridgeSetChecked(el, true);
    return { status: 'filled' };
  }
  if (shouldUncheck && el.checked) {
    const target = findClickTarget(el);
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await bridgeSetChecked(el, false);
    return { status: 'filled' };
  }
  if (!shouldCheck && !shouldUncheck) return { status: 'skipped', reason: 'no-value' as const };
  return { status: 'filled' };
}

export async function fillRadioGroup(
  elements: HTMLElement[],
  labels: string[],
  value: string,
  category?: string,
): Promise<FillOutcome> {
  const match = fuzzyMatchOption(labels, value, false, category);
  let targetIdx = match.index;
  if (targetIdx < 0) {
    const conceptIdx = matchByConcept(labels, value);
    if (conceptIdx >= 0) targetIdx = conceptIdx;
  }
  if (targetIdx < 0) return { status: 'failed', reason: 'no-option-match' };

  const el = elements[targetIdx]!;
  // Use bridgeSetChecked for radio/checkbox inputs — directly sets checked=true
  // with React _valueTracker reset. clickElement may redirect to a label for
  // CSS-hidden inputs, bypassing the tracker fix.
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await bridgeSetChecked(el, true);
  } else {
    await clickElement(el);
  }
  await sleep(50);
  return { status: 'filled' };
}

export async function fillCheckboxGroup(
  elements: HTMLElement[],
  labels: string[],
  value: string,
  category?: string,
): Promise<FillOutcome> {
  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  let clicked = 0;

  for (const val of values) {
    const match = fuzzyMatchOption(labels, val, false, category);
    if (match.index >= 0) {
      const el = elements[match.index] as HTMLInputElement;
      if (!el.checked) {
        const target = findClickTarget(el);
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        await bridgeSetChecked(target, true);
        clicked++;
      }
    }
  }
  if (clicked === 0) {
    const match = fuzzyMatchOption(labels, value, false, category);
    if (match.index >= 0) {
      const el = elements[match.index] as HTMLInputElement;
      if (!el.checked) {
        const target = findClickTarget(el);
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        await bridgeSetChecked(target, true);
        clicked++;
      }
    }
  }
  if (clicked === 0) {
    const conceptIdx = matchByConcept(labels, value);
    if (conceptIdx >= 0) {
      const el = elements[conceptIdx] as HTMLInputElement;
      if (!el.checked) {
        const target = findClickTarget(el);
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        await bridgeSetChecked(target, true);
        clicked++;
      }
    }
  }
  return clicked > 0 ? { status: 'filled' } : { status: 'failed', reason: 'no-option-match' };
}

export async function fillButtonGroup(
  elements: HTMLElement[],
  labels: string[],
  value: string,
  category?: string,
): Promise<FillOutcome> {
  const match = fuzzyMatchOption(labels, value, false, category);
  let targetIdx = match.index;
  if (targetIdx < 0) {
    const conceptIdx = matchByConcept(labels, value);
    if (conceptIdx >= 0) targetIdx = conceptIdx;
  }
  if (targetIdx < 0) return { status: 'failed', reason: 'no-option-match' };

  const btn = elements[targetIdx]!;
  btn.scrollIntoView({ block: 'nearest', behavior: 'instant' });

  // Use atomic bridge call that clicks the button AND sets the hidden checkbox
  // in the same synchronous tick in the MAIN world — before React re-renders.
  await bridgeClickButtonGroup(btn);
  await sleep(50);
  return { status: 'filled' };
}

export function matchByConcept(options: string[], value: string): number {
  const v = value.toLowerCase().trim();
  const isPositive =
    /^(yes|true|i am|i do|i have|i will|i can|i consent|authorized|i identify)$/i.test(v) ||
    v === 'yes' ||
    v === 'true';
  const isNegative =
    /^(no|false|i am not|i do not|i don't|i will not|i have not|not|none|decline|prefer not)$/i.test(
      v,
    ) ||
    v === 'no' ||
    v === 'false';

  if (!isPositive && !isNegative) return -1;

  const normed = options.map((o) => o.toLowerCase().trim());
  for (let i = 0; i < normed.length; i++) {
    const opt = normed[i]!;
    if (isPositive) {
      if (
        /^yes\b/.test(opt) ||
        /\bi am\b|\bi do\b|\bi will\b|\bi have\b|\bi can\b|\bi consent\b|\bauthorized\b/.test(opt)
      ) {
        if (!/\bnot\b|\bno\b|\bnever\b/.test(opt)) {
          if (/\bcurrently live\b|\bcurrently reside\b|\balready live\b/.test(opt)) {
            const betterIdx = normed.findIndex(
              (o2, j) =>
                j > i &&
                /^yes\b/.test(o2) &&
                /\brelocat\b|\bopen to\b|\bwilling\b/.test(o2) &&
                !/\bnot\b/.test(o2),
            );
            if (betterIdx >= 0) continue;
          }
          return i;
        }
      }
    }
    if (isNegative) {
      if (
        /^no\b/.test(opt) ||
        /\bi am not\b|\bi do not\b|\bi will not\b|\bi have not\b|\bnot a\b|\bdecline\b|\bprefer not\b/.test(
          opt,
        )
      ) {
        return i;
      }
    }
  }
  return -1;
}

// ══════════════════════════════════════════════════════════════════════
//  React Select
// ══════════════════════════════════════════════════════════════════════

const NO_CONCEPT_MATCH = new Set([
  'race',
  'gender',
  'location',
  'city',
  'state',
  'country',
  'school',
  'degree',
  'company',
  'jobTitle',
  'fieldOfStudy',
  'sexualOrientation',
]);

function getComboboxDisplayValue(el: HTMLElement): string {
  const container =
    el.closest('.select, [class*="select__control"]')?.closest('.select') ??
    el.closest('[class*="select"]');
  if (!container) return '';
  const sv = container.querySelector('[class*="single-value"], [class*="singleValue"]');
  if (sv?.textContent?.trim()) return sv.textContent.trim();
  const multiValues = container.querySelectorAll('[class*="multi-value"], [class*="multiValue"]');
  if (multiValues.length > 0)
    return Array.from(multiValues)
      .map((v) => v.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(', ');
  return '';
}

const OPTION_SELECTOR =
  '.select__option, [role="listbox"] [role="option"]:not(.iti__country), [role="listbox"] [class*="_result"], .dropdown-location, .dropdown-results > div, [data-floating-ui-portal] [role="option"], div[id^="floating-ui-"] [role="option"], .pac-container .pac-item';

function getVisibleOptions(): HTMLElement[] {
  const opts = document.querySelectorAll<HTMLElement>(OPTION_SELECTOR);
  return Array.from(opts).filter(
    (o) =>
      o.offsetHeight > 0 &&
      (o.offsetParent !== null ||
        getComputedStyle(o).position === 'fixed' ||
        o.closest('[data-floating-ui-portal]') ||
        o.closest('.pac-container')),
  );
}

/**
 * Wait for dropdown options to appear. If `waitForNew` is true, ignores
 * pre-existing options and only resolves when NEW options appear (or the
 * set of options changes). This prevents matching stale UI elements
 * (pagination, ratings) that happen to use [role="option"].
 */
function waitForOptions(timeout = 300, waitForNew = false): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    const existingCount = waitForNew ? getVisibleOptions().length : 0;

    const check = () => {
      const visible = getVisibleOptions();
      if (waitForNew) {
        // Only resolve if the option count changed (new dropdown appeared)
        if (visible.length > 0 && visible.length !== existingCount) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(visible);
        }
      } else {
        if (visible.length > 0) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(visible);
        }
      }
    };
    const timer = setTimeout(() => {
      obs.disconnect();
      resolve(waitForNew ? getVisibleOptions() : []);
    }, timeout);
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    if (!waitForNew) check(); // Only check pre-existing when not waiting for new
  });
}

const STATE_ABBREVS: Record<string, string> = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
  'district of columbia': 'dc',
};

function matchOption(
  texts: string[],
  value: string,
  isLocation: boolean,
  category?: string,
): number {
  const match = fuzzyMatchOption(texts, value, isLocation, category);
  if (match.index >= 0) return match.index;
  if (!category || !NO_CONCEPT_MATCH.has(category)) {
    const conceptIdx = matchByConcept(texts, value);
    if (conceptIdx >= 0) return conceptIdx;
  }
  // Location: find the option best matching value (city, state, country)
  // Prefer exact city match + shortest option (avoid "Bay Area" when "San Francisco" is available)
  if (isLocation && texts.length > 0) {
    // Build search parts: city + state (full name AND abbreviation)
    const valueParts = value.split(',').map((p) => p.trim());
    const city = (valueParts[0] ?? '').toLowerCase();
    const state = (valueParts[1] ?? '').toLowerCase();
    const parts = [city, state].filter((p) => p.length >= 2);

    // Add state abbreviation if state is a full name (e.g., "Texas" → also check "TX")
    const stateAbbr = STATE_ABBREVS[state];
    if (stateAbbr) parts.push(stateAbbr);

    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < texts.length; i++) {
      const opt = texts[i]!.toLowerCase();
      let score = parts.filter((p) => opt.includes(p)).length * 10;
      if (opt.startsWith(city + ',') || opt.startsWith(city + ' ,')) score += 5;
      score -= Math.floor(opt.length / 20);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  return -1;
}

export async function fillReactSelect(
  el: HTMLElement,
  value: string,
  isLocation = false,
  category?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (getComboboxDisplayValue(el)) return { status: 'skipped', reason: 'already-filled' };

  // Strategy 1: React fiber — get options, match, call onChange
  const state = await bridgeGetSelectState(el);
  if (state && state.options.length > 0) {
    const texts = state.options.map((o) => o.label);
    const targetIdx = matchOption(texts, value, isLocation, category);
    if (targetIdx >= 0) {
      const ok = await bridgeSetSelectValue(el, texts[targetIdx]!);
      if (ok) return { status: 'filled' };
    }
  }

  // Strategy 2: Click to open dropdown, match options, select
  // Use direct click (no bridge) — bridgeClick dispatches blur which closes the dropdown
  const control = el.closest('[class*="select__control"], [class*="-control"]') as HTMLElement;
  const clickTarget = control ?? el;
  clickTarget.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  clickTarget.click();
  await sleep(100);

  let options = await waitForOptions(DROPDOWN_WAIT_MS);
  let texts = options.map((o) => o.textContent?.trim() ?? '');

  if (options.length > LARGE_DROPDOWN_THRESHOLD || options.length === 0) {
    const searchTerm = isLocation
      ? (value.split(',')[0]?.trim() ?? value).slice(0, 30)
      : (value.split(',')[0]?.split('(')[0]?.trim() ?? value).slice(0, 20);
    // Dropdown is already open from the click above. Use bridgeSetTextNoBlur
    // to type into it WITHOUT re-focusing (which would close/reopen the dropdown
    // and disrupt React Select's internal state + Google Places loading).
    await bridgeSetTextNoBlur(el, searchTerm);

    if (isLocation) {
      // Google Places API can be slow. Wait up to 8s, polling periodically.
      // If no options after initial wait, re-type to re-trigger the API.
      await sleep(PLACES_COLD_START_MS);
      options = await waitForOptions(LOCATION_API_RETRY_MS);
      if (options.length === 0) {
        // Re-trigger: clear and re-type
        await bridgeSetTextNoBlur(el, '');
        await sleep(100);
        await bridgeSetTextNoBlur(el, searchTerm);
        await sleep(500);
        options = await waitForOptions(LOCATION_API_WAIT_MS);
      }
    } else {
      await sleep(150);
      options = await waitForOptions(DROPDOWN_WAIT_FILTERED_MS);
    }
    texts = options.map((o) => o.textContent?.trim() ?? '');
  }

  if (options.length > 0) {
    const targetIdx = matchOption(texts, value, isLocation, category);
    if (targetIdx >= 0) {
      const opt = options[targetIdx]!;

      // Try 1: Direct click on option from content script.
      // Works for React Select (.select__option) but not Ashby floating-ui.
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      opt.click();
      await sleep(100);
      if (getComboboxDisplayValue(el)) return { status: 'filled' };

      // Try 2: Keyboard via bridge (MAIN world) — React's onKeyDown fires.
      for (let i = 0; i < targetIdx; i++) {
        await bridgeKeyDown(el, 'ArrowDown', 'ArrowDown', 40);
        await sleep(30);
      }
      await bridgeKeyDown(el, 'Enter', 'Enter', 13);
      await sleep(100);
      if (getComboboxDisplayValue(el)) return { status: 'filled' };

      // Try 3: React fiber direct onChange
      const ok = await bridgeSetSelectValue(el, texts[targetIdx]!);
      if (ok) return { status: 'filled' };

      return { status: 'failed', reason: 'select-failed' };
    }
  }

  // Close dropdown
  await bridgeKeyDown(el, 'Escape', 'Escape', 27);

  // Final check — React Select may update display value after a delay
  await sleep(200);
  if (getComboboxDisplayValue(el)) return { status: 'filled' };

  return { status: 'failed', reason: options.length === 0 ? 'no-dropdown' : 'no-option-match' };
}

/** Check if Lever's hidden location input already has a selected value. */
function isLeverLocationFilled(): boolean {
  const hidden = document.querySelector<HTMLInputElement>(
    '#selected-location, input[name="location"]',
  );
  return !!(hidden && hidden.value.trim());
}

// ══════════════════════════════════════════════════════════════════════
//  Autocomplete (non-React-Select comboboxes)
// ══════════════════════════════════════════════════════════════════════

export async function fillAutocomplete(
  el: HTMLElement,
  value: string,
  isLocation = false,
  category?: string,
  description?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (el.value.trim() && !isLocation) return { status: 'skipped', reason: 'already-filled' };

  // Lever stores the selected location in a hidden input (#selected-location).
  // After selection, the visible input is cleared. If hidden input already has a
  // value, a previous fill succeeded — don't wipe it by retyping.
  if (isLocation && isLeverLocationFilled()) return { status: 'skipped', reason: 'already-filled' };

  const cityTerm = isLocation
    ? (value.split(',')[0]?.trim() ?? value).slice(0, 30)
    : (value.split(',')[0]?.split('(')[0]?.trim() ?? value).slice(0, 20);
  const stateTerm = isLocation ? (value.split(',')[1]?.trim() ?? '').slice(0, 30) : '';

  // Check description for hints about what format the field expects
  const wantsState = description && /state|province|region/i.test(description);

  // Use state if description says so, otherwise city first
  let searchTerm = isLocation && wantsState && stateTerm ? stateTerm : cityTerm;

  // Detect combobox (Ashby) vs plain text (Lever)
  const isCombobox =
    el.getAttribute('role') === 'combobox' ||
    el.getAttribute('aria-autocomplete') ||
    el.getAttribute('aria-haspopup') === 'listbox';
  if (!isCombobox && isLocation) {
    // Plain text location (Lever): focus first, then type after delay.
    // Use direct focus instead of bridgeClick — bridgeClick dispatches blur
    // via clickElement which can detach Google Places / Lever API listeners.
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    el.focus();
    el.click();
    await sleep(300);
    await bridgeSetTextNoBlur(el, searchTerm);
  } else {
    await bridgeSetComboboxValue(el, searchTerm);
  }

  // waitForNew=true: ignore pre-existing [role="option"] elements on the page
  let options = await waitForOptions(
    isLocation ? LOCATION_API_WAIT_MS : DROPDOWN_WAIT_FILTERED_MS,
    true,
  );

  // If no options, try the other part
  if (isLocation && options.length === 0) {
    const altTerm = searchTerm === cityTerm ? stateTerm : cityTerm;
    if (altTerm) {
      searchTerm = altTerm;
      if (!isCombobox && isLocation) {
        await bridgeSetTextNoBlur(el, altTerm);
      } else {
        await bridgeSetComboboxValue(el, altTerm);
      }
      options = await waitForOptions(LOCATION_API_RETRY_MS, true);
    }
  }

  const texts = options.map((o) => o.textContent?.trim() ?? '');

  if (options.length > 0) {
    const targetIdx = matchOption(texts, value, isLocation, category);
    if (targetIdx >= 0) {
      const opt = options[targetIdx]!;

      // For plain text location inputs (Lever): select via mousedown on the
      // dropdown option. Lever uses jQuery event delegation on document for
      // mousedown on .dropdown-location — this is more reliable than Enter
      // which requires an active highlight. Also avoids isTrusted issues.
      if (!isCombobox) {
        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        opt.click();

        for (let wait = 0; wait < 5; wait++) {
          await sleep(300);
          if (el.value && el.value !== searchTerm) return { status: 'filled' };
          if (isLeverLocationFilled()) return { status: 'filled' };
        }
      } else {
        // Combobox (Ashby): use bridgeKeyDown for React handler access
        await bridgeKeyDown(el, 'Home', 'Home', 36);
        await sleep(30);
        for (let i = 0; i < targetIdx; i++) {
          await bridgeKeyDown(el, 'ArrowDown', 'ArrowDown', 40);
          await sleep(30);
        }
        await bridgeKeyDown(el, 'Enter', 'Enter', 13);

        for (let wait = 0; wait < 5; wait++) {
          await sleep(200);
          if (el.value && el.value !== searchTerm) return { status: 'filled' };
          if (el.getAttribute('aria-expanded') === 'false') return { status: 'filled' };
        }

        // Fallback: direct click
        if (opt.isConnected) {
          opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          opt.click();
          await sleep(200);
          if (el.value && el.value !== searchTerm) return { status: 'filled' };
          if (el.getAttribute('aria-expanded') === 'false') return { status: 'filled' };
        }
      }

      if (isLocation) {
        if (el.value.trim() || isLeverLocationFilled()) return { status: 'filled' };
      }

      return { status: 'failed', reason: 'select-failed' };
    }
  }

  // Don't send Escape for location — Google Places clears the input on Escape.
  if (!isLocation) {
    await bridgeKeyDown(el, 'Escape', 'Escape', 27);
    await sleep(100);
  }

  if (el.value.trim()) return { status: 'filled' };
  if (isLocation && isLeverLocationFilled()) return { status: 'filled' };

  return { status: 'failed', reason: options.length === 0 ? 'no-dropdown' : 'no-option-match' };
}

export function fillFile(el: HTMLElement, value: string): FillOutcome {
  if (!(el instanceof HTMLInputElement) || el.type !== 'file')
    return { status: 'skipped', reason: 'wrong-type' };
  try {
    const fileData = JSON.parse(value) as { name: string; type: string; data: string };
    if (!fileData.data || !fileData.name) return { status: 'failed', reason: 'element-error' };
    const base64 = fileData.data.split(',')[1] ?? fileData.data;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], fileData.name, { type: fileData.type || 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.files.length > 0
      ? { status: 'filled' }
      : { status: 'failed', reason: 'element-error' };
  } catch {
    return { status: 'failed', reason: 'element-error' };
  }
}
