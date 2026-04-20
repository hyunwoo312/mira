import type { FillOutcome } from '../types';
import { fuzzyMatchOption } from '../match';
import {
  bridgeSetTextNoBlur,
  bridgeSetComboboxValue,
  bridgeKeyDown,
  bridgeSetSelect,
  bridgeGetSelectState,
  bridgeSetSelectValue,
} from '../bridge';
import {
  sleep,
  isLeverLocationFilled,
  getComboboxDisplayValue,
  waitForOptions,
  findBestOptionIndex,
  isYesNoOnlyOptionSet,
  DROPDOWN_WAIT_MS,
  DROPDOWN_WAIT_FILTERED_MS,
  LOCATION_API_WAIT_MS,
  LOCATION_API_RETRY_MS,
  PLACES_COLD_START_MS,
  LARGE_DROPDOWN_THRESHOLD,
} from './shared';

/**
 * `exportControl`'s profile value ("U.S. person" / "Foreign person") doesn't
 * map cleanly to Yes/No option sets, and the OFAC Yes/No semantic is inverted
 * ("Yes" means the candidate IS a citizen of a sanctioned country). Rather
 * than let the ML option-scorer guess — which has picked the wrong answer on
 * Telnyx — skip the fill when the option set is Yes/No-only.
 */
function shouldSkipForExportControlMismatch(
  category: string | undefined,
  options: string[],
): boolean {
  return category === 'exportControl' && isYesNoOnlyOptionSet(options);
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

/** Location-specific option scoring using city/state matching. */
function scoreLocationOptions(texts: string[], value: string): number {
  const valueParts = value.split(',').map((p) => p.trim());
  const city = (valueParts[0] ?? '').toLowerCase();
  const state = (valueParts[1] ?? '').toLowerCase();
  const stateAbbr = STATE_ABBREVS[state] ?? '';
  const parts = [city, state].filter((p) => p.length >= 2);
  if (stateAbbr) parts.push(stateAbbr);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < texts.length; i++) {
    const opt = texts[i]!.toLowerCase();
    let score = parts.filter((p) => opt.includes(p)).length * 10;
    if (opt.startsWith(city + ',') || opt.startsWith(city + ' ,')) score += 5;
    const hasState = (state && opt.includes(state)) || (stateAbbr && opt.includes(stateAbbr));
    if (hasState) score += 20;
    if (state && !hasState && opt.includes(',')) score -= 15;
    score -= Math.floor(opt.length / 20);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Match an option from dropdown results. Uses unified matcher + location fallback. */
async function matchOption(
  texts: string[],
  value: string,
  isLocation: boolean,
  category?: string,
  fieldLabel?: string,
): Promise<number> {
  const idx = await findBestOptionIndex(texts, value, category, fieldLabel);
  if (idx >= 0) return idx;
  if (isLocation && texts.length > 0) return scoreLocationOptions(texts, value);
  return -1;
}

/**
 * Some native selects (iCIMS country, state, academic field) populate their
 * options via an async fetch that completes after page hydration. If the
 * select is suspiciously empty at fill time, poll briefly for options before
 * declaring no-option-match.
 */
async function waitForSelectOptions(el: HTMLSelectElement, timeoutMs = 1500): Promise<void> {
  // Treat "empty" as: no options with a real value, OR only one option whose
  // text looks like a placeholder ("please select…", "— make a selection —").
  const PLACEHOLDER = /please\s*select|make\s*a\s*selection|^--|^—/i;
  const needsWait = () => {
    const real = Array.from(el.options).filter((o) => o.value !== '');
    if (real.length === 0) return true;
    if (real.length === 1 && PLACEHOLDER.test(real[0]!.text.trim())) return true;
    return false;
  };
  if (!needsWait()) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(100);
    if (!needsWait()) return;
  }
}

export async function fillNativeSelect(
  el: HTMLElement,
  value: string,
  category?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLSelectElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (el.selectedIndex > 0) return { status: 'skipped', reason: 'already-filled' };

  // Lazy-loaded selects: wait briefly for options if the dropdown is empty.
  await waitForSelectOptions(el);

  const texts = Array.from(el.options).map((o) => o.text);
  // Check the non-placeholder subset so an empty "Select…" option doesn't
  // mask a Yes/No-only set.
  const meaningfulTexts = Array.from(el.options)
    .filter((o) => o.value !== '')
    .map((o) => o.text);
  if (shouldSkipForExportControlMismatch(category, meaningfulTexts)) {
    return { status: 'skipped', reason: 'no-value' };
  }

  const idx = await findBestOptionIndex(texts, value, category, fieldLabel);
  if (idx >= 0) {
    await bridgeSetSelect(el, el.options[idx]!.value);
    return { status: 'filled', matchedOption: texts[idx] };
  }

  return {
    status: 'failed',
    reason: 'no-option-match',
    discoveredOptions: (meaningfulTexts.length > 0 ? meaningfulTexts : texts).slice(0, 15),
  };
}

/** Close any open react-select dropdowns and clear search text. */
async function cleanupReactSelect(el: HTMLElement): Promise<void> {
  // Press Escape to close menu
  await bridgeKeyDown(el, 'Escape', 'Escape', 27);
  await sleep(100);

  // If menu is still open, press Tab to move focus away (closes the menu)
  const menu = document.querySelector(
    '[class*="select__menu"], [class*="-menu"][id*="react-select"]',
  );
  if (menu) {
    await bridgeKeyDown(el, 'Tab', 'Tab', 9);
    await sleep(100);
  }

  // Clear any leftover search text
  if (el instanceof HTMLInputElement && el.value) {
    await bridgeSetTextNoBlur(el, '');
    await sleep(50);
  }

  // Blur and click body to fully deselect
  el.blur();
  document.body.click();
  await sleep(50);
}

export async function fillReactSelect(
  el: HTMLElement,
  value: string,
  isLocation = false,
  category?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (getComboboxDisplayValue(el)) return { status: 'skipped', reason: 'already-filled' };

  // Close any stale dropdown left open by a previous field's failure
  const openMenu = document.querySelector(
    '[class*="select__menu"], [class*="-menu"][id*="react-select"]',
  );
  if (openMenu) {
    await bridgeKeyDown(el, 'Escape', 'Escape', 27);
    await sleep(100);
  }

  // Fast path via React internal state — only for small complete option sets
  // Skip if options look like a lazy-loaded partial list (all starting with same letter)
  const state = await bridgeGetSelectState(el);
  if (state && state.options.length > 0 && state.options.length <= LARGE_DROPDOWN_THRESHOLD) {
    const texts = state.options.map((o) => o.label);
    if (shouldSkipForExportControlMismatch(category, texts)) {
      return { status: 'skipped', reason: 'no-value' };
    }
    // Only use fast path if fuzzy match finds something (no ML fallback — avoid false positives)
    const fuzzy = fuzzyMatchOption(texts, value, false, category);
    if (fuzzy.index >= 0 && fuzzy.score >= 0.7) {
      const ok = await bridgeSetSelectValue(el, texts[fuzzy.index]!);
      if (ok) return { status: 'filled' };
    }
  }

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
    await bridgeSetTextNoBlur(el, searchTerm);

    if (isLocation) {
      await sleep(PLACES_COLD_START_MS);
      options = await waitForOptions(LOCATION_API_RETRY_MS);
      if (options.length === 0) {
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
    // Post-open guard: handles react-selects where bridgeGetSelectState didn't
    // expose options (lazy / virtualized) — the Yes/No shape only becomes
    // visible after the dropdown opens.
    if (shouldSkipForExportControlMismatch(category, texts)) {
      await cleanupReactSelect(el);
      return { status: 'skipped', reason: 'no-value' };
    }

    // If dropdown has many unfiltered options and none contain the search value,
    // the search didn't work — don't false-match against the full list
    if (options.length > LARGE_DROPDOWN_THRESHOLD) {
      const searchLower = value.toLowerCase().split(',')[0]?.trim() ?? '';
      const hasRelevant =
        searchLower.length >= 3 &&
        texts.some(
          (t) => t.toLowerCase().includes(searchLower) || searchLower.includes(t.toLowerCase()),
        );
      if (!hasRelevant) {
        await cleanupReactSelect(el);
        return {
          status: 'failed',
          reason: 'no-option-match',
          discoveredOptions: texts.slice(0, 10),
        };
      }
    }
    const targetIdx = await matchOption(texts, value, isLocation, category, fieldLabel);
    if (targetIdx >= 0) {
      const opt = options[targetIdx]!;

      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      opt.click();
      await sleep(100);
      if (getComboboxDisplayValue(el)) return { status: 'filled' };

      for (let i = 0; i < targetIdx; i++) {
        await bridgeKeyDown(el, 'ArrowDown', 'ArrowDown', 40);
        await sleep(30);
      }
      await bridgeKeyDown(el, 'Enter', 'Enter', 13);
      await sleep(100);
      if (getComboboxDisplayValue(el)) return { status: 'filled' };

      const ok = await bridgeSetSelectValue(el, texts[targetIdx]!);
      if (ok) return { status: 'filled' };

      await cleanupReactSelect(el);
      return { status: 'failed', reason: 'select-failed', discoveredOptions: texts.slice(0, 10) };
    }
  }

  await cleanupReactSelect(el);

  return {
    status: 'failed',
    reason: options.length === 0 ? 'no-dropdown' : 'no-option-match',
    discoveredOptions: texts.slice(0, 10),
  };
}

export async function fillAutocomplete(
  el: HTMLElement,
  value: string,
  isLocation = false,
  category?: string,
  description?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  if (el.value.trim() && !isLocation) return { status: 'skipped', reason: 'already-filled' };
  if (isLocation && isLeverLocationFilled()) return { status: 'skipped', reason: 'already-filled' };

  const cityTerm = isLocation
    ? (value.split(',')[0]?.trim() ?? value).slice(0, 30)
    : (value.split(',')[0]?.split('(')[0]?.trim() ?? value).slice(0, 20);
  const stateTerm = isLocation ? (value.split(',')[1]?.trim() ?? '').slice(0, 30) : '';
  const wantsState = description && /state|province|region/i.test(description);
  let searchTerm = isLocation && wantsState && stateTerm ? stateTerm : cityTerm;

  const isCombobox =
    el.getAttribute('role') === 'combobox' ||
    el.getAttribute('aria-autocomplete') ||
    el.getAttribute('aria-haspopup') === 'listbox';

  if (!isCombobox && isLocation) {
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    el.focus();
    el.click();
    await sleep(300);
    await bridgeSetTextNoBlur(el, searchTerm);
  } else {
    await bridgeSetComboboxValue(el, searchTerm);
  }

  let options = await waitForOptions(
    isLocation ? LOCATION_API_WAIT_MS : DROPDOWN_WAIT_FILTERED_MS,
    true,
  );

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

  if (options.length > 0 && shouldSkipForExportControlMismatch(category, texts)) {
    await bridgeKeyDown(el, 'Escape', 'Escape', 27);
    return { status: 'skipped', reason: 'no-value' };
  }

  if (options.length > 0) {
    const targetIdx = await matchOption(texts, value, isLocation, category, fieldLabel);
    if (targetIdx >= 0) {
      const opt = options[targetIdx]!;
      const selected = texts[targetIdx]!;

      // Strategy 1: Click the option element directly (most reliable)
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      opt.click();

      for (let wait = 0; wait < 5; wait++) {
        await sleep(300);
        if (el.value && el.value !== searchTerm)
          return { status: 'filled', matchedOption: selected };
        if (isLeverLocationFilled()) return { status: 'filled', matchedOption: selected };
        if (el.getAttribute('aria-expanded') === 'false')
          return { status: 'filled', matchedOption: selected };
      }

      // Strategy 2: Keyboard navigation fallback (for comboboxes that ignore click events)
      if (isCombobox) {
        await bridgeKeyDown(el, 'Home', 'Home', 36);
        await sleep(30);
        for (let i = 0; i < targetIdx; i++) {
          await bridgeKeyDown(el, 'ArrowDown', 'ArrowDown', 40);
          await sleep(30);
        }
        await bridgeKeyDown(el, 'Enter', 'Enter', 13);

        for (let wait = 0; wait < 3; wait++) {
          await sleep(200);
          if (el.value && el.value !== searchTerm)
            return { status: 'filled', matchedOption: selected };
          if (el.getAttribute('aria-expanded') === 'false')
            return { status: 'filled', matchedOption: selected };
        }
      }

      if (isLocation) {
        if (el.value.trim() || isLeverLocationFilled())
          return { status: 'filled', matchedOption: selected };
      }

      return { status: 'failed', reason: 'select-failed' };
    }
  }

  if (!isLocation) {
    await bridgeKeyDown(el, 'Escape', 'Escape', 27);
    await sleep(100);
  }

  if (el.value.trim()) return { status: 'filled' };
  if (isLocation && isLeverLocationFilled()) return { status: 'filled' };

  return {
    status: 'failed',
    reason: options.length === 0 ? 'no-dropdown' : 'no-option-match',
    discoveredOptions: texts.slice(0, 10),
  };
}
