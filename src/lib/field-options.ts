/**
 * Centralized option definitions for all dropdown/select fields in the profile.
 *
 * Profile schema stores numeric indices (0-based). This module provides:
 *   - Option labels for UI rendering
 *   - Fill values for autofill (may differ from display labels)
 *   - Lookup helpers to convert between indices and strings
 *   - Migration helpers to convert old string-based values to indices
 */

export interface FieldOption {
  label: string;
  /** Value sent to the autofill pipeline. Defaults to label if not specified. */
  fillValue?: string;
}

function defineOptions(options: (string | FieldOption)[]): FieldOption[] {
  return options.map((o) => (typeof o === 'string' ? { label: o } : o));
}

// ── EEO Fields ──

export const GENDER_OPTIONS = defineOptions([
  'Male',
  'Female',
  'Non-binary',
  'Decline to self-identify',
]);

export const TRANSGENDER_OPTIONS = defineOptions(['Yes', 'No', 'Decline to self-identify']);

export const SEXUAL_ORIENTATION_OPTIONS = defineOptions([
  'Heterosexual / Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Queer',
  'Asexual',
  'Pansexual',
  'Prefer not to say',
  'Not listed / Other',
]);

export const RACE_OPTIONS = defineOptions([
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or More Races',
  'Decline to self-identify',
]);

export const VETERAN_STATUS_OPTIONS = defineOptions([
  'I am not a protected veteran',
  'I identify as a protected veteran',
  'Decline to self-identify',
]);

export const DISABILITY_STATUS_OPTIONS = defineOptions([
  'Yes, I have a disability',
  'No, I do not have a disability',
  'Decline to self-identify',
]);

// ── Preferences Fields ──

export const VISA_TYPE_OPTIONS = defineOptions([
  'US Citizen',
  'Green Card / Permanent Resident',
  'H-1B',
  'L-1',
  'O-1',
  'TN',
  'E-2',
  'OPT',
  'CPT',
  'F-1',
  'Other',
]);

export const SECURITY_CLEARANCE_OPTIONS = defineOptions([
  'None',
  'Confidential',
  'Secret',
  'Top Secret',
  'TS/SCI',
]);

export const NOTICE_PERIOD_OPTIONS = defineOptions([
  'Immediately',
  '2 weeks',
  '1 month',
  '2 months',
  '3+ months',
]);

export const WORK_ARRANGEMENT_OPTIONS = defineOptions(['Remote', 'Hybrid', 'On-site']);

// ── Lookup Helpers ──

/** Get the display label for a field option by index. Returns '' if index is out of range or -1. */
export function getLabel(options: FieldOption[], index: number): string {
  if (index < 0 || index >= options.length) return '';
  return options[index]!.label;
}

/** Get the fill value for a field option by index. Returns '' if invalid. */
export function getFillValue(options: FieldOption[], index: number): string {
  if (index < 0 || index >= options.length) return '';
  const opt = options[index]!;
  return opt.fillValue ?? opt.label;
}

/** Find the index for a display label string (for migrating old string values). Case-insensitive partial match. */
export function findIndex(options: FieldOption[], value: string): number {
  if (!value) return -1;
  const lower = value.toLowerCase().trim();
  // Exact match first
  const exact = options.findIndex((o) => o.label.toLowerCase() === lower);
  if (exact >= 0) return exact;
  // Partial match (old values may be abbreviated)
  const partial = options.findIndex(
    (o) => lower.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(lower),
  );
  return partial;
}

/** Check if an index is valid for the given options. */
export function isValidIndex(options: FieldOption[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < options.length;
}

/**
 * All dropdown field definitions, keyed by schema field name.
 * Used by the migration system and validation.
 */
export const DROPDOWN_FIELDS: Record<string, FieldOption[]> = {
  gender: GENDER_OPTIONS,
  transgender: TRANSGENDER_OPTIONS,
  sexualOrientation: SEXUAL_ORIENTATION_OPTIONS,
  race: RACE_OPTIONS,
  veteranStatus: VETERAN_STATUS_OPTIONS,
  disabilityStatus: DISABILITY_STATUS_OPTIONS,
  visaType: VISA_TYPE_OPTIONS,
  securityClearance: SECURITY_CLEARANCE_OPTIONS,
  noticePeriod: NOTICE_PERIOD_OPTIONS,
};
