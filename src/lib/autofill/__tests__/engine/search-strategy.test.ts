import { describe, it, expect } from 'vitest';
import { inferSearchTerms } from '../../engine/search-strategy';

describe('inferSearchTerms', () => {
  describe('location', () => {
    it('should extract city as primary for location fields', () => {
      const result = inferSearchTerms('location', 'San Francisco, CA');
      expect(result.primary).toBe('San Francisco');
      expect(result.fallback).toBe('CA');
    });

    it('should use state as primary when description says "state"', () => {
      const result = inferSearchTerms('location', 'San Francisco, California', {
        description: 'Enter your state',
      });
      expect(result.primary).toBe('California');
      expect(result.fallback).toBe('San Francisco');
    });

    it('should use country when description says "country"', () => {
      const result = inferSearchTerms('location', 'San Francisco, CA, United States', {
        label: 'Country',
      });
      expect(result.primary).toBe('United States');
    });

    it('should handle single-part location', () => {
      const result = inferSearchTerms('location', 'Remote');
      expect(result.primary).toBe('Remote');
    });

    it('should truncate long city names', () => {
      const longCity = 'A'.repeat(50);
      const result = inferSearchTerms('location', `${longCity}, CA`);
      expect(result.primary.length).toBeLessThanOrEqual(30);
    });
  });

  describe('degree', () => {
    it('should extract degree level from full string', () => {
      const result = inferSearchTerms('degree', "Bachelor's Degree in Computer Science");
      expect(result.primary).toBe("Bachelor's");
    });

    it('should handle PhD', () => {
      const result = inferSearchTerms('degree', 'Ph.D. in Physics');
      expect(result.primary).toBe('PhD');
    });

    it('should handle MBA', () => {
      const result = inferSearchTerms('degree', 'MBA');
      expect(result.primary).toBe('MBA');
    });

    it('should handle associate degree', () => {
      const result = inferSearchTerms('degree', "Associate's Degree");
      expect(result.primary).toBe("Associate's");
    });

    it('should handle high school', () => {
      const result = inferSearchTerms('degree', 'High School Diploma');
      expect(result.primary).toBe('High School');
    });
  });

  describe('other categories', () => {
    it('should truncate school name to 30 chars', () => {
      const result = inferSearchTerms('school', 'Massachusetts Institute of Technology');
      expect(result.primary.length).toBeLessThanOrEqual(30);
    });

    it('should use company name directly', () => {
      const result = inferSearchTerms('company', 'Google');
      expect(result.primary).toBe('Google');
    });

    it('should truncate country to 20 chars', () => {
      const result = inferSearchTerms('country', 'United States of America');
      expect(result.primary.length).toBeLessThanOrEqual(20);
    });

    it('should use first segment for unknown categories', () => {
      const result = inferSearchTerms('unknown', 'Option A (with details)');
      expect(result.primary).toBe('Option A');
    });
  });
});
