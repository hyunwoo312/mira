import type { FillOutcome } from '../types';
import { bridgeSetText } from '../bridge';
import { sleep } from './shared';

export async function fillText(
  el: HTMLElement,
  value: string,
  category?: string,
): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return { status: 'skipped', reason: 'wrong-type' };
  }
  if (el.value.trim()) return { status: 'skipped', reason: 'already-filled' };

  // Categories whose value is always a hardcoded Yes/No (profile has no
  // corresponding freeform field). A plain-text input classified into one
  // of these is almost always asking for richer info than Yes/No — stuffing
  // the boolean in is actively misleading (e.g. ML tagging "Are you in the
  // SF Bay Area? Where?" as locatedInUS and filling "Yes").
  const YES_NO_ONLY_INTO_TEXT_SKIP = new Set(['referral', 'locatedInUS']);
  if (category && YES_NO_ONLY_INTO_TEXT_SKIP.has(category) && /^(yes|no)$/i.test(value.trim())) {
    return { status: 'skipped', reason: 'no-value' };
  }

  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeSetText(el, value);
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

  await sleep(50);
  return el.value.trim() ? { status: 'filled' } : { status: 'failed', reason: 'element-error' };
}
