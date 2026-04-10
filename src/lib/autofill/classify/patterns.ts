/**
 * Heuristic pattern matching for unambiguous, short-label fields.
 *
 * These patterns handle the obvious 70-80% of fields instantly (no ML needed):
 * name, email, phone, resume, links, location/address, and skip patterns.
 *
 * Everything else (sponsorship, work auth, relocation, EEO, consent,
 * custom questions) falls to the ML model which handles phrasing variants
 * and contextual understanding better than regex.
 */
const PATTERNS: [RegExp, string][] = [
  // ── Skip: Conditional/follow-up fields (HIGHEST priority) ──
  [
    /^if\s+(?:you\s+)?["'\u201C\u201D\u2018\u2019]?(?:select|yes|no|so)\b|please\s+(specify|describe|explain|elaborate)/i,
    '__skip__',
  ],

  // ── Skip: Fields we intentionally don't fill ──
  [
    /does.*(?:salary|compensation).*meet|(?:salary|compensation).*(?:satisfy|acceptable)/i,
    '__skip__',
  ],
  [/how.*hear|how.*find.*position|how.*learn.*about|where.*hear/i, '__skip__'],
  [/how.*(?:do|did).*know\s+(?:them|him|her|each)/i, '__skip__'],
  [/^additional\s*(information|context)|^anything\s*else/i, '__skip__'],
  [
    /work.*(?:for|with).*(?:dealer|partner|supplier|competitor|client)|conflict.*interest|restrictive.*covenant|non.?compete/i,
    '__skip__',
  ],
  [
    /how\s+many\s+years.*experience|years\s+of\s+(?:relevant\s+)?experience|^years\s+of\s+experience/i,
    '__skip__',
  ],
  [
    /favorite.*(?:language|tool|technolog|framework)|preferred.*(?:language|tool|stack)/i,
    '__skip__',
  ],
  [/country.?code|dial.?code|phone.?code/i, '__skip__'],
  [
    /(?:directly\s+)?employed\s+by.*(?:government|military|state.owned|publicly.funded)/i,
    '__skip__',
  ],

  // ── Name ──
  [/first.?name.*last.?name/i, 'fullName'],
  [/preferred.*name/i, 'preferredName'],
  [/first.?name/i, 'firstName'],
  [/last.?name|family.?name|surname/i, 'lastName'],
  [/^(full\s*)?(legal\s*)?name[\s✱*]*$/i, 'fullName'],

  // ── Files ──
  [/resume|cv\b/i, 'resume'],
  [/cover.?letter|letter.*motivation/i, 'coverLetter'],

  // ── Contact ──
  [/email/i, 'email'],
  [/\bphonetic\b/i, '__skip__'],
  [/phone|tel\b/i, 'phone'],

  // ── Location / Address ──
  [
    /^location$|(?<!\brelocat\w*\b.{0,40})\blocation\b(?!.*\brelocat)|where.*(?:are|is).*you.*located|current.*location/i,
    'location',
  ],
  [/address.?line.?1|^address$|street/i, 'address1'],
  [/address.?line.?2|\bapt\b|\bsuite\b|\bunit\b|\bbuilding\b|\bfloor\b/i, 'address2'],
  [/\bcity\b/i, 'city'],
  [/\bstate\b|province/i, 'state'],
  [/zip|postal/i, 'zipCode'],
  [/^country|select.*country.*reside|country.*currently.*reside|country.*you.*live/i, 'country'],

  // ── Links ──
  [/linkedin/i, 'linkedin'],
  [/github/i, 'github'],
  [/twitter|x\s*profile/i, 'twitter'],
  [/^portfolio|portfolio.*url/i, 'portfolio'],
  [/^other\s*(website|url|link)/i, 'otherUrl'],
  [/website/i, 'portfolio'],

  // ── Categories where ML is unreliable — heuristic backstop ──
  [
    /(?:have.*you|previously).*(worked (?:for|at|here)|been employed|employed (?:at|by))(?!.*customer|.*partner|.*Ernst)/i,
    'workedHereBefore',
  ],
  [
    /legally\s+(?:permitted|authorized|allowed).*work|legal.*(?:right|permission).*work/i,
    'workAuth',
  ],
  [/proof\s+of\s+e?ligib|provide.*proof.*(?:eligib|employ|work)/i, 'canProvideDoc'],
  [/desired\s+start\s*date|when.*(?:can|could).*(?:you\s+)?start/i, 'startDate'],
  [
    /desired.*(?:salary|compensation)|(?:salary|compensation).*(?:expectation|requirement)/i,
    'salaryRange',
  ],

  // ── Consent / Terms ──
  [
    /terms\s+and\s+conditions|terms\s+of\s+(?:service|use)|privacy\s+polic|(?:read|agree).*(?:terms|policies|disclaimer)/i,
    'consent',
  ],

  // ── Sponsorship (short labels) ──
  [/^sponsorship\b/i, 'sponsorship'],

  // ── Categories not in ML label map — must stay as heuristics ──
  [/are.*you.*hispanic|^hispanic.*latin/i, 'isHispanic'],
  [
    /(?:were|was).*you.*refer|refer(?:red|ral).*(?:by|from|through)|who.*referred|employee.*referral/i,
    'referral',
  ],
  [
    /(?:have|do).*(?:you|any).*relativ.*(?:employ|work)|family.*member.*(?:employ|work)/i,
    'referral',
  ],
  [/\bitar\b|export.*regulat|export.*control|u\.?s\.?\s*person/i, 'exportControl'],
  [/currently.*located.*in.*(?:us|u\.s|united\s+states)/i, 'locatedInUS'],
  [/currently.*enrolled|enrolled.*university|enrolled.*program/i, 'currentlyEnrolled'],
  [
    /full.?time.*offer|full.?time.*opportunity|convert.*full.?time|interested.*full.?time/i,
    'fullTimeInterest',
  ],

  // ── Work / Education (short unambiguous labels only) ──
  [/^notice\s*period|notice.*(?:period|required)/i, 'noticePeriod'],
  [/current.?company|^company$|employer|most\s+recent\s+company/i, 'company'],
  [/current.?title|job.?title|most\s+recent\s+title/i, 'jobTitle'],
  [/^school$|university|college/i, 'school'],
  [/^degree$|degree.*type|level.*of.*education/i, 'degree'],
  [/field.?of.?study|^major$|area.?of.?study|concentration|^discipline$/i, 'fieldOfStudy'],
  [/pronoun/i, 'pronouns'],
];

// Broad single-word patterns that should NOT match long question labels.
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
  'company',
]);
const MAX_LABEL_FOR_BROAD = 60;

export function classifyField(label: string): string | null {
  const clean = label.replace(/\s+/g, ' ').trim();
  if (clean.length > 500) return null; // Guard against pathologically long labels (ReDoS)
  for (const [pattern, category] of PATTERNS) {
    if (clean.length > MAX_LABEL_FOR_BROAD && BROAD_CATEGORIES.has(category)) continue;
    if (pattern.test(clean)) return category;
  }
  return null;
}
