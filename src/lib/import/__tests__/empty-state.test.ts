import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE } from '@/lib/schema';
import { isPresetUntouched, dismissalStorageKey } from '../empty-state';

describe('isPresetUntouched', () => {
  it('treats the default profile as untouched', () => {
    expect(isPresetUntouched(DEFAULT_PROFILE)).toBe(true);
  });

  it.each([
    ['firstName set', { ...DEFAULT_PROFILE, firstName: 'Avery' }],
    ['lastName set', { ...DEFAULT_PROFILE, lastName: 'Chen' }],
    ['email set', { ...DEFAULT_PROFILE, email: 'a@b.co' }],
    [
      'work entry',
      {
        ...DEFAULT_PROFILE,
        workExperience: [
          {
            company: 'X',
            title: 'T',
            location: '',
            current: false,
            description: '',
          },
        ],
      },
    ],
    [
      'education entry',
      {
        ...DEFAULT_PROFILE,
        education: [{ school: 'X', degree: '', fieldOfStudy: '', minor: '', gpa: '' }],
      },
    ],
  ])('returns false when %s', (_label, profile) => {
    expect(isPresetUntouched(profile)).toBe(false);
  });

  it('tolerates non-keystone fields being set (preset still counts as untouched)', () => {
    expect(
      isPresetUntouched({
        ...DEFAULT_PROFILE,
        phone: '555',
        skills: ['React'],
      }),
    ).toBe(true);
  });
});

describe('dismissalStorageKey', () => {
  it('is preset-scoped', () => {
    expect(dismissalStorageKey('p1')).toBe('mira_import_dismissed_p1');
    expect(dismissalStorageKey('p2')).toBe('mira_import_dismissed_p2');
  });
});
