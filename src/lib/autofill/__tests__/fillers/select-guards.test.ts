import { describe, it, expect } from 'vitest';
import { shouldSkipYesNoForCategoryMismatch } from '../../fillers/select';

const YN = ['Yes', 'No'];
const YN_DECLINE = ['Yes', 'No', 'Decline to answer'];
const FIVE_CHOICE = [
  'A United States citizen or national',
  'A person lawfully admitted for permanent residence',
  'A person admitted as a refugee',
  'A person admitted as an asylee',
  'None of the above',
];

describe('shouldSkipYesNoForCategoryMismatch', () => {
  describe('exportControl', () => {
    // OFAC Yes/No semantic is inverted ("Yes" = sanctioned-country citizen).
    // Profile value "U.S. person" / "Foreign person" never matches Yes/No.
    it('skips exportControl on plain Yes/No', () => {
      expect(
        shouldSkipYesNoForCategoryMismatch('exportControl', YN, 'Are you a U.S. person?'),
      ).toBe(true);
    });

    it('skips exportControl on Yes/No/Decline', () => {
      expect(shouldSkipYesNoForCategoryMismatch('exportControl', YN_DECLINE)).toBe(true);
    });

    it('does NOT skip exportControl on the granular 5-option set', () => {
      // The fillMap "U.S. person" needs to fuzzy-match "A United States
      // citizen or national" (the option matcher handles this).
      expect(shouldSkipYesNoForCategoryMismatch('exportControl', FIVE_CHOICE)).toBe(false);
    });
  });

  describe('locatedInUS', () => {
    // The classic, legitimate Yes/No US-residency question — should fill.
    it.each([
      'Are you currently located in the US?',
      'Are you currently located in the United States?',
      'Do you currently live in the United States?',
      'Are you a U.S. resident?',
      'Are you a U.S.-based applicant?',
    ])('does NOT skip when label has US-residency intent: "%s"', (label) => {
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', YN, label)).toBe(false);
    });

    // The Fubo/Telnyx silent-wrong-fill family — region-specific phrasings
    // ML routes to locatedInUS at high confidence, but the profile's "Yes"
    // would be a wrong submission.
    it.each([
      'Are you currently located in the Greater New York City Metropolitan area?',
      'Are you located in San Francisco Bay Area?',
      'Are you based in the NYC metro area?',
      'Do you currently live in the Seattle area?',
      'Are you located near our Austin office?',
      'Are you based in Silicon Valley?',
    ])('skips when label has region-specific phrasing: "%s"', (label) => {
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', YN, label)).toBe(true);
    });

    it('skips when no field label is available (conservative)', () => {
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', YN, undefined)).toBe(true);
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', YN, '')).toBe(true);
    });
  });

  describe('non-guarded categories', () => {
    it('does not skip for categories outside the registry', () => {
      expect(
        shouldSkipYesNoForCategoryMismatch('relocate', YN, 'Are you willing to relocate?'),
      ).toBe(false);
      expect(shouldSkipYesNoForCategoryMismatch('workAuth', YN)).toBe(false);
      expect(shouldSkipYesNoForCategoryMismatch('sponsorship', YN)).toBe(false);
    });

    it('does not skip when category is undefined', () => {
      expect(shouldSkipYesNoForCategoryMismatch(undefined, YN, 'anything')).toBe(false);
    });
  });

  describe('non-Yes/No option sets', () => {
    it('does not fire when options are not Yes/No-only', () => {
      const cities = ['San Francisco', 'New York', 'Austin'];
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', cities)).toBe(false);
      expect(shouldSkipYesNoForCategoryMismatch('exportControl', cities)).toBe(false);
    });

    it('does not fire on empty option lists', () => {
      expect(shouldSkipYesNoForCategoryMismatch('locatedInUS', [])).toBe(false);
      expect(shouldSkipYesNoForCategoryMismatch('exportControl', [])).toBe(false);
    });
  });
});
