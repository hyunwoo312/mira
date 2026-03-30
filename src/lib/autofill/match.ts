/**
 * Single fuzzy matcher used by all option-based input types.
 * Handles alias matching, normalization, and contains matching.
 * Alias lookups are category-scoped to prevent cross-contamination.
 */

import aliasData from '@/data/aliases.json';

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

/** Jaro similarity between two strings (0–1) */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const al = a.length;
  const bl = b.length;
  if (al === 0 || bl === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(al, bl) / 2) - 1);
  const aMatched = new Array(al).fill(false);
  const bMatched = new Array(bl).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < al; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(bl - 1, i + matchWindow);
    for (let j = lo; j <= hi; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < al; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  return (matches / al + matches / bl + (matches - transpositions / 2) / matches) / 3;
}

/** Jaro-Winkler similarity (0–1). Boosts score for common prefixes. */
function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }
  return j + prefix * prefixScale * (1 - j);
}

// Category-scoped alias lookup: aliasCategory → (normalized form → all normalized forms)
const SCOPED_ALIASES = new Map<string, Map<string, string[]>>();
// Flat lookup (fallback when no category specified)
const FLAT_ALIASES = new Map<string, string[]>();

for (const [aliasCategory, entries] of Object.entries(aliasData)) {
  const scopedMap = new Map<string, string[]>();
  for (const [canonical, aliases] of Object.entries(entries as Record<string, string[]>)) {
    const allForms = [canonical, ...aliases].map(norm);
    for (const form of allForms) {
      scopedMap.set(form, allForms);
      FLAT_ALIASES.set(form, allForms);
    }
  }
  SCOPED_ALIASES.set(aliasCategory, scopedMap);
}

// Map field categories to alias categories
const CATEGORY_TO_ALIAS: Record<string, string> = {
  gender: 'gender',
  race: 'race',
  isHispanic: 'race',
  veteranStatus: 'veteran',
  disabilityStatus: 'disability',
  workAuth: 'yesNo',
  sponsorship: 'yesNo',
  relocate: 'yesNo',
  workedHereBefore: 'yesNo',
  flexwork: 'yesNo',
  isOver18: 'yesNo',
  canWorkFromLocation: 'yesNo',
  accommodationRequest: 'yesNo',
  consent: 'yesNo',
  smsConsent: 'yesNo',
  willingToTravel: 'yesNo',
  visaType: 'visaType',
  lgbtq: 'lgbtq',
  country: 'countries',
  state: 'states',
  degree: 'degrees',
  startDate: 'noticePeriod',
};

function getAliasFormsScoped(value: string, fieldCategory?: string): string[] {
  const n = norm(value);

  // If we have a field category, use scoped lookup
  if (fieldCategory) {
    const aliasCategory = CATEGORY_TO_ALIAS[fieldCategory];
    if (aliasCategory) {
      const scopedMap = SCOPED_ALIASES.get(aliasCategory);
      if (scopedMap) {
        return scopedMap.get(n) ?? [n];
      }
    }
  }

  // Fallback to flat lookup
  return FLAT_ALIASES.get(n) ?? [n];
}

/**
 * Find the best matching option index.
 * @param options - dropdown/radio option texts
 * @param value - the profile value to match
 * @param allowFirst - allow first-option fallback (location autocomplete)
 * @param fieldCategory - the detected field category (for scoped alias lookup)
 */
export function fuzzyMatchOption(
  options: string[],
  value: string,
  allowFirst = false,
  fieldCategory?: string,
): { index: number; score: number } {
  const normedValue = norm(value);
  const normed = options.map(norm);

  // 1. Direct exact match (no alias lookup)
  const directIdx = normed.indexOf(normedValue);
  if (directIdx >= 0) return { index: directIdx, score: 1 };

  // 2. Category-scoped alias exact match (most precise)
  const forms = getAliasFormsScoped(value, fieldCategory);
  for (const form of forms) {
    const idx = normed.indexOf(form);
    if (idx >= 0) return { index: idx, score: 1 };
  }

  // 3. Direct contains match — with word boundary for short values
  if (normedValue.length >= 4) {
    for (let i = 0; i < normed.length; i++) {
      if (normed[i]!.length < 4) continue;
      if (normedValue.length < 8) {
        if (normed[i]!.startsWith(normedValue)) {
          return { index: i, score: 0.85 };
        }
      } else {
        if (normed[i]!.length >= 5) {
          const wordBoundary = new RegExp(
            `\\b${normedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          );
          if (wordBoundary.test(normed[i]!) || normedValue.includes(normed[i]!)) {
            return { index: i, score: 0.85 };
          }
        }
      }
    }
  }

  // 4. Category-scoped alias contains match (min 4 chars)
  for (const form of forms) {
    if (form.length < 4) continue;
    for (let i = 0; i < normed.length; i++) {
      if (normed[i]!.length < 4) continue;
      // Word boundary for alias contains too — prevent "male" alias matching "female"
      const aliasWordBoundary = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (aliasWordBoundary.test(normed[i]!) || form.includes(normed[i]!)) {
        return { index: i, score: 0.7 };
      }
    }
  }

  // 5. Jaro-Winkler similarity (for close misspellings/formatting differences)
  if (normedValue.length >= 3) {
    let bestIdx = -1;
    let bestScore = 0;
    const minSimilarity = 0.85; // Jaro-Winkler threshold
    for (let i = 0; i < normed.length; i++) {
      if (normed[i]!.length < 3) continue;
      const sim = jaroWinkler(normedValue, normed[i]!);
      if (sim > bestScore && sim >= minSimilarity) {
        bestScore = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      return { index: bestIdx, score: Math.round(bestScore * 100) / 100 };
    }
  }

  // 6. First option fallback (only for location autocomplete)
  if (allowFirst && options.length > 0) return { index: 0, score: 0.3 };

  return { index: -1, score: 0 };
}
