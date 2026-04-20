import type { FillOutcome } from '../types';
import { bridgeSetText, bridgeClick, bridgeWorkdayMonikerSearch } from '../bridge';
import { sleep, findBestOptionIndex } from './shared';
import { waitForWorkdayListbox, getDropdownSynonyms, parseDateValue } from '../workday/utils';

export async function fillWorkdayMultiselect(
  el: HTMLElement,
  value: string,
  category?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };

  const container = el.closest('[data-uxi-widget-type="multiselect"]');
  const existingPills = container?.querySelectorAll('[data-automation-id^="selectedItem"]');
  if (existingPills && existingPills.length > 0) {
    return { status: 'skipped', reason: 'already-filled' };
  }

  const firstSegment = value.split(/,|\(|\s-\s/)[0]?.trim() ?? value;
  const searchTerm = firstSegment.split(/\s+/).slice(0, 3).join(' ').slice(0, 40);
  if (!searchTerm) return { status: 'skipped', reason: 'no-value' };

  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  const ok = await bridgeWorkdayMonikerSearch(el, searchTerm);
  if (!ok) return { status: 'failed', reason: 'element-error' };
  await sleep(700);

  if (container?.querySelector('[data-automation-id^="selectedItem"]')) {
    return { status: 'filled', matchedOption: searchTerm };
  }

  const options = collectMonikerOptions(container);
  if (options.length === 0) return { status: 'failed', reason: 'no-dropdown' };

  const texts = options.map((o) => o.textContent?.trim() ?? '');
  let idx = await findBestOptionIndex(texts, value, category, fieldLabel);
  if (idx < 0) {
    return {
      status: 'failed',
      reason: 'no-option-match',
      discoveredOptions: texts.slice(0, 10),
    };
  }
  idx = preferMainCampus(texts, value, idx);

  // Workday's onClick handler sits on the <li data-automation-id="menuItem">
  // ancestor. If findBestOptionIndex matched a child (role="option"/promptOption),
  // walk up to the menuItem for the click target.
  const clickTarget =
    (options[idx]!.closest('li[data-automation-id="menuItem"]') as HTMLElement | null) ??
    options[idx]!;
  await bridgeClick(clickTarget);
  await sleep(350);

  // Verify the commit actually happened: a selection pill should appear.
  if (container?.querySelector('[data-automation-id^="selectedItem"]')) {
    return { status: 'filled', matchedOption: texts[idx] };
  }
  return {
    status: 'failed',
    reason: 'select-failed',
    discoveredOptions: texts.slice(0, 10),
  };
}

// Multi-campus university override: when every option shares a set of common
// tokens (e.g. {pennsylvania, state, university}), and the fuzzy-picked
// option's distinctive tokens have zero overlap with the user value's
// distinctive tokens, prefer a "Main Campus" option if one exists. Fixes
// Penn State ("University Park" → "Main Campus") without hardcoding schools.
function preferMainCampus(texts: string[], value: string, idx: number): number {
  if (texts.length < 3) return idx;
  const mainIdx = texts.findIndex((t) => /\bmain\s+campus\b/i.test(t));
  if (mainIdx < 0 || mainIdx === idx) return idx;

  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[\s\-,./:]+/)
        .filter((w) => w.length >= 3),
    );

  const commonTokens = texts
    .map((t) => tokenize(t))
    .reduce((acc, t) => new Set([...acc].filter((x) => t.has(x))));
  if (commonTokens.size === 0) return idx;

  const valueDistinctive = new Set([...tokenize(value)].filter((t) => !commonTokens.has(t)));
  if (valueDistinctive.size === 0) return idx;

  const pickedDistinctive = new Set([...tokenize(texts[idx]!)].filter((t) => !commonTokens.has(t)));
  const overlap = [...valueDistinctive].filter((t) => pickedDistinctive.has(t)).length;
  return overlap === 0 ? mainIdx : idx;
}

function collectMonikerOptions(container: Element | null): HTMLElement[] {
  // Prefer Workday's li[data-automation-id="menuItem"] (the actual clickable
  // target per their own config); fall back to promptOption or role=option
  // (these may be children of menuItem, so clicking them can miss the handler).
  const sources: HTMLElement[][] = [];
  if (container?.id) {
    const scope = `[data-associated-widget="${container.id}"]`;
    sources.push(
      Array.from(
        document.querySelectorAll<HTMLElement>(`${scope} li[data-automation-id="menuItem"]`),
      ),
    );
    sources.push(
      Array.from(
        document.querySelectorAll<HTMLElement>(`${scope} [data-automation-id="promptOption"]`),
      ),
    );
    sources.push(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `${scope} [role="option"]:not([aria-disabled="true"])`,
        ),
      ),
    );
  }
  sources.push(
    Array.from(document.querySelectorAll<HTMLElement>('li[data-automation-id="menuItem"]')),
  );
  sources.push(
    Array.from(document.querySelectorAll<HTMLElement>('[data-automation-id="promptOption"]')),
  );
  sources.push(
    Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
    ),
  );
  for (const list of sources) {
    if (list.length > 0) return list;
  }
  return [];
}

export async function fillWorkdayDropdown(
  el: HTMLElement,
  value: string,
  _category?: string,
): Promise<FillOutcome> {
  const button =
    el instanceof HTMLButtonElement
      ? el
      : el.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
  if (!button) return { status: 'failed', reason: 'element-error' };

  const synonyms = getDropdownSynonyms(value, _category);

  const currentText = button.textContent?.trim().toLowerCase() ?? '';
  if (currentText !== 'select one' && synonyms.some((s) => currentText === s.toLowerCase())) {
    return { status: 'filled' };
  }

  const existingPoppers = document.querySelectorAll(
    '[data-popper-placement], [visibility="opened"]',
  );
  if (existingPoppers.length > 0) {
    document.body.click();
    await sleep(300);
  }

  button.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  button.focus();
  button.click();
  await sleep(500);

  const listbox = await waitForWorkdayListbox(3000);
  if (!listbox) {
    document.body.click();
    await sleep(200);
    return { status: 'failed', reason: 'no-dropdown' };
  }

  const options = Array.from(
    listbox.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
  );
  const optTexts = options.map((o) => o.textContent?.trim().toLowerCase() ?? '');

  // Find the best matching option BEFORE clicking anything
  let matchIdx = -1;

  // Pass 1: exact match
  for (const synonym of synonyms) {
    const idx = optTexts.indexOf(synonym.toLowerCase());
    if (idx >= 0) {
      matchIdx = idx;
      break;
    }
  }

  // Pass 2: starts-with (prefer shortest)
  if (matchIdx < 0) {
    for (const synonym of synonyms) {
      const synLower = synonym.toLowerCase();
      let bestIdx = -1;
      let bestLen = Infinity;
      for (let i = 0; i < optTexts.length; i++) {
        if (optTexts[i]!.startsWith(synLower) || synLower.startsWith(optTexts[i]!)) {
          if (optTexts[i]!.length < bestLen) {
            bestIdx = i;
            bestLen = optTexts[i]!.length;
          }
        }
      }
      if (bestIdx >= 0) {
        matchIdx = bestIdx;
        break;
      }
    }
  }

  // Pass 3: keyword overlap (>=50%)
  if (matchIdx < 0) {
    const valueWords = new Set(
      value
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    if (valueWords.size > 0) {
      let bestIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < optTexts.length; i++) {
        const optWords = optTexts[i]!.split(/\s+/).filter((w) => w.length > 2);
        const overlap = optWords.filter((w) => valueWords.has(w)).length;
        const score = overlap / Math.max(optWords.length, 1);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestScore >= 0.5) matchIdx = bestIdx;
    }
  }

  // No match — close dropdown cleanly and return
  if (matchIdx < 0) {
    button.click();
    await sleep(200);
    document.body.click();
    await sleep(200);
    return { status: 'failed', reason: 'no-option-match' };
  }

  // Match found — click the option
  await bridgeClick(options[matchIdx]!);
  await sleep(150);
  return { status: 'filled' };
}

async function fillSpinbutton(input: HTMLInputElement, value: string): Promise<void> {
  const section = input.closest('[tabindex]') as HTMLElement;
  if (section) {
    section.click();
    await sleep(150);
  }
  await bridgeSetText(input, value);
  await sleep(200);
}

export async function fillWorkdayDate(el: HTMLElement, value: string): Promise<FillOutcome> {
  const wrapper = el.closest('[data-automation-id="dateInputWrapper"]') ?? el;
  const parsed = parseDateValue(value);
  if (!parsed.year) return { status: 'skipped', reason: 'no-value' };

  let filled = false;

  const monthInput = wrapper.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionMonth-input"]',
  );
  if (monthInput && parsed.month) {
    await fillSpinbutton(monthInput, parsed.month);
    filled = true;
  }

  const dayInput = wrapper.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionDay-input"]',
  );
  if (dayInput && parsed.day) {
    await fillSpinbutton(dayInput, parsed.day);
    filled = true;
  }

  const yearInput = wrapper.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionYear-input"]',
  );
  if (yearInput && parsed.year) {
    await fillSpinbutton(yearInput, parsed.year);
    filled = true;
  }

  return filled ? { status: 'filled' } : { status: 'failed', reason: 'element-error' };
}

export async function fillWorkdayVirtualizedCheckbox(
  el: HTMLElement,
  groupElements: HTMLElement[],
  groupLabels: string[],
  value: string,
  _category?: string,
): Promise<FillOutcome> {
  if (groupElements.length === 0 || groupLabels.length === 0) {
    return { status: 'failed', reason: 'element-error' };
  }

  const valueLower = value.toLowerCase().trim();

  for (let i = 0; i < groupLabels.length; i++) {
    const labelText = groupLabels[i]!.toLowerCase().trim();
    if (
      labelText === valueLower ||
      labelText.includes(valueLower) ||
      valueLower.includes(labelText.replace(/\s*\(.*\)$/, ''))
    ) {
      const checkbox = groupElements[i] as HTMLInputElement;
      if (checkbox && !checkbox.checked) {
        checkbox.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        checkbox.click();
        await sleep(100);
      }
      return { status: 'filled' };
    }
  }

  return { status: 'failed', reason: 'no-option-match' };
}
