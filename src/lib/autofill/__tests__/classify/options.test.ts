import { describe, it, expect } from 'vitest';
import { classifyByOptions, looksLikeCountryList } from '../../classify/options';

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

    it('does NOT classify a long university dropdown as race', () => {
      // Palantir Lever native-select shipped a 1,500-entry university list
      // whose entries trivially substring-match race tokens
      // ("Asian University of Bangladesh", "American Indian College",
      // "Black Hills State University", "African Leadership", etc.). The
      // race signature must not fire on lists of this size.
      const universityList = [
        'Aalborg University',
        'Asian University of Bangladesh',
        'African Leadership University, Rwanda',
        'American University',
        'Black Hills State University',
        'Native Hawaiian University',
        'White Sands Community College',
        'Pacific University',
        'Stanford University',
        'University of Texas - Austin',
        'Yale University',
        'Did not attend university',
        'Other - School Not Listed',
      ];
      expect(classifyByOptions(universityList)).not.toBe('race');
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

  describe('exportControl (granular ITAR 5-option)', () => {
    // Chaos Industries Greenhouse (2026-05-01) — ML routes these to visaType
    // at low confidence and only happens to fill correctly for US citizens.
    // Detecting the option shape directly upgrades to exportControl so the
    // alias matcher works for everyone.
    it('detects the canonical 5-option ITAR list', () => {
      expect(
        classifyByOptions([
          'A United States citizen or national',
          'A person lawfully admitted for permanent residence of the United States (i.e., "Green Card" holder)',
          'A person admitted as a refugee to the United States under 8 U.S.C. 1157',
          'A person admitted as an asylee to the United States under 8 U.S.C 1158',
          'None of the above',
        ]),
      ).toBe('exportControl');
    });

    it('detects shorter ITAR phrasings', () => {
      expect(
        classifyByOptions([
          'U.S. citizen',
          'Lawful permanent resident',
          'Refugee',
          'Asylee',
          'Foreign person',
        ]),
      ).toBe('exportControl');
    });

    it('does NOT classify Yes/No exportControl as the granular shape', () => {
      // Yes/No must fall through to label-based classification; the registry
      // guard in fillers/select.ts handles the skip.
      expect(classifyByOptions(['Yes', 'No'])).not.toBe('exportControl');
    });

    it('does NOT classify the visaType dropdown as exportControl', () => {
      // visaType lists have H-1B / L-1 etc. — only one ITAR token at most
      // ("US Citizen"). Hits=1, threshold ≥3, signature does not fire.
      expect(
        classifyByOptions(['US Citizen', 'Green Card', 'H-1B', 'L-1', 'O-1', 'TN', 'Other']),
      ).not.toBe('exportControl');
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

describe('looksLikeCountryList', () => {
  it('detects a workAuth-style country list with a No fallback', () => {
    expect(
      looksLikeCountryList([
        'United States',
        'Singapore',
        'No',
        'N.A. - this is a remote position',
      ]),
    ).toBe(true);
  });

  it('detects two-country lists', () => {
    expect(looksLikeCountryList(['United States', 'Canada'])).toBe(true);
  });

  it('rejects pure Yes/No', () => {
    expect(looksLikeCountryList(['Yes', 'No'])).toBe(false);
  });

  it('rejects long lists (likely a full country dropdown rather than a few options)', () => {
    const many = ['United States', 'Canada', 'Mexico', 'Germany', 'France', 'Japan', 'Korea'];
    expect(looksLikeCountryList(many)).toBe(false);
  });

  it('rejects empty / single-option lists', () => {
    expect(looksLikeCountryList([])).toBe(false);
    expect(looksLikeCountryList(['United States'])).toBe(false);
  });

  it('rejects unrelated short lists', () => {
    expect(looksLikeCountryList(['Red', 'Green', 'Blue'])).toBe(false);
  });
});
