import { bridgeSetChecked, bridgeClick } from '../bridge';
import { fuzzyMatchOption } from '../match';
import { matchByConcept } from '../engine/concept-match';
import { scoreOptionsWithML } from '../classify/ml';

/** Categories where concept matching (yes/no semantic) should not apply. */
export const NO_CONCEPT_MATCH = new Set([
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

/**
 * Returns true when an option set is limited to simple Yes/No/decline-style
 * choices. Used to short-circuit fills for categories whose profile value
 * doesn't semantically fit a Yes/No dropdown (e.g. exportControl's
 * "U.S. person" vs. a Yes/No OFAC question where "Yes" means the opposite).
 */
export function isYesNoOnlyOptionSet(options: string[]): boolean {
  if (options.length === 0 || options.length > 4) return false;
  return options.every((o) =>
    /^(yes|no|decline|decline to (?:answer|self-identify)|prefer not to (?:say|answer|disclose)|n\/a|not applicable)$/i.test(
      o.trim(),
    ),
  );
}

/**
 * Unified option matching: fuzzy → concept → ML scoring.
 * Single source of truth for the matching chain used across all fillers.
 */
export async function findBestOptionIndex(
  options: string[],
  value: string,
  category?: string,
  fieldLabel?: string,
): Promise<number> {
  // Single-option formality dropdowns ("Thank you", "I acknowledge", etc.) —
  // the form can't be submitted without that option, so pick it when the
  // profile value is affirmative/consent-shaped. Classification routes these
  // to `consent` (value "Yes"), so the guard fires naturally.
  if (
    options.length === 1 &&
    /^(yes|true|1|acknowledge|agree|accept|confirm|consent|ok(?:ay)?|thank\s*you)$/i.test(
      value.trim(),
    )
  ) {
    return 0;
  }

  const match = fuzzyMatchOption(options, value, false, category);
  if (match.index >= 0) return match.index;

  if (!category || !NO_CONCEPT_MATCH.has(category)) {
    const conceptIdx = matchByConcept(options, value);
    if (conceptIdx >= 0) return conceptIdx;
  }

  if (fieldLabel && options.length > 0 && options.length <= 20) {
    try {
      const mlResult = await scoreOptionsWithML(fieldLabel, value, options);
      if (mlResult.bestIndex >= 0) return mlResult.bestIndex;
    } catch {
      /* ML not available */
    }
  }

  return -1;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function findClickTarget(el: HTMLElement): HTMLElement {
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

export async function clickElement(el: HTMLElement): Promise<void> {
  const target = findClickTarget(el);
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeClick(target);
}

export async function checkTarget(el: HTMLElement, checked: boolean): Promise<void> {
  const target = findClickTarget(el);
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeSetChecked(target, checked);
}

export function isLeverLocationFilled(): boolean {
  const hidden = document.querySelector<HTMLInputElement>('#selected-location');
  return !!(hidden && hidden.value.trim());
}

export const DROPDOWN_WAIT_MS = 300;
export const DROPDOWN_WAIT_FILTERED_MS = 400;
export const LOCATION_API_WAIT_MS = 5000;
export const LOCATION_API_RETRY_MS = 3000;
export const PLACES_COLD_START_MS = 800;
export const LARGE_DROPDOWN_THRESHOLD = 20;

const OPTION_SELECTOR =
  '.select__option, [role="listbox"] [role="option"]:not(.iti__country), [role="listbox"] [class*="_result"], .dropdown-location, .dropdown-results > div, [data-floating-ui-portal] [role="option"], div[id^="floating-ui-"] [role="option"], .pac-container .pac-item';

export function getComboboxDisplayValue(el: HTMLElement): string {
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

export function waitForOptions(timeout = 300, waitForNew = false): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    const existingCount = waitForNew ? getVisibleOptions().length : 0;
    const check = () => {
      const visible = getVisibleOptions();
      if (waitForNew) {
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
    if (!waitForNew) check();
  });
}
