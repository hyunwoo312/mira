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
