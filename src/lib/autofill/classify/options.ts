import aliasData from '@/data/aliases.json';

type AliasMap = Record<string, Record<string, string[]>>;
const aliases = aliasData as AliasMap;

/** Build a Set of all normalized forms (canonical + aliases) for an alias category. */
function buildFormSet(aliasCategory: string): Set<string> {
  const set = new Set<string>();
  const entries = aliases[aliasCategory];
  if (!entries) return set;
  for (const [canonical, alts] of Object.entries(entries)) {
    set.add(canonical.toLowerCase());
    for (const alt of alts) set.add(alt.toLowerCase());
  }
  return set;
}

// Generic terms that appear as aliases in many categories — skip these for option matching
const GENERIC_TERMS = new Set([
  'yes',
  'no',
  'true',
  'false',
  'y',
  'n',
  'decline',
  'prefer not to say',
  'prefer not to answer',
  'i do not wish to answer',
  'choose not to disclose',
  'i am',
  'i am not',
  'i do',
  'i do not',
  "i don't",
]);

/** Count how many options match any form in the given set (excluding generic terms). */
function countMatches(options: string[], forms: Set<string>): number {
  let count = 0;
  for (const opt of options) {
    const norm = opt.toLowerCase().trim();
    if (GENERIC_TERMS.has(norm)) continue; // Skip generic yes/no/decline
    if (forms.has(norm)) {
      count++;
      continue;
    }
    for (const form of forms) {
      if (GENERIC_TERMS.has(form)) continue;
      if (form.length >= 4 && (norm.includes(form) || form.includes(norm))) {
        count++;
        break;
      }
    }
  }
  return count;
}

/** Check if any option contains the given keyword. */
function anyOptionContains(options: string[], keyword: string): boolean {
  const kw = keyword.toLowerCase();
  return options.some((o) => o.toLowerCase().includes(kw));
}

// Pre-built form sets
const GENDER_FORMS = buildFormSet('gender');
const RACE_FORMS = buildFormSet('race');
const DEGREE_FORMS = buildFormSet('degrees');
const COUNTRY_FORMS = buildFormSet('countries');
const STATE_FORMS = buildFormSet('states');
const LGBTQ_FORMS = buildFormSet('lgbtq');

// Orientation terms (not in aliases.json — build manually)
const ORIENTATION_TERMS = new Set([
  'heterosexual',
  'straight',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
  'asexual',
  'queer',
  'questioning',
  'heterosexual / straight',
]);

interface OptionSignature {
  category: string;
  detect: (options: string[]) => boolean;
}

const SIGNATURES: OptionSignature[] = [
  {
    category: 'gender',
    detect: (opts) => countMatches(opts, GENDER_FORMS) >= 2 && opts.length <= 8,
  },
  {
    category: 'race',
    detect: (opts) => countMatches(opts, RACE_FORMS) >= 3,
  },
  {
    category: 'veteranStatus',
    detect: (opts) =>
      anyOptionContains(opts, 'veteran') &&
      opts.length >= 2 &&
      opts.length <= 6 &&
      opts.some((o) => o.toLowerCase().trim().length > 5), // Not just ["Yes", "No"]
  },
  {
    category: 'disabilityStatus',
    detect: (opts) =>
      anyOptionContains(opts, 'disability') &&
      opts.length >= 2 &&
      opts.length <= 6 &&
      opts.some((o) => o.toLowerCase().trim().length > 5),
  },
  {
    category: 'degree',
    detect: (opts) => countMatches(opts, DEGREE_FORMS) >= 3,
  },
  {
    category: 'sexualOrientation',
    detect: (opts) => {
      let matches = 0;
      for (const opt of opts) {
        const norm = opt.toLowerCase().trim();
        for (const term of ORIENTATION_TERMS) {
          if (norm.includes(term)) {
            matches++;
            break;
          }
        }
      }
      return matches >= 2;
    },
  },
  {
    category: 'lgbtq',
    detect: (opts) => countMatches(opts, LGBTQ_FORMS) >= 2 && opts.length <= 6,
  },
  {
    category: 'communities',
    detect: (opts) =>
      anyOptionContains(opts, 'veteran') &&
      anyOptionContains(opts, 'disability') &&
      opts.length >= 3,
  },
  // howDidYouHear skipped — varies per application, user fills manually
  {
    category: 'country',
    detect: (opts) => opts.length >= 50 && countMatches(opts, COUNTRY_FORMS) >= 5,
  },
  {
    category: 'state',
    detect: (opts) =>
      opts.length >= 10 && opts.length <= 60 && countMatches(opts, STATE_FORMS) >= 5,
  },
];

/**
 * Classify a field by its option content.
 * Returns a category string or null if options are inconclusive
 * (e.g., Yes/No pairs that need label context).
 */
export function classifyByOptions(options: string[]): string | null {
  if (!options || options.length < 2) return null;

  for (const sig of SIGNATURES) {
    if (sig.detect(options)) return sig.category;
  }

  return null;
}
