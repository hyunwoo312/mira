import type { Profile } from '../schema';
import {
  getFillValue,
  GENDER_OPTIONS,
  TRANSGENDER_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
  RACE_OPTIONS,
  VETERAN_STATUS_OPTIONS,
  DISABILITY_STATUS_OPTIONS,
  VISA_TYPE_OPTIONS,
  SECURITY_CLEARANCE_OPTIONS,
  NOTICE_PERIOD_OPTIONS,
} from '../field-options';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthName(m?: number): string {
  return m && m >= 1 && m <= 12 ? MONTHS[m - 1]! : '';
}

function getAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    age--;
  return age;
}

function ageRange(age: number): string {
  if (age < 30) return 'Under 30';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  return '60 or older';
}

function deriveStartDate(p: Profile): string {
  // Use noticePeriod if set
  const noticePeriodStr = getFillValue(NOTICE_PERIOD_OPTIONS, p.noticePeriod);
  if (noticePeriodStr) return noticePeriodStr;
  // Use earliest start date if set
  if (p.earliestStartMonth && p.earliestStartYear) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${months[p.earliestStartMonth - 1]} ${p.earliestStartYear}`;
  }
  if (p.earliestStartYear) return `${p.earliestStartYear}`;
  return 'Immediately';
}

/** Numeric tier for degree-level comparison (associate=1, …, doctorate=4). */
const DEGREE_TIER: Record<string, number> = {
  associate: 1,
  associates: 1,
  aa: 1,
  as: 1,
  bachelor: 2,
  bachelors: 2,
  ba: 2,
  bs: 2,
  bsc: 2,
  beng: 2,
  undergraduate: 2,
  master: 3,
  masters: 3,
  ma: 3,
  ms: 3,
  msc: 3,
  meng: 3,
  mba: 3,
  graduate: 3,
  doctorate: 4,
  doctoral: 4,
  doctor: 4,
  phd: 4,
};

function normalizeDegreeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’ʼ.\-_/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tierForDegreeText(s: string): number {
  const norm = normalizeDegreeToken(s);
  // Whole-string then per-token so multi-word degrees ("Bachelor of Science") match.
  if (DEGREE_TIER[norm] !== undefined) return DEGREE_TIER[norm]!;
  for (const tok of norm.split(/\s+/)) {
    if (DEGREE_TIER[tok] !== undefined) return DEGREE_TIER[tok]!;
  }
  return 0;
}

/** Parse "Do you have a <degree> in <field>?" into tier + field token. */
export function parseDegreeQuestion(label: string): { tier: number; field: string } | null {
  // Strip trailing label decorators (required-field markers, trailing ?).
  const cleaned = label.replace(/[\s?*✱✦✓:]+$/u, '').trim();
  const m = cleaned.match(
    /(?:do|have)\s+you\s+(?:have|hold|earned|completed|obtained|received|possess)\s+(?:an?\s+|the\s+)?(bachelor'?s?|master'?s?|associate'?s?|doctorate|doctoral|ph\.?d|m\.?b\.?a|degree|undergraduate|graduate)\s*(?:degree)?\s*(?:in|of)\s+(.+?)\s*$/i,
  );
  if (!m) return null;
  const tier = tierForDegreeText(m[1]!);
  if (!tier && !/\bdegree\b/i.test(m[1]!)) return null;
  // Bare "degree" → tier-2 (bachelor's-or-better).
  const effectiveTier = tier || 2;
  const fieldRaw = m[2]!
    .replace(/\b(?:or|and)\s+(?:a\s+)?(?:related|similar|equivalent)(?:\s+field)?\b.*$/i, '')
    .replace(/\b(?:related|similar|equivalent)\s+field\b.*$/i, '')
    .trim();
  return { tier: effectiveTier, field: fieldRaw.toLowerCase() };
}

/** Tokenize a field name for substring comparison (handles "Computer Science" / "CS"). */
function fieldTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
}

const FIELD_ALIASES: Record<string, string[]> = {
  cs: ['computer', 'science'],
  ee: ['electrical', 'engineering'],
  me: ['mechanical', 'engineering'],
  it: ['information', 'technology'],
  ds: ['data', 'science'],
};

function expandFieldAliases(tokens: Set<string>): Set<string> {
  const out = new Set<string>();
  // Replace aliases with their expansion (don't keep both) so "cs" and
  // "computer science" canonicalize to the same set.
  for (const tok of tokens) {
    const expansion = FIELD_ALIASES[tok];
    if (expansion) {
      for (const w of expansion) out.add(w);
    } else {
      out.add(tok);
    }
  }
  return out;
}

/** True if the user's stored field-of-study satisfies the question's field. */
function userFieldMatchesQuestion(userField: string, questionField: string): boolean {
  const userTokens = expandFieldAliases(fieldTokens(userField));
  const qTokens = expandFieldAliases(fieldTokens(questionField));
  if (qTokens.size === 0 || userTokens.size === 0) return false;
  // All non-noise question tokens must appear in user's tokens. Strict subset
  // so "computer engineering" doesn't match "computer science".
  const NOISE = new Set(['or', 'and', 'a', 'an', 'the', 'in', 'of', 'related', 'field']);
  for (const tok of qTokens) {
    if (NOISE.has(tok)) continue;
    if (!userTokens.has(tok)) return false;
  }
  return true;
}

/** Resolve "Do you have a <degree> in <field>?" against the user's education. */
export function resolveHasDegreeIn(label: string, p: Profile): string {
  const target = parseDegreeQuestion(label);
  if (!target) return '';
  for (const edu of p.education) {
    if (!edu.degree) continue;
    const userTier = tierForDegreeText(edu.degree);
    if (userTier < target.tier) continue;
    if (userFieldMatchesQuestion(edu.fieldOfStudy ?? '', target.field)) {
      return 'Yes';
    }
  }
  return p.education.length > 0 ? 'No' : '';
}

export function profileToFillMap(p: Profile): Record<string, string> {
  const age = getAge(p.dateOfBirth);

  // Resolve index-based fields to fill strings
  const genderStr = getFillValue(GENDER_OPTIONS, p.gender);
  const transgenderStr = getFillValue(TRANSGENDER_OPTIONS, p.transgender);
  const orientationStr = getFillValue(SEXUAL_ORIENTATION_OPTIONS, p.sexualOrientation);
  const raceStr = getFillValue(RACE_OPTIONS, p.race);
  const veteranStr = getFillValue(VETERAN_STATUS_OPTIONS, p.veteranStatus);
  const disabilityStr = getFillValue(DISABILITY_STATUS_OPTIONS, p.disabilityStatus);
  const visaStr = getFillValue(VISA_TYPE_OPTIONS, p.visaType);
  const clearanceStr = getFillValue(SECURITY_CLEARANCE_OPTIONS, p.securityClearance);

  const isHispanic = /hispanic|latino/i.test(raceStr);
  const isVeteran = p.veteranStatus === 1; // "I identify as a protected veteran"
  const hasDisability = p.disabilityStatus === 0; // "Yes, I have a disability"

  const isLgbtq =
    (orientationStr && !/straight|heterosexual|prefer not/i.test(orientationStr)) ||
    p.transgender === 0 || // "Yes"
    /non.?binary|genderqueer/i.test(genderStr);

  const map: Record<string, string> = {
    // Personal
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    preferredName: p.preferredName,
    email: p.email,
    phone: p.phone,
    address1: p.address1,
    address2: p.address2,
    city: p.city,
    state: p.state,
    zipCode: p.zipCode,
    country: p.country,

    // Links
    linkedin: p.linkedin,
    github: p.github,
    portfolio: p.portfolio,
    twitter: p.twitter,

    // Newline-joined for multi-link textarea prompts; pruning step drops
    // this entry when none are populated.
    profileLinks: [p.linkedin, p.github, p.portfolio, p.twitter].filter(Boolean).join('\n'),

    // Work
    company: p.workExperience[0]?.company ?? '',
    jobTitle: p.workExperience[0]?.title ?? '',
    school: p.education[0]?.school ?? '',
    degree: p.education[0]?.degree ?? '',
    fieldOfStudy: p.education[0]?.fieldOfStudy ?? '',

    // Location
    location: [p.city, p.state].filter(Boolean).join(', '),
    locatedInUS: /united states|us|usa/i.test(p.country) ? 'Yes' : 'No',

    // Other URL — only fill if user has an actual additional URL (not a duplicate of portfolio)
    otherUrl: p.additionalUrl || '',

    // Salary
    salaryRange:
      p.salaryMin && p.salaryMax
        ? `$${Number(p.salaryMin).toLocaleString('en-US')} - $${Number(p.salaryMax).toLocaleString('en-US')}`
        : p.salaryMin
          ? `$${Number(p.salaryMin).toLocaleString('en-US')}`
          : '',
    salaryMin: p.salaryMin ? `$${Number(p.salaryMin).toLocaleString('en-US')}` : '',
    salaryMax: p.salaryMax ? `$${Number(p.salaryMax).toLocaleString('en-US')}` : '',

    // Yes/No answers
    workAuth: p.workAuthorization ? 'Yes' : 'No',
    sponsorship: p.sponsorshipNeeded ? 'Yes' : 'No',
    relocate: p.willingToRelocate ? 'Yes' : 'No',
    relocationAssistance: p.needsRelocationAssistance ? 'Yes' : 'No',
    willingToTravel: p.willingToTravel ? 'Yes' : 'No',
    isHispanic: isHispanic ? 'Yes' : 'No',
    referral: 'No',
    workedHereBefore: 'I have not',
    phoneDeviceType: 'Mobile',
    // Workday expects digits-only phone (no formatting, no country code)
    phoneDigits: p.phone.replace(/^\+?1?\s*/, '').replace(/\D/g, ''),
    // Workday phone-code options are "<Country> (+N)". Pass the canonical
    // country name so token overlap favors the right row.
    phoneCountryCode: /^united states|^us$|^usa$/i.test(p.country.trim())
      ? 'United States of America'
      : p.country,
    hasExperience: 'Yes',
    canProvideDoc: 'Yes',
    consent: 'Yes',
    smsConsent: p.smsConsent ? 'Yes' : 'No',
    spouseVeteran: 'No',
    noticePeriod: getFillValue(NOTICE_PERIOD_OPTIONS, p.noticePeriod),
    startDate: deriveStartDate(p),
    isOver18: age !== null && age >= 18 ? 'Yes' : 'No',
    ageRange: age !== null ? ageRange(age) : '',
    canWorkFromLocation: p.willingToRelocate ? 'Yes' : 'No',
    accommodationRequest: 'No',
    addressType: 'Home',
    graduationStatus: (() => {
      const edu = p.education[0];
      if (!edu?.gradYear) return '';
      const now = new Date();
      const gradDate = new Date(edu.gradYear, (edu.gradMonth ?? 12) - 1);
      return gradDate > now ? 'In Progress' : 'Received';
    })(),
    visaType: visaStr,
    securityClearance: clearanceStr,
    // ITAR/EAR export control: U.S. person = citizen, permanent resident, asylee, refugee
    // Derive from sponsorship: no sponsorship needed → likely U.S. person
    exportControl: !p.sponsorshipNeeded ? 'U.S. person' : 'Foreign person',
    // Derive enrollment status from education: enrolled if grad date is in the future or not set
    currentlyEnrolled: (() => {
      const edu = p.education[0];
      if (!edu?.school) return '';
      const y = edu.gradYear;
      const m = edu.gradMonth ?? 12;
      if (!y) return 'Yes';
      const now = new Date();
      const gradDate = new Date(y, m - 1);
      return gradDate >= now ? 'Yes' : 'No';
    })(),

    fullTimeInterest: 'Yes',

    // Work arrangement preference
    workArrangement: p.workArrangement.join(', '),

    // Workday-specific: work experience details (first entry)
    workLocation: p.workExperience[0]?.location ?? '',
    gpa: p.education[0]?.gpa ?? '',
    workDescription: p.workExperience[0]?.description ?? '',
    workStartDate: (() => {
      const w = p.workExperience[0];
      if (!w?.startMonth || !w?.startYear) return '';
      return `${w.startMonth}/${w.startYear}`;
    })(),
    workEndDate: (() => {
      const w = p.workExperience[0];
      if (w?.current) return '';
      if (!w?.endMonth || !w?.endYear) return '';
      return `${w.endMonth}/${w.endYear}`;
    })(),
    workStartMonth: monthName(p.workExperience[0]?.startMonth),
    workStartYear: p.workExperience[0]?.startYear ? String(p.workExperience[0].startYear) : '',
    workEndMonth: (() => {
      const w = p.workExperience[0];
      if (w?.current) return '';
      return monthName(w?.endMonth);
    })(),
    workEndYear: (() => {
      const w = p.workExperience[0];
      if (w?.current) return '';
      return w?.endYear ? String(w.endYear) : '';
    })(),
    currentRole: p.workExperience[0]?.current ? 'Yes' : '',
    eduStartMonth: monthName(p.education[0]?.startMonth),
    eduStartYear: p.education[0]?.startYear ? String(p.education[0].startYear) : '',
    eduGradMonth: monthName(p.education[0]?.gradMonth),
    eduGradYear: p.education[0]?.gradYear ? String(p.education[0].gradYear) : '',
    todayDate: new Date().toISOString().split('T')[0]!,

    // Workday websites: first URL entry
    websiteUrl: p.linkedin || p.github || p.portfolio || '',

    graduationDate: (() => {
      const edu = p.education[0];
      if (!edu) return '';
      const m = edu.gradMonth;
      const y = edu.gradYear;
      if (m && y) {
        const months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        return `${months[m - 1]} ${y}`;
      }
      if (y) return `${y}`;
      return '';
    })(),

    // EEO
    gender: genderStr,
    transgender: transgenderStr,
    sexualOrientation: orientationStr,
    race: raceStr,
    veteranStatus: veteranStr,
    disabilityStatus: disabilityStr,
    lgbtq: isLgbtq ? 'Yes' : 'No',
    // Derive pronouns from gender if not explicitly set
    pronouns:
      p.pronouns ||
      (() => {
        const g = genderStr.toLowerCase();
        if (!g) return '';
        if (/^male$|^man$|^cis.?male|^cis.?man/i.test(g)) return 'He/him';
        if (/^female$|^woman$|^cis.?female|^cis.?woman/i.test(g)) return 'She/her';
        if (/non.?binary|genderqueer/i.test(g)) return 'They/them';
        return '';
      })(),

    // Communities (for multi-select checkboxes)
    communities:
      [
        isVeteran ? 'Veteran' : '',
        hasDisability ? 'Person with disability' : '',
        isLgbtq ? 'LGBTQ+' : '',
      ]
        .filter(Boolean)
        .join(',') || 'None of the above',
  };

  // Remove empty values
  for (const [k, v] of Object.entries(map)) {
    if (!v) delete map[k];
  }

  // Skip EEO if configured
  if (p.skipEeo) {
    for (const key of [
      'gender',
      'transgender',
      'sexualOrientation',
      'race',
      'veteranStatus',
      'disabilityStatus',
      'lgbtq',
      'communities',
    ]) {
      delete map[key];
    }
  }

  return map;
}
