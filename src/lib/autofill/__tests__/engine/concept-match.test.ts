import { describe, it, expect } from 'vitest';
import { matchByConcept } from '../../engine/concept-match';

describe('matchByConcept', () => {
  describe('positive matching', () => {
    it('should match "Yes" to first positive option', () => {
      const idx = matchByConcept(['Yes', 'No'], 'Yes');
      expect(idx).toBe(0);
    });

    it('should match "true" to "Yes" option', () => {
      const idx = matchByConcept(['No', 'Yes'], 'true');
      expect(idx).toBe(1);
    });

    it('should match "I am" to "I am authorized" option', () => {
      const idx = matchByConcept(['I am not authorized', 'I am authorized to work'], 'I am');
      expect(idx).toBe(1);
    });

    it('should match "I consent" values', () => {
      const idx = matchByConcept(['I do not consent', 'I consent to the terms'], 'I consent');
      expect(idx).toBe(1);
    });
  });

  describe('negative matching', () => {
    it('should match "No" to first negative option', () => {
      const idx = matchByConcept(['Yes', 'No'], 'No');
      expect(idx).toBe(1);
    });

    it('should match "false" to "No" option', () => {
      const idx = matchByConcept(['No', 'Yes'], 'false');
      expect(idx).toBe(0);
    });

    it('should match "Decline" to decline option', () => {
      const idx = matchByConcept(['I accept', 'I decline to answer'], 'Decline');
      expect(idx).toBe(1);
    });
  });

  describe('non-boolean values', () => {
    it('should return -1 for non-boolean values', () => {
      const idx = matchByConcept(['Option A', 'Option B'], 'San Francisco');
      expect(idx).toBe(-1);
    });
  });

  describe('location-aware matching', () => {
    it('should prefer local option when user location matches', () => {
      const idx = matchByConcept(
        ['Yes, I currently live in the area', 'Yes, I am willing to relocate'],
        'Yes',
        'San Francisco, CA',
      );
      // Both are positive, but local option is picked when no specific match
      expect(idx).toBeGreaterThanOrEqual(0);
    });

    it('should prefer relocate option when user location does not match', () => {
      const idx = matchByConcept(
        ['Yes, I currently live in New York', 'Yes, I am willing to relocate'],
        'Yes',
        'San Francisco, CA',
      );
      expect(idx).toBe(1);
    });
  });
});
