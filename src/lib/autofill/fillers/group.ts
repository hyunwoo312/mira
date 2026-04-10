import type { FillOutcome } from '../types';
import { fuzzyMatchOption } from '../match';
import { bridgeSetChecked, bridgeClickButtonGroup } from '../bridge';
import { sleep, findClickTarget, clickElement, findBestOptionIndex } from './shared';

export async function fillCheckbox(el: HTMLElement, value: string): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement)) return { status: 'skipped', reason: 'wrong-type' };
  const shouldCheck = /^(yes|true|1|i agree|i acknowledge|i consent|i accept|i understand)$/i.test(
    value,
  );
  const shouldUncheck = /^(no|false|0)$/i.test(value);

  if (shouldCheck && !el.checked) {
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
  fieldLabel?: string,
): Promise<FillOutcome> {
  const targetIdx = await findBestOptionIndex(labels, value, category, fieldLabel);
  if (targetIdx < 0) return { status: 'failed', reason: 'no-option-match' };

  const el = elements[targetIdx]!;
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await bridgeSetChecked(el, true);
  } else {
    await clickElement(el);
  }
  await sleep(50);
  return { status: 'filled', matchedOption: labels[targetIdx] };
}

export async function fillCheckboxGroup(
  elements: HTMLElement[],
  labels: string[],
  value: string,
  category?: string,
  fieldLabel?: string,
): Promise<FillOutcome> {
  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  let clicked = 0;

  // Try each comma-separated value individually
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

  // Fallback: try full value as one match
  if (clicked === 0) {
    const idx = await findBestOptionIndex(labels, value, category, fieldLabel);
    if (idx >= 0) {
      const el = elements[idx] as HTMLInputElement;
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
  fieldLabel?: string,
): Promise<FillOutcome> {
  const targetIdx = await findBestOptionIndex(labels, value, category, fieldLabel);
  if (targetIdx < 0) return { status: 'failed', reason: 'no-option-match' };

  const btn = elements[targetIdx]!;
  btn.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeClickButtonGroup(btn);
  await sleep(50);
  return { status: 'filled', matchedOption: labels[targetIdx] };
}
