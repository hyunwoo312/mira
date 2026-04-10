import { describe, it, expect } from 'vitest';
import { classifyOptions } from '../../engine/classifier';

describe('classifyOptions', () => {
  describe('fuzzy matching', () => {
    it('should match exact option', () => {
      const result = classifyOptions(['Male', 'Female', 'Non-binary'], 'Male', 'gender');
      expect(result.index).toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedText).toBe('Male');
    });

    it('should match case-insensitive', () => {
      const result = classifyOptions(['male', 'female'], 'Male', 'gender');
      expect(result.index).toBe(0);
    });

    it('should return no match for empty options', () => {
      const result = classifyOptions([], 'Male', 'gender');
      expect(result.index).toBe(-1);
    });
  });

  describe('concept matching', () => {
    it('should match boolean yes/no for eligible categories', () => {
      const result = classifyOptions(['Yes', 'No'], 'Yes', 'workAuth');
      expect(result.index).toBe(0);
    });

    it('should skip concept matching for excluded categories', () => {
      // "Yes" won't concept-match against gender options
      const result = classifyOptions(['Male', 'Female'], 'Yes', 'gender');
      expect(result.index).toBe(-1);
    });
  });

  describe('location scoring', () => {
    it('should match city in location options', () => {
      const result = classifyOptions(
        ['San Francisco, CA, US', 'San Diego, CA, US', 'San Antonio, TX, US'],
        'San Francisco, CA',
        'location',
      );
      expect(result.index).toBe(0);
      expect(result.matchedText).toBe('San Francisco, CA, US');
    });

    it('should prefer option starting with city name', () => {
      const result = classifyOptions(
        ['Greater San Francisco Bay Area', 'San Francisco, CA'],
        'San Francisco, CA',
        'location',
      );
      expect(result.index).toBe(1);
    });

    it('should match state abbreviation', () => {
      const result = classifyOptions(['Austin, TX', 'Austin, MN'], 'Austin, Texas', 'location');
      expect(result.index).toBe(0);
    });
  });
});
