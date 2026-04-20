import { profileToFillMap } from '../profile-map';
import { DEFAULT_PROFILE } from '@/lib/schema';
import type { Profile } from '@/lib/schema';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...DEFAULT_PROFILE, ...overrides };
}

describe('profileToFillMap', () => {
  // ─── Basic field mapping ───────────────────────────────────────────

  describe('basic fields', () => {
    it('should map firstName, lastName, email, phone directly', () => {
      const map = profileToFillMap(
        makeProfile({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '555-1234',
        }),
      );

      expect(map.firstName).toBe('Jane');
      expect(map.lastName).toBe('Doe');
      expect(map.email).toBe('jane@example.com');
      expect(map.phone).toBe('555-1234');
    });

    it('should map address fields directly', () => {
      const map = profileToFillMap(
        makeProfile({
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          country: 'United States',
        }),
      );

      expect(map.address1).toBe('123 Main St');
      expect(map.address2).toBe('Apt 4');
      expect(map.city).toBe('Seattle');
      expect(map.state).toBe('WA');
      expect(map.zipCode).toBe('98101');
      expect(map.country).toBe('United States');
    });

    it('should map link fields directly', () => {
      const map = profileToFillMap(
        makeProfile({
          linkedin: 'https://linkedin.com/in/jane',
          github: 'https://github.com/jane',
          portfolio: 'https://jane.dev',
        }),
      );

      expect(map.linkedin).toBe('https://linkedin.com/in/jane');
      expect(map.github).toBe('https://github.com/jane');
      expect(map.portfolio).toBe('https://jane.dev');
    });
  });

  // ─── Derived values ────────────────────────────────────────────────

  describe('fullName', () => {
    it('should derive fullName from firstName + lastName', () => {
      const map = profileToFillMap(makeProfile({ firstName: 'Jane', lastName: 'Doe' }));
      expect(map.fullName).toBe('Jane Doe');
    });

    it('should use only firstName when lastName is empty', () => {
      const map = profileToFillMap(makeProfile({ firstName: 'Jane', lastName: '' }));
      expect(map.fullName).toBe('Jane');
    });

    it('should use only lastName when firstName is empty', () => {
      const map = profileToFillMap(makeProfile({ firstName: '', lastName: 'Doe' }));
      expect(map.fullName).toBe('Doe');
    });
  });

  describe('preferredName', () => {
    it('should use preferredName when provided', () => {
      const map = profileToFillMap(makeProfile({ preferredName: 'Jay', firstName: 'Jane' }));
      expect(map.preferredName).toBe('Jay');
    });

    it('should skip preferredName when empty (no fallback to firstName)', () => {
      const map = profileToFillMap(makeProfile({ preferredName: '', firstName: 'Jane' }));
      expect(map.preferredName).toBeUndefined();
    });
  });

  describe('location', () => {
    it('should derive location as city, state', () => {
      const map = profileToFillMap(makeProfile({ city: 'Seattle', state: 'WA' }));
      expect(map.location).toBe('Seattle, WA');
    });

    it('should use only city when state is empty', () => {
      const map = profileToFillMap(makeProfile({ city: 'Seattle', state: '' }));
      expect(map.location).toBe('Seattle');
    });

    it('should use only state when city is empty', () => {
      const map = profileToFillMap(makeProfile({ city: '', state: 'WA' }));
      expect(map.location).toBe('WA');
    });

    it('should omit location when both city and state are empty', () => {
      const map = profileToFillMap(makeProfile({ city: '', state: '' }));
      expect(map.location).toBeUndefined();
    });
  });

  describe('locatedInUS', () => {
    it.each([
      ['United States', 'Yes'],
      ['US', 'Yes'],
      ['USA', 'Yes'],
      ['us', 'Yes'],
      ['united states', 'Yes'],
      ['Canada', 'No'],
      ['Germany', 'No'],
      ['', 'No'],
    ])('should return %s for country "%s"', (country, expected) => {
      const map = profileToFillMap(makeProfile({ country }));
      expect(map.locatedInUS).toBe(expected);
    });
  });

  describe('otherUrl', () => {
    it('should use additionalUrl when provided', () => {
      const map = profileToFillMap(
        makeProfile({
          additionalUrl: 'https://other.dev',
          portfolio: 'https://portfolio.dev',
        }),
      );
      expect(map.otherUrl).toBe('https://other.dev');
    });

    it('should not fill otherUrl when only portfolio exists (no duplicate)', () => {
      const map = profileToFillMap(
        makeProfile({ additionalUrl: '', portfolio: 'https://portfolio.dev' }),
      );
      expect(map.otherUrl).toBeUndefined();
    });

    it('should omit otherUrl when both are empty', () => {
      const map = profileToFillMap(makeProfile({ additionalUrl: '', portfolio: '' }));
      expect(map.otherUrl).toBeUndefined();
    });
  });

  // ─── Boolean → Yes/No ─────────────────────────────────────────────

  describe('boolean to Yes/No conversion', () => {
    it('should convert workAuthorization true to Yes', () => {
      const map = profileToFillMap(makeProfile({ workAuthorization: true }));
      expect(map.workAuth).toBe('Yes');
    });

    it('should convert workAuthorization false to No', () => {
      const map = profileToFillMap(makeProfile({ workAuthorization: false }));
      expect(map.workAuth).toBe('No');
    });

    it('should convert sponsorshipNeeded true to Yes', () => {
      const map = profileToFillMap(makeProfile({ sponsorshipNeeded: true }));
      expect(map.sponsorship).toBe('Yes');
    });

    it('should convert sponsorshipNeeded false to No', () => {
      const map = profileToFillMap(makeProfile({ sponsorshipNeeded: false }));
      expect(map.sponsorship).toBe('No');
    });

    it('should convert willingToRelocate true to Yes', () => {
      const map = profileToFillMap(makeProfile({ willingToRelocate: true }));
      expect(map.relocate).toBe('Yes');
    });

    it('should convert willingToRelocate false to No', () => {
      const map = profileToFillMap(makeProfile({ willingToRelocate: false }));
      expect(map.relocate).toBe('No');
    });

    it('should derive canWorkFromLocation from willingToRelocate', () => {
      const yesMap = profileToFillMap(makeProfile({ willingToRelocate: true }));
      expect(yesMap.canWorkFromLocation).toBe('Yes');

      const noMap = profileToFillMap(makeProfile({ willingToRelocate: false }));
      expect(noMap.canWorkFromLocation).toBe('No');
    });

    it('should convert needsRelocationAssistance true to Yes', () => {
      const map = profileToFillMap(makeProfile({ needsRelocationAssistance: true }));
      expect(map.relocationAssistance).toBe('Yes');
    });

    it('should convert needsRelocationAssistance false to No (filtered out as empty)', () => {
      // 'No' is a truthy string so it stays in the map; default is false → 'No'
      const map = profileToFillMap(makeProfile({ needsRelocationAssistance: false }));
      expect(map.relocationAssistance).toBe('No');
    });

    it('should keep relocate and relocationAssistance independent', () => {
      // willing to relocate, but does not need company assistance
      const map = profileToFillMap(
        makeProfile({ willingToRelocate: true, needsRelocationAssistance: false }),
      );
      expect(map.relocate).toBe('Yes');
      expect(map.relocationAssistance).toBe('No');
    });
  });

  // ─── Age-derived fields ────────────────────────────────────────────

  describe('isOver18', () => {
    it('should return Yes when age is 18 or older', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.isOver18).toBe('Yes');
    });

    it('should return Yes when age is exactly 18', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 18);
      // Go back one extra day to ensure birthday has passed
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.isOver18).toBe('Yes');
    });

    it('should return No when age is under 18', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 17);
      dob.setDate(dob.getDate() + 30);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.isOver18).toBe('No');
    });

    it('should return No when dateOfBirth is empty', () => {
      const map = profileToFillMap(makeProfile({ dateOfBirth: '' }));
      expect(map.isOver18).toBe('No');
    });

    it('should return No when dateOfBirth is invalid', () => {
      const map = profileToFillMap(makeProfile({ dateOfBirth: 'not-a-date' }));
      expect(map.isOver18).toBe('No');
    });
  });

  describe('ageRange', () => {
    it('should return Under 30 for age 25', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('Under 30');
    });

    it('should return 30-39 for age 35', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 35);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('30-39');
    });

    it('should return 40-49 for age 45', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 45);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('40-49');
    });

    it('should return 50-59 for age 55', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 55);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('50-59');
    });

    it('should return 60 or older for age 65', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 65);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('60 or older');
    });

    it('should return 30-39 at the boundary (age exactly 30)', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 30);
      dob.setDate(dob.getDate() - 1);
      const map = profileToFillMap(makeProfile({ dateOfBirth: dob.toISOString().slice(0, 10) }));
      expect(map.ageRange).toBe('30-39');
    });

    it('should omit ageRange when dateOfBirth is empty', () => {
      const map = profileToFillMap(makeProfile({ dateOfBirth: '' }));
      expect(map.ageRange).toBeUndefined();
    });
  });

  // ─── Hispanic derivation ──────────────────────────────────────────

  describe('isHispanic', () => {
    it('should return Yes when race contains Hispanic', () => {
      const map = profileToFillMap(makeProfile({ race: 3 }));
      expect(map.isHispanic).toBe('Yes');
    });

    it('should return Yes when race contains Latino (case insensitive)', () => {
      const map = profileToFillMap(makeProfile({ race: 3 }));
      expect(map.isHispanic).toBe('Yes');
    });

    it('should return No for non-Hispanic race', () => {
      const map = profileToFillMap(makeProfile({ race: 5 }));
      expect(map.isHispanic).toBe('No');
    });

    it('should return No for empty race', () => {
      const map = profileToFillMap(makeProfile({ race: -1 }));
      expect(map.isHispanic).toBe('No');
    });
  });

  // ─── LGBTQ+ derivation ────────────────────────────────────────────

  describe('lgbtq', () => {
    it('should return Yes for non-straight sexual orientation', () => {
      const map = profileToFillMap(makeProfile({ sexualOrientation: 3 }));
      expect(map.lgbtq).toBe('Yes');
    });

    it('should return No for straight sexual orientation', () => {
      const map = profileToFillMap(makeProfile({ sexualOrientation: 0 }));
      expect(map.lgbtq).toBe('No');
    });

    it('should return No for heterosexual sexual orientation', () => {
      const map = profileToFillMap(makeProfile({ sexualOrientation: 0 }));
      expect(map.lgbtq).toBe('No');
    });

    it('should return No for prefer not to say', () => {
      const map = profileToFillMap(makeProfile({ sexualOrientation: 7 }));
      expect(map.lgbtq).toBe('No');
    });

    it('should return Yes when transgender is Yes', () => {
      const map = profileToFillMap(makeProfile({ transgender: 0 }));
      expect(map.lgbtq).toBe('Yes');
    });

    it('should return Yes for non-binary gender', () => {
      const map = profileToFillMap(makeProfile({ gender: 2 }));
      expect(map.lgbtq).toBe('Yes');
    });

    it('should return Yes for genderqueer gender', () => {
      const map = profileToFillMap(makeProfile({ gender: 2 }));
      expect(map.lgbtq).toBe('Yes');
    });

    it('should return No when all identity fields are empty', () => {
      const map = profileToFillMap(
        makeProfile({ sexualOrientation: -1, transgender: -1, gender: -1 }),
      );
      expect(map.lgbtq).toBe('No');
    });
  });

  // ─── Veteran / disability derivation ───────────────────────────────

  describe('communities', () => {
    it('should include Veteran when veteranStatus matches', () => {
      const map = profileToFillMap(makeProfile({ veteranStatus: 1 }));
      expect(map.communities).toContain('Veteran');
    });

    it('should not include Veteran when veteranStatus contains "not"', () => {
      const map = profileToFillMap(makeProfile({ veteranStatus: 0 }));
      expect(map.communities).not.toContain('Veteran');
    });

    it('should include Person with disability when disabilityStatus is Yes', () => {
      const map = profileToFillMap(makeProfile({ disabilityStatus: 0 }));
      expect(map.communities).toContain('Person with disability');
    });

    it('should not include Person with disability when disabilityStatus is No', () => {
      const map = profileToFillMap(makeProfile({ disabilityStatus: 1 }));
      expect(map.communities).not.toContain('Person with disability');
    });

    it('should not include Person with disability when disabilityStatus contains Yes and No', () => {
      // "No, I do not..." should not match since /no/i triggers
      const map = profileToFillMap(makeProfile({ disabilityStatus: 1 }));
      expect(map.communities).not.toContain('Person with disability');
    });

    it('should include LGBTQ+ when lgbtq conditions are met', () => {
      const map = profileToFillMap(makeProfile({ sexualOrientation: 1 }));
      expect(map.communities).toContain('LGBTQ+');
    });

    it('should return "None of the above" when no communities match', () => {
      const map = profileToFillMap(
        makeProfile({
          veteranStatus: 0,
          disabilityStatus: 1,
          sexualOrientation: 0,
          transgender: 1,
          gender: 0,
        }),
      );
      expect(map.communities).toBe('None of the above');
    });

    it('should join multiple communities with commas', () => {
      const map = profileToFillMap(
        makeProfile({
          veteranStatus: 1,
          disabilityStatus: 0,
          sexualOrientation: 1,
        }),
      );
      expect(map.communities).toBe('Veteran,Person with disability,LGBTQ+');
    });
  });

  // ─── Work / Education arrays ───────────────────────────────────────

  describe('work experience and education', () => {
    it('should extract company from first work entry', () => {
      const map = profileToFillMap(
        makeProfile({
          workExperience: [
            {
              company: 'Acme Corp',
              title: 'Engineer',
              location: '',
              current: false,
              description: '',
              startMonth: undefined,
              startYear: undefined,
              endMonth: undefined,
              endYear: undefined,
            },
            {
              company: 'Other Inc',
              title: 'Lead',
              location: '',
              current: false,
              description: '',
              startMonth: undefined,
              startYear: undefined,
              endMonth: undefined,
              endYear: undefined,
            },
          ],
        }),
      );
      expect(map.company).toBe('Acme Corp');
      expect(map.jobTitle).toBe('Engineer');
    });

    it('should omit company and jobTitle when workExperience is empty', () => {
      const map = profileToFillMap(makeProfile({ workExperience: [] }));
      expect(map.company).toBeUndefined();
      expect(map.jobTitle).toBeUndefined();
    });

    it('should extract school and degree from first education entry', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: 'CS',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: 5,
              gradYear: 2020,
            },
          ],
        }),
      );
      expect(map.school).toBe('MIT');
      expect(map.degree).toBe('BS');
    });

    it('should omit school and degree when education is empty', () => {
      const map = profileToFillMap(makeProfile({ education: [] }));
      expect(map.school).toBeUndefined();
      expect(map.degree).toBeUndefined();
    });
  });

  // ─── Graduation date ──────────────────────────────────────────────

  describe('graduationDate', () => {
    it('should format as "Month Year" when both gradMonth and gradYear exist', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: '',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: 5,
              gradYear: 2020,
            },
          ],
        }),
      );
      expect(map.graduationDate).toBe('May 2020');
    });

    it('should format as just year when only gradYear exists', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: '',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: undefined,
              gradYear: 2020,
            },
          ],
        }),
      );
      expect(map.graduationDate).toBe('2020');
    });

    it('should omit graduationDate when no grad info exists', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: '',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: undefined,
              gradYear: undefined,
            },
          ],
        }),
      );
      expect(map.graduationDate).toBeUndefined();
    });

    it('should omit graduationDate when education is empty', () => {
      const map = profileToFillMap(makeProfile({ education: [] }));
      expect(map.graduationDate).toBeUndefined();
    });

    it('should map January (month 1) correctly', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: '',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: 1,
              gradYear: 2024,
            },
          ],
        }),
      );
      expect(map.graduationDate).toBe('January 2024');
    });

    it('should map December (month 12) correctly', () => {
      const map = profileToFillMap(
        makeProfile({
          education: [
            {
              school: 'MIT',
              degree: 'BS',
              fieldOfStudy: '',
              minor: '',
              gpa: '',
              startMonth: undefined,
              startYear: undefined,
              gradMonth: 12,
              gradYear: 2024,
            },
          ],
        }),
      );
      expect(map.graduationDate).toBe('December 2024');
    });
  });

  // ─── skipEeo ───────────────────────────────────────────────────────

  describe('skipEeo', () => {
    const EEO_KEYS = [
      'gender',
      'transgender',
      'sexualOrientation',
      'race',
      'veteranStatus',
      'disabilityStatus',
      'lgbtq',
      'communities',
    ] as const;

    it('should include EEO keys when skipEeo is false', () => {
      const map = profileToFillMap(
        makeProfile({
          skipEeo: false,
          gender: 0,
          race: 5,
          veteranStatus: 0,
          disabilityStatus: 1,
        }),
      );

      expect(map.gender).toBe('Male');
      expect(map.race).toBe('White');
      expect(map.communities).toBeDefined();
    });

    it('should remove all EEO keys when skipEeo is true', () => {
      const map = profileToFillMap(
        makeProfile({
          skipEeo: true,
          gender: 0,
          transgender: 1,
          sexualOrientation: 0,
          race: 5,
          veteranStatus: 0,
          disabilityStatus: 1,
        }),
      );

      for (const key of EEO_KEYS) {
        expect(map[key]).toBeUndefined();
      }
    });

    it('should keep non-EEO keys when skipEeo is true', () => {
      const map = profileToFillMap(
        makeProfile({
          skipEeo: true,
          firstName: 'Jane',
          email: 'jane@example.com',
        }),
      );

      expect(map.firstName).toBe('Jane');
      expect(map.email).toBe('jane@example.com');
    });
  });

  // ─── Empty value removal ──────────────────────────────────────────

  describe('empty value removal', () => {
    it('should remove keys with empty string values', () => {
      const map = profileToFillMap(makeProfile());
      const emptyKeys = Object.entries(map).filter(([, v]) => v === '');
      expect(emptyKeys).toHaveLength(0);
    });

    it('should keep keys with non-empty values', () => {
      const map = profileToFillMap(makeProfile({ firstName: 'Jane' }));
      expect(map.firstName).toBe('Jane');
    });

    it('should remove twitter since it is always empty', () => {
      const map = profileToFillMap(makeProfile({ firstName: 'Jane' }));
      expect(map.twitter).toBeUndefined();
    });
  });

  // ─── Hardcoded defaults ────────────────────────────────────────────

  describe('hardcoded defaults', () => {
    it('should set referral to "No"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.referral).toBe('No');
    });

    it('should set workedHereBefore to "I have not"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.workedHereBefore).toBe('I have not');
    });

    it('should set startDate to "Immediately"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.startDate).toBe('Immediately');
    });

    it('should set hasExperience to "Yes"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.hasExperience).toBe('Yes');
    });

    it('should set canProvideDoc to "Yes"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.canProvideDoc).toBe('Yes');
    });

    it('should set smsConsent to "No"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.smsConsent).toBe('No');
    });

    it('should set accommodationRequest to "No"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.accommodationRequest).toBe('No');
    });

    it('should set spouseVeteran to "No"', () => {
      const map = profileToFillMap(makeProfile());
      expect(map.spouseVeteran).toBe('No');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle a completely default profile without throwing', () => {
      expect(() => profileToFillMap(DEFAULT_PROFILE)).not.toThrow();
    });

    it('should return a plain object with only string values', () => {
      const map = profileToFillMap(
        makeProfile({ firstName: 'Jane', lastName: 'Doe', email: 'j@d.com' }),
      );
      for (const [, v] of Object.entries(map)) {
        expect(typeof v).toBe('string');
      }
    });

    it('should handle dateOfBirth with invalid format gracefully', () => {
      const map = profileToFillMap(makeProfile({ dateOfBirth: '99/99/9999' }));
      expect(map.isOver18).toBe('No');
      expect(map.ageRange).toBeUndefined();
    });

    it('should handle veteranStatus "I identify as a protected veteran"', () => {
      const map = profileToFillMap(makeProfile({ veteranStatus: 1 }));
      expect(map.communities).toContain('Veteran');
    });

    it('should handle disabilityStatus "Yes, I have a disability"', () => {
      const map = profileToFillMap(makeProfile({ disabilityStatus: 0 }));
      expect(map.communities).toContain('Person with disability');
    });

    it('should not treat "Non-binary" gender with exact match only in regex', () => {
      const map = profileToFillMap(makeProfile({ gender: 2 }));
      expect(map.lgbtq).toBe('Yes');
    });

    it('should handle pronouns pass-through', () => {
      const map = profileToFillMap(makeProfile({ pronouns: 'they/them' }));
      expect(map.pronouns).toBe('they/them');
    });

    it('should omit pronouns when empty', () => {
      const map = profileToFillMap(makeProfile({ pronouns: '' }));
      expect(map.pronouns).toBeUndefined();
    });
  });
});
