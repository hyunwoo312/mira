import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollspy } from '../use-scrollspy';

const SECTION_IDS = [
  'personal',
  'links',
  'work',
  'education',
  'skills',
  'preferences',
  'eeo',
  'documents',
] as const;

describe('useScrollspy', () => {
  it('returns initial active section as first section', () => {
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    expect(result.current.activeSection).toBe('personal');
  });
});
