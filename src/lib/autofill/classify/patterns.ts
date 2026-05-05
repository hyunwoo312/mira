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
  // Background-check Yes/No questions look superficially like willingness
  // questions and ML has been observed routing them to `relocate` (~73%).
  // For a user with willingToRelocate=false, that silently fills "No" to a
  // background-check question — a wrong answer that reads as a refusal.
  // Skip and let the user answer manually.
  [/\bbackground\s+check\b/i, '__skip__'],

  // Relocation-assistance vs relocate disambiguation. ML routes
  // "Will you need relocation assistance..." to `relocate` 0.95-0.97
  // even after retrain — class imbalance + shared "relocation" lexeme.
  // For a user willingToRelocate=true but needsRelocationAssistance=false,
  // this silently fills "Yes" to "do you need assistance" — a wrong answer
  // that reads as a request for help they don't need.
  [
    /\brelocation\s+(?:assistance|package|stipend|support|allowance|reimbursement)/i,
    'relocationAssistance',
  ],

  // Applicant self-assertion: "Do you meet the basic qualifications?" → always Yes.
  [
    /(?:meet|have).*(?:the\s+)?(?:basic|minimum|required)\s+qualifications|qualifications.*(?:specified|described|listed)/i,
    'hasExperience',
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
  // Country must come before the `location` pattern so labels like
  // "Country/Region/Location" anchor on the leading "Country" token instead
  // of the embedded "Location".
  [/^country|select.*country.*reside|country.*currently.*reside|country.*you.*live/i, 'country'],
  [
    /^location$|(?<!\brelocat\w*\b.{0,40})\blocation\b(?!.*\brelocat)|where.*(?:are|is).*you.*located|current.*location/i,
    'location',
  ],
  [/address.?line.?1|^address$|street/i, 'address1'],
  [/address.?line.?2|\bapt\b|\bsuite\b|\bunit\b|\bbuilding\b|\bfloor\b/i, 'address2'],
  [/\bcity\b/i, 'city'],
  [/\bstate\b|province/i, 'state'],
  // Anchored — bare "zip" substring used to match company-name "Zip" in prose.
  [/^zip\b|^postal\b|zip\s*code|postal\s*code|postcode/i, 'zipCode'],

  // ── Links ──
  [/linkedin/i, 'linkedin'],
  [/github/i, 'github'],
  [/twitter|x\s*profile/i, 'twitter'],
  [/^portfolio|portfolio.*url/i, 'portfolio'],
  [/^other\s*(website|url|link)/i, 'otherUrl'],
  [/website/i, 'portfolio'],

  // ── Heuristic fast-path (ML also covers most of these) ──
  // Eligibility "Do you have a <degree> in <field>?" — pipeline resolves
  // Yes/No dynamically against profile.education.
  [
    /\b(?:do|have)\s+you\s+(?:have|hold|earned|completed|obtained|received|possess)\s+(?:an?\s+|the\s+)?(?:bachelor'?s?|master'?s?|associate'?s?|doctorate|doctoral|ph\.?d|m\.?b\.?a|degree|undergraduate|graduate)[\s\S]{0,40}\bin\s+/i,
    'hasDegreeIn',
  ],
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

  // ── Categories not in ML label_map — heuristic-only ──
  // (isHispanic, referral, currentlyEnrolled, fullTimeInterest. exportControl
  //  and locatedInUS *are* in ML; their heuristics here are fast-path.)
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
  // Anchored at start — avoids matching "May we contact your current employer?"
  // (Yes/No question). Tolerates one-edit typos seen on real forms.
  [
    /^(?:(?:current|curent|currrent|previous|prior|past|most\s+recent)\s+)?(?:company|employers?|employeers?)\b/i,
    'company',
  ],
  [/current.?title|job.?title|most\s+recent\s+title/i, 'jobTitle'],
  [/^school$|university|college/i, 'school'],
  [/^degree$|degree.*type|level.*of.*education/i, 'degree'],
  [/field.?of.?study|^major$|area.?of.?study|concentration|^discipline$/i, 'fieldOfStudy'],
  [/\bpronouns?\b/i, 'pronouns'],
];

// Categories whose patterns include broad substrings (\bunit\b, "zip",
// "street", "university", "concentration", etc.). Skipped on labels longer
// than MAX_LABEL_FOR_BROAD to avoid mid-prose matches.
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
  'address1',
  'address2',
  'zipCode',
  'school',
  'degree',
  'fieldOfStudy',
  'noticePeriod',
]);
const MAX_LABEL_FOR_BROAD = 60;

// Willingness/ability framings around a location commitment ("Are you willing
// to work from the required location?") read as canWorkFromLocation, not
// location. ML handles them correctly; suppress the location heuristic.
const WILLINGNESS_LOCATION_RE =
  /\b(?:willing|able|open(?:\s+to)?|prepared|ready)\b[\s\S]{0,60}\b(?:work\s+from|located|location|relocat|commut|in[-\s]?person|on[-\s]?site|in\s+the\s+office|office)\b/i;

// Caller gates to textareas only — newline-joined value mashes into one
// broken URL on single-line inputs.
const PROFILE_LINK_TOKENS_RE =
  /\b(?:linkedin|github|stack\s*overflow|gitlab|portfolio|dribbble|behance|twitter|x\s+profile)\b/gi;

export function detectMultiLinkPrompt(label: string): boolean {
  const clean = label.replace(/\s+/g, ' ').trim();
  if (clean.length > 500) return false;
  const matches = clean.match(PROFILE_LINK_TOKENS_RE);
  if (!matches || matches.length < 2) return false;
  // Distinct platforms — repeated "github github" doesn't count.
  const normalized = new Set(matches.map((m) => m.toLowerCase().replace(/\s+/g, '')));
  return normalized.size >= 2;
}

export function classifyField(label: string): string | null {
  const clean = label.replace(/\s+/g, ' ').trim();
  if (clean.length > 500) return null; // Guard against pathologically long labels (ReDoS)
  for (const [pattern, category] of PATTERNS) {
    if (clean.length > MAX_LABEL_FOR_BROAD && BROAD_CATEGORIES.has(category)) continue;
    if (pattern.test(clean)) {
      if (category === 'location' && WILLINGNESS_LOCATION_RE.test(clean)) return null;
      return category;
    }
  }
  return null;
}
