/**
 * Tier 2 heuristic patterns: ~20 patterns for short, unambiguous field labels.
 * Only matches fields where a single keyword is conclusive (email, phone, name, etc.).
 *
 * Complex fields (consent, sponsorship, EEO, yes/no questions) are handled by:
 * - Tier 1: Options-first classification (options-classify.ts)
 * - Tier 3: ML classifier
 *
 * This eliminates pattern ordering bugs where broad keywords (email, resume)
 * match words embedded in long question text.
 */

const PATTERNS: [RegExp, string][] = [
  // Name
  [/first.?name/i, 'firstName'],
  [/last.?name|family.?name|surname/i, 'lastName'],
  [/^(full\s*)?(legal\s*)?name[\s✱*]*$/i, 'fullName'],
  [/preferred.?name/i, 'preferredName'],

  // Files
  [/resume|cv\b/i, 'resume'],
  [/cover.?letter|letter.*motivation/i, 'coverLetter'],

  // Contact
  [/email/i, 'email'],
  [/country.?code|dial.?code|phone.?code/i, '__skip__'],
  [/phone|tel\b/i, 'phone'],

  // Location / Address
  [/\blocation\b|where.*(?:are|is).*you.*located|current.*location/i, 'location'],
  [/address.?line.?1|^address$|street/i, 'address1'],
  [/address.?line.?2|\bapt\b|\bsuite\b|\bunit\b|\bbuilding\b|\bfloor\b/i, 'address2'],
  [/\bcity\b/i, 'city'],
  [/\bstate\b|province/i, 'state'],
  [/zip|postal/i, 'zipCode'],
  [/^country/i, 'country'],

  // Links
  [/linkedin/i, 'linkedin'],
  [/github/i, 'github'],
  [/twitter|x\s*profile/i, 'twitter'],
  [/^portfolio|portfolio.*url/i, 'portfolio'],
  [/^other\s*(website|url|link)/i, 'otherUrl'],
  [/website/i, 'portfolio'],

  // Short unambiguous EEO labels that ML misclassifies as race
  [/are.*you.*hispanic|^hispanic.*latin/i, 'isHispanic'],

  // Skip — never autofill
  [/salary|compensation|pay.*range|desired.*pay|expected.*pay/i, '__skip__'],
  [/how.*hear|how.*find.*position|how.*learn.*about|where.*hear/i, '__skip__'],
  [/^additional\s*(information|context)|^anything\s*else/i, '__skip__'],

  // Work / Education (simple labels only)
  [/current.?company|^company$|employer/i, 'company'],
  [/current.?title|job.?title/i, 'jobTitle'],
  [/^school$|university|college/i, 'school'],
  [/field.?of.?study|^major$|area.?of.?study|concentration/i, 'fieldOfStudy'],
  [/graduation|grad.*date|expected.*grad/i, 'graduationDate'],
];

// Broad single-word patterns that should NOT match long question labels
const BROAD_CATEGORIES = new Set([
  'email',
  'phone',
  'resume',
  'coverLetter',
  'location',
  'city',
  'state',
  'country',
  'linkedin',
  'github',
  'twitter',
  'portfolio',
]);
const MAX_LABEL_FOR_BROAD = 60;

export function classifyField(label: string): string | null {
  const clean = label.replace(/\s+/g, ' ').trim();
  for (const [pattern, category] of PATTERNS) {
    // Skip broad patterns on long labels (they match words in question text)
    if (clean.length > MAX_LABEL_FOR_BROAD && BROAD_CATEGORIES.has(category)) continue;
    if (pattern.test(clean)) return category;
  }
  return null;
}
