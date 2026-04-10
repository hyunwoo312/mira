import type { ClassifyResult } from '../types';
import { fuzzyMatchOption } from '../match';
import { matchByConcept } from './concept-match';

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

export function classifyOptions(
  options: string[],
  intendedValue: string,
  category?: string,
  userLocation?: string,
): ClassifyResult {
  const noMatch: ClassifyResult = { index: -1, confidence: 0, matchedText: '' };
  if (options.length === 0) return noMatch;

  // Layer 1: Fuzzy matching (exact, alias, contains, Jaro-Winkler)
  const isLocation = category === 'location' || category === 'city' || category === 'state';
  const fuzzy = fuzzyMatchOption(options, intendedValue, isLocation, category);
  if (fuzzy.index >= 0) {
    return {
      index: fuzzy.index,
      confidence: fuzzy.score,
      matchedText: options[fuzzy.index]!,
    };
  }

  // Layer 2: Concept matching (yes/no/boolean semantic — skip for non-boolean categories)
  if (!category || !NO_CONCEPT_MATCH.has(category)) {
    const conceptIdx = matchByConcept(options, intendedValue, userLocation);
    if (conceptIdx >= 0) {
      return {
        index: conceptIdx,
        confidence: 0.8,
        matchedText: options[conceptIdx]!,
      };
    }
  }

  // Layer 3: Location-specific scoring (city/state parsing, abbreviation lookup)
  if (isLocation && options.length > 0) {
    const valueParts = intendedValue.split(',').map((p) => p.trim());
    const city = (valueParts[0] ?? '').toLowerCase();
    const state = (valueParts[1] ?? '').toLowerCase();
    const parts = [city, state].filter((p) => p.length >= 2);

    const stateAbbr = STATE_ABBREVS[state];
    if (stateAbbr) parts.push(stateAbbr);

    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!.toLowerCase();
      let score = parts.filter((p) => opt.includes(p)).length * 10;
      if (opt.startsWith(city + ',') || opt.startsWith(city + ' ,')) score += 5;
      score -= Math.floor(opt.length / 20);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      return {
        index: bestIdx,
        confidence: Math.min(bestScore / 25, 1),
        matchedText: options[bestIdx]!,
      };
    }
  }

  return noMatch;
}
