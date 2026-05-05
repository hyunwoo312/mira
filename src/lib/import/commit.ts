import { profileSchema, type Profile } from '@/lib/schema';
import type { ImportMode, ImportCommitResult, ImportPayload } from './types';

/**
 * Pure function. Computes the next profile after applying an import payload
 * under the chosen mode. Empty parsed values never overwrite existing data.
 */
export function commitImport(
  current: Profile,
  payload: ImportPayload,
  mode: ImportMode,
): ImportCommitResult {
  if (mode === 'skip-all') {
    return {
      profile: current,
      attachFile: true,
      fieldsApplied: 0,
      fieldsSkipped: countNonEmptyParsed(payload.fields),
      conflictsResolved: 0,
    };
  }

  const next: Profile = { ...current };
  let fieldsApplied = 0;
  let fieldsSkipped = 0;
  let conflictsResolved = 0;

  for (const [key, value] of Object.entries(payload.fields) as [keyof Profile, unknown][]) {
    if (!isMeaningfulValue(value)) continue;
    const existing = current[key];
    const hasExisting = isMeaningfulValue(existing);

    if (hasExisting && mode === 'skip-conflicts') {
      fieldsSkipped += 1;
      continue;
    }

    if (hasExisting) conflictsResolved += 1;
    (next as unknown as Record<string, unknown>)[key as string] = value;
    fieldsApplied += 1;
  }

  return {
    profile: next,
    attachFile: true,
    fieldsApplied,
    fieldsSkipped,
    conflictsResolved,
  };
}

/** A value is "meaningful" if it's not empty/undefined/empty array. */
export function isMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function countNonEmptyParsed(fields: Partial<Profile>): number {
  return Object.values(fields).filter(isMeaningfulValue).length;
}

/**
 * Drop fields whose parsed values fail schema validation (e.g., a malformed
 * email or out-of-range year). Validates field-by-field so a single bad entry
 * doesn't poison the whole import.
 *
 * Returns only the keys the caller supplied (avoids re-introducing schema
 * defaults that would unintentionally overwrite the existing profile).
 */
export function validateParsedFields(fields: Partial<Profile>): Partial<Profile> {
  const partial = profileSchema.partial();
  const valid: Partial<Profile> = {};
  for (const [key, value] of Object.entries(fields) as [keyof Profile, unknown][]) {
    const single = partial.safeParse({ [key]: value });
    if (single.success) {
      (valid as Record<string, unknown>)[key as string] = value;
    }
  }
  return valid;
}

/**
 * Returns per-field conflict info for the review UI.
 * A conflict is a field where the parsed value would replace existing data.
 */
export function detectConflicts(
  current: Profile,
  fields: Partial<Profile>,
): { conflicts: Set<keyof Profile>; toApply: Set<keyof Profile> } {
  const conflicts = new Set<keyof Profile>();
  const toApply = new Set<keyof Profile>();

  for (const [key, value] of Object.entries(fields) as [keyof Profile, unknown][]) {
    if (!isMeaningfulValue(value)) continue;
    toApply.add(key);
    if (isMeaningfulValue(current[key])) conflicts.add(key);
  }

  return { conflicts, toApply };
}
