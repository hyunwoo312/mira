import { fuzzyMatchOption } from '../match';

describe('fuzzyMatchOption', () => {
  // ── 1. Direct exact match ──────────────────────────────────────────

  describe('direct exact match (score 1)', () => {
    it('should match exact option text', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'Yes');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should match second option', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'No');
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should be case-insensitive', () => {
      const result = fuzzyMatchOption(['Male', 'Female'], 'male');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should trim whitespace', () => {
      const result = fuzzyMatchOption(['Male', 'Female'], '  male  ');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should match with mixed case', () => {
      const result = fuzzyMatchOption(['United States', 'Canada'], 'united states');
      expect(result).toEqual({ index: 0, score: 1 });
    });
  });

  // ── 2. Unicode normalization ───────────────────────────────────────

  describe('unicode normalization', () => {
    it('should normalize curly single quotes to straight quotes', () => {
      // \u2018 = left single quote, \u2019 = right single quote
      const result = fuzzyMatchOption(['Bachelor\u2019s', "Master's"], "Bachelor's");
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should normalize curly double quotes', () => {
      // \u201C = left double quote, \u201D = right double quote
      const result = fuzzyMatchOption(['\u201CYes\u201D', '"Yes"'], '"Yes"');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should normalize em dashes to hyphens', () => {
      // \u2014 = em dash
      const result = fuzzyMatchOption(['full\u2014time', 'part-time'], 'full-time');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should normalize en dashes to hyphens', () => {
      // \u2013 = en dash
      const result = fuzzyMatchOption(['full\u2013time', 'part-time'], 'full-time');
      expect(result).toEqual({ index: 0, score: 1 });
    });
  });

  // ── 3. Direct contains match (score 0.85) ─────────────────────────

  describe('direct contains match (score 0.85)', () => {
    it('should match when value (8+ chars) is contained in option (5+ chars)', () => {
      const result = fuzzyMatchOption(
        ['Bachelor of Science in Computer Science', 'Other degree'],
        'Computer Science', // 16 chars, option is long enough
      );
      expect(result).toEqual({ index: 0, score: 0.85 });
    });

    it('should match when option (5+ chars) is contained in value (8+ chars)', () => {
      const result = fuzzyMatchOption(
        ['Science', 'Engineering'], // 7 and 11 chars (both >= 5)
        'Bachelor of Science', // 19 chars >= 8
      );
      expect(result).toEqual({ index: 0, score: 0.85 });
    });

    it('should not trigger contains for short values (< 8 chars)', () => {
      // "Foo" is 3 chars - below the 8-char minimum for step 2
      // and below the 5-char minimum for step 4 alias contains
      const result = fuzzyMatchOption(
        ['Something with Foo inside it', 'Another Long Option'],
        'Foo',
      );
      // Step 2 skipped (value < 8 chars), step 4 skipped (form < 5 chars)
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should skip options shorter than 5 chars', () => {
      const result = fuzzyMatchOption(
        ['CS', 'Engineering Sciences'],
        'Engineering Sciences Department', // 31 chars, well over 8
      );
      // "CS" is only 2 chars, should be skipped; "Engineering Sciences" is 20 chars and contained
      expect(result).toEqual({ index: 1, score: 0.85 });
    });
  });

  // ── 4. Alias exact match with category (score 1) ──────────────────

  describe('alias exact match with category (score 1)', () => {
    it('should resolve country alias USA -> United States', () => {
      const result = fuzzyMatchOption(
        ['United States', 'Canada', 'Mexico'],
        'USA',
        false,
        'country',
      );
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve country alias UK -> United Kingdom', () => {
      const result = fuzzyMatchOption(
        ['United States', 'United Kingdom', 'Canada'],
        'UK',
        false,
        'country',
      );
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should resolve gender alias Man -> Male', () => {
      const result = fuzzyMatchOption(['Male', 'Female', 'Non-binary'], 'Man', false, 'gender');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve gender alias She/Her -> Female', () => {
      const result = fuzzyMatchOption(['Male', 'Female', 'Non-binary'], 'She/Her', false, 'gender');
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should resolve yesNo alias true -> Yes for workAuth', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'true', false, 'workAuth');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve yesNo alias false -> No for sponsorship', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'false', false, 'sponsorship');
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it("should resolve degree alias BS -> Bachelor's", () => {
      const result = fuzzyMatchOption(
        ["Bachelor's", "Master's", 'Doctorate'],
        'BS',
        false,
        'degree',
      );
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve degree alias PhD -> Doctorate', () => {
      const result = fuzzyMatchOption(
        ["Bachelor's", "Master's", 'Doctorate'],
        'PhD',
        false,
        'degree',
      );
      expect(result).toEqual({ index: 2, score: 1 });
    });

    it('should resolve state alias CA -> California', () => {
      const result = fuzzyMatchOption(['California', 'New York', 'Texas'], 'CA', false, 'state');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve state alias NY -> New York', () => {
      const result = fuzzyMatchOption(['California', 'New York', 'Texas'], 'NY', false, 'state');
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should resolve veteran status alias', () => {
      const result = fuzzyMatchOption(
        [
          'I am not a protected veteran',
          'I identify as a protected veteran',
          'Decline to self-identify',
        ],
        'Veteran',
        false,
        'veteranStatus',
      );
      // "Veteran" alias resolves to correct option via alias exact match
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should resolve disability status alias', () => {
      const result = fuzzyMatchOption(
        ['Yes, I have a disability', 'No, I do not have a disability', 'Decline to self-identify'],
        'No',
        false,
        'disabilityStatus',
      );
      // "no" is an alias for "No, I do not have a disability"
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should resolve noticePeriod alias for startDate', () => {
      const result = fuzzyMatchOption(
        ['Immediately', '2 weeks', '1 month'],
        'ASAP',
        false,
        'startDate',
      );
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should resolve lgbtq alias', () => {
      const result = fuzzyMatchOption(
        [
          'Yes, I identify as a member of the LGBTQ+ community',
          'No, I do not identify as a member of the LGBTQ+ community',
          "I don't wish to answer",
        ],
        'Decline',
        false,
        'lgbtq',
      );
      expect(result).toEqual({ index: 2, score: 1 });
    });

    it('should resolve race alias isHispanic -> race category', () => {
      // "Hispanic" alias resolves to "Hispanic or Latino" via alias exact match (score 1.0)
      const result = fuzzyMatchOption(
        ['Hispanic or Latino', 'Not Hispanic or Latino'],
        'Hispanic',
        false,
        'isHispanic',
      );
      expect(result).toEqual({ index: 0, score: 1 });
    });
  });

  // ── 5. Alias contains match (score 0.7) ───────────────────────────

  describe('alias contains match (score 0.7)', () => {
    it('should match when alias form (4+ chars) is contained in option (4+ chars)', () => {
      // "United States of America" is an alias for "United States"
      // All forms include "united states of america" (24 chars, >= 5)
      // Option "The United States of America Region" contains the alias form
      const result = fuzzyMatchOption(
        ['The United States of America Region', 'Canada Region'],
        'America', // alias of "United States" -> forms include "america" (7 chars)
        false,
        'country',
      );
      expect(result).toEqual({ index: 0, score: 0.7 });
    });

    it('should match alias forms 4+ chars via contains', () => {
      // "He/Him" alias of Male, forms include "male" (4 chars, >= 4 threshold)
      // "Male Person Extended" contains "male" → matches via alias contains
      const result = fuzzyMatchOption(
        ['Male Person Extended', 'Female Person Extended'],
        'He/Him',
        false,
        'gender',
      );
      expect(result).toEqual({ index: 0, score: 0.7 });
    });
  });

  // ── 6. Scoped vs flat alias isolation ──────────────────────────────

  describe('category scoping prevents cross-contamination', () => {
    it('should not use yesNo aliases when category is gender', () => {
      // "Yes" is an alias key in yesNo, but should not resolve in gender context
      const result = fuzzyMatchOption(
        ['Male', 'Female', 'Non-binary'],
        'true', // yesNo alias for "Yes", but gender scope has no "true"
        false,
        'gender',
      );
      // Should not match anything since "true" is not a gender alias
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should not use gender aliases when category is degree', () => {
      const result = fuzzyMatchOption(
        ["Bachelor's", "Master's", 'Doctorate'],
        'Man', // gender alias, should not apply in degree scope
        false,
        'degree',
      );
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should not use country aliases when category is state', () => {
      const result = fuzzyMatchOption(
        ['California', 'New York'],
        'USA', // country alias, should not apply in state scope
        false,
        'state',
      );
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should fall back to flat aliases when no category is provided', () => {
      // Without a category, flat lookup is used - "USA" maps to United States forms
      const result = fuzzyMatchOption(
        ['United States', 'Canada'],
        'USA',
        false,
        // no fieldCategory
      );
      expect(result).toEqual({ index: 0, score: 1 });
    });
  });

  // ── Jaro-Winkler similarity matching ──────────────────────────────

  describe('Jaro-Winkler similarity matching', () => {
    it('should match close misspellings', () => {
      const result = fuzzyMatchOption(['California', 'New York', 'Texas'], 'Californa');
      expect(result.index).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(0.85);
    });

    it('should match minor formatting differences', () => {
      const result = fuzzyMatchOption(['Non-binary', 'Male', 'Female'], 'Nonbinary');
      expect(result.index).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(0.85);
    });

    it('should not match very different strings', () => {
      const result = fuzzyMatchOption(['Engineer', 'Designer', 'Manager'], 'Doctor');
      expect(result.index).toBe(-1);
    });

    it('should skip very short values', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'Ye');
      // "Ye" is < 3 chars, Jaro-Winkler is skipped
      expect(result.index).toBe(-1);
    });

    it('should prefer exact match over Jaro-Winkler', () => {
      const result = fuzzyMatchOption(['Male', 'Mal', 'Female'], 'Male');
      expect(result.index).toBe(0);
      expect(result.score).toBe(1); // exact match, not Jaro-Winkler
    });

    it('should give higher scores to common-prefix matches', () => {
      // Jaro-Winkler boosts matches that share a prefix
      const result = fuzzyMatchOption(['Engineering', 'Enginering', 'Marketing'], 'Engineering');
      expect(result.index).toBe(0);
      expect(result.score).toBe(1); // exact match
    });
  });

  // ── 7. allowFirst fallback (score 0.3) ─────────────────────────────

  describe('allowFirst fallback (score 0.3)', () => {
    it('should return first option when allowFirst is true and nothing else matches', () => {
      const result = fuzzyMatchOption(
        ['San Francisco, CA', 'New York, NY'],
        'xyznonexistent',
        true,
      );
      expect(result).toEqual({ index: 0, score: 0.3 });
    });

    it('should not use fallback when allowFirst is false', () => {
      const result = fuzzyMatchOption(
        ['San Francisco, CA', 'New York, NY'],
        'xyznonexistent',
        false,
      );
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should not use fallback when allowFirst is default (false)', () => {
      const result = fuzzyMatchOption(['San Francisco, CA', 'New York, NY'], 'xyznonexistent');
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should prefer exact match over fallback', () => {
      const result = fuzzyMatchOption(['Option A', 'Option B'], 'Option B', true);
      expect(result).toEqual({ index: 1, score: 1 });
    });

    it('should return no match if options array is empty even with allowFirst', () => {
      const result = fuzzyMatchOption([], 'anything', true);
      expect(result).toEqual({ index: -1, score: 0 });
    });
  });

  // ── 8. No match ───────────────────────────────────────────────────

  describe('no match (index -1, score 0)', () => {
    it('should return no match for completely unrelated value', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'Banana');
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should return no match for empty options', () => {
      const result = fuzzyMatchOption([], 'anything');
      expect(result).toEqual({ index: -1, score: 0 });
    });

    it('should return no match for empty value against non-matching options', () => {
      const result = fuzzyMatchOption(['Yes', 'No'], 'xyz');
      expect(result).toEqual({ index: -1, score: 0 });
    });
  });

  // ── 9. Priority ordering ──────────────────────────────────────────

  describe('match priority ordering', () => {
    it('should prefer direct exact match over alias match', () => {
      // "Yes" appears directly in options AND is an alias canonical form
      const result = fuzzyMatchOption(['Yes', 'No'], 'Yes', false, 'workAuth');
      // Direct exact match wins with score 1 (step 1, not step 3)
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should prefer direct exact match over contains match', () => {
      // If value exactly matches one option, don't fall through to contains
      const result = fuzzyMatchOption(['Engineering', 'Engineering Sciences'], 'Engineering');
      expect(result).toEqual({ index: 0, score: 1 });
    });

    it('should prefer alias exact over contains, and contains over alias contains', () => {
      // Alias exact (score 1.0) > direct contains (0.85) > alias contains (0.7)
      const result = fuzzyMatchOption(
        ['United States of America', 'Canada'],
        'United States of America Region', // 31 chars, value includes option
      );
      // Direct contains: value includes option → score 0.85
      expect(result).toEqual({ index: 0, score: 0.85 });
    });
  });
});
