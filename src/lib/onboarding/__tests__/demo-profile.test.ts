import { describe, it, expect } from 'vitest';
import { DEMO_PROFILE } from '../demo-profile';
import { profileToFillMap } from '@/lib/autofill/profile-map';
import { profileSchema } from '@/lib/schema';

describe('DEMO_PROFILE', () => {
  it('parses against the live profile schema', () => {
    expect(() => profileSchema.parse(DEMO_PROFILE)).not.toThrow();
  });

  it('has a fictional name so the demo persona reads as a complete profile', () => {
    expect(DEMO_PROFILE.firstName).toBe('Mira');
    expect(DEMO_PROFILE.lastName).toBe('Lewandowski');
  });

  it('produces a fillMap with every demo-form field populated', () => {
    const map = profileToFillMap(DEMO_PROFILE);
    // Personal
    expect(map.email).toBeTruthy();
    expect(map.phone).toBeTruthy();
    expect(map.location).toBeTruthy();
    expect(map.country).toBeTruthy();
    // Links
    expect(map.linkedin).toBeTruthy();
    expect(map.github).toBeTruthy();
    expect(map.portfolio).toBeTruthy();
    // Education / work
    expect(map.school).toBeTruthy();
    expect(map.degree).toBeTruthy();
    expect(map.fieldOfStudy).toBeTruthy();
    expect(map.company).toBeTruthy();
    expect(map.jobTitle).toBeTruthy();
    // EEO
    expect(map.gender).toBeTruthy();
    expect(map.race).toBeTruthy();
    expect(map.veteranStatus).toBeTruthy();
    expect(map.disabilityStatus).toBeTruthy();
    // Yes/No
    expect(map.workAuth).toBe('Yes');
    expect(map.sponsorship).toBe('No');
  });

  it('is a deterministic, reusable constant (multiple imports return the same data)', async () => {
    const { DEMO_PROFILE: again } = await import('../demo-profile');
    expect(again).toEqual(DEMO_PROFILE);
  });
});
