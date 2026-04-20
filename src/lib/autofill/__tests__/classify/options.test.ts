import { describe, it, expect } from 'vitest';
import { classifyByOptions } from '../../classify/options';

describe('classifyByOptions', () => {
  describe('gender', () => {
    it('detects a standard gender option set', () => {
      expect(classifyByOptions(['Male', 'Female', 'Non-binary', 'Prefer not to say'])).toBe(
        'gender',
      );
    });

    it('detects binary gender with decline option', () => {
      expect(classifyByOptions(['Man', 'Woman', 'Decline to self-identify'])).toBe('gender');
    });
  });

  describe('race / ethnicity', () => {
    it('detects a US EEO race set', () => {
      expect(
        classifyByOptions([
          'American Indian or Alaska Native',
          'Asian',
          'Black or African American',
          'Hispanic or Latino',
          'White',
          'Two or More Races',
        ]),
      ).toBe('race');
    });

    it('detects a short-form race set', () => {
      expect(classifyByOptions(['Asian', 'Black', 'Hispanic', 'White', 'Other'])).toBe('race');
    });
  });

  describe('veteranStatus', () => {
    it('detects the protected-veteran question', () => {
      expect(
        classifyByOptions([
          'I am a protected veteran',
          'I am not a protected veteran',
          'I prefer not to answer',
        ]),
      ).toBe('veteranStatus');
    });

    it('does NOT classify bare Yes/No as veteranStatus even if "veteran" nearby', () => {
      // Short Yes/No option set — length guard should block it without a
      // descriptive option string.
      expect(classifyByOptions(['Yes', 'No'])).not.toBe('veteranStatus');
    });
  });

  describe('disabilityStatus', () => {
    it('detects the self-ID disability question', () => {
      expect(
        classifyByOptions([
          'Yes, I have a disability',
          'No, I do not have a disability',
          'I do not wish to answer',
        ]),
      ).toBe('disabilityStatus');
    });
  });

  describe('degree', () => {
    it('detects a classic degree ladder', () => {
      expect(
        classifyByOptions(["Bachelor's", "Master's", 'PhD', "Associate's", 'High School']),
      ).toBe('degree');
    });

    it('detects alias-heavy iCIMS degree lists', () => {
      expect(classifyByOptions(['Associates', 'BA', 'BS', 'MA', 'MS', 'PhD / Doctorate'])).toBe(
        'degree',
      );
    });
  });

  describe('sexualOrientation', () => {
    it('detects an orientation option set', () => {
      expect(
        classifyByOptions([
          'Heterosexual / Straight',
          'Gay or Lesbian',
          'Bisexual',
          'Prefer not to say',
        ]),
      ).toBe('sexualOrientation');
    });
  });

  describe('country', () => {
    it('detects a full country list', () => {
      // aliases.json only seeds a handful of canonical countries — use those
      // so countMatches can find ≥5 matches. Production country selects have
      // hundreds of real entries that match via other aliases.
      const countries = [
        'United States',
        'United Kingdom',
        'South Korea',
        'North Korea',
        'Russia',
        'Taiwan',
        'Czech Republic',
        'Ivory Coast',
        ...Array.from({ length: 50 }, (_, i) => `Country${i}`),
      ];
      expect(classifyByOptions(countries)).toBe('country');
    });

    it('does NOT classify short lists as country', () => {
      expect(classifyByOptions(['United States', 'Canada', 'Mexico'])).not.toBe('country');
    });
  });

  describe('state', () => {
    it('detects a US-states list', () => {
      const states = [
        'Alabama',
        'Alaska',
        'Arizona',
        'Arkansas',
        'California',
        'Colorado',
        'Connecticut',
        'Delaware',
        'Florida',
        'Georgia',
        'Hawaii',
        'Idaho',
        'Illinois',
        'Indiana',
        'Iowa',
      ];
      expect(classifyByOptions(states)).toBe('state');
    });
  });

  describe('inconclusive / null cases', () => {
    it('returns null for too-small option lists', () => {
      expect(classifyByOptions(['Yes'])).toBeNull();
      expect(classifyByOptions([])).toBeNull();
    });

    it('returns null for generic Yes/No (needs label context to disambiguate)', () => {
      expect(classifyByOptions(['Yes', 'No'])).toBeNull();
      expect(classifyByOptions(['Yes', 'No', 'Decline to answer'])).toBeNull();
    });

    it('returns null for random non-category options', () => {
      expect(classifyByOptions(['Red', 'Green', 'Blue', 'Yellow'])).toBeNull();
    });

    it('returns null for ambiguous single-category words', () => {
      // Just "Male" alone isn't enough to fire a gender signature
      expect(classifyByOptions(['Male'])).toBeNull();
    });
  });
});
