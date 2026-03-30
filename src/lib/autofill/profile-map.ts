/**
 * Converts a Profile object into a flat fillMap (category → value).
 * The autofill module only sees this map, never the Profile type.
 */

import type { Profile } from '../schema';

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
  if (p.noticePeriod) return p.noticePeriod;
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
  const isHispanic = /hispanic|latino/i.test(p.race);
  const isVeteran =
    /i identify|i am a|protected veteran/i.test(p.veteranStatus) && !/not/i.test(p.veteranStatus);
  const hasDisability = /yes/i.test(p.disabilityStatus) && !/no/i.test(p.disabilityStatus);

  const isLgbtq =
    (p.sexualOrientation && !/straight|heterosexual|prefer not/i.test(p.sexualOrientation)) ||
    p.transgender === 'Yes' ||
    /non.?binary|genderqueer/i.test(p.gender);

  const map: Record<string, string> = {
    // Personal
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    preferredName: p.preferredName || p.firstName,
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

    // Other URL
    otherUrl: p.additionalUrl || p.portfolio,

    // Yes/No answers
    workAuth: p.workAuthorization ? 'Yes' : 'No',
    sponsorship: p.sponsorshipNeeded ? 'Yes' : 'No',
    relocate: p.willingToRelocate ? 'Yes' : 'No',
    willingToTravel: p.willingToTravel ? 'Yes' : 'No',
    isHispanic: isHispanic ? 'Yes' : 'No',
    workedHereBefore: 'I have not',
    hasExperience: 'Yes',
    canProvideDoc: 'Yes',
    consent: 'Yes',
    smsConsent: p.smsConsent ? 'Yes' : 'No',
    spouseVeteran: 'No',
    startDate: deriveStartDate(p),
    isOver18: age !== null && age >= 18 ? 'Yes' : 'No',
    ageRange: age !== null ? ageRange(age) : '',
    canWorkFromLocation: p.willingToRelocate ? 'Yes' : 'No',
    accommodationRequest: 'No',
    visaType: p.visaType,
    securityClearance: p.securityClearance,
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
    gender: p.gender,
    transgender: p.transgender,
    sexualOrientation: p.sexualOrientation,
    race: p.race,
    veteranStatus: p.veteranStatus,
    disabilityStatus: p.disabilityStatus,
    lgbtq: isLgbtq ? 'Yes' : 'No',
    pronouns: p.pronouns,

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
