import { describe, it, expect } from 'vitest';
import { profileSchema, DEFAULT_PROFILE } from '../schema';

describe('profileSchema', () => {
  it('parses empty object to defaults', () => {
    const result = profileSchema.parse({});
    expect(result.firstName).toBe('');
    expect(result.email).toBe('');
    expect(result.workAuthorization).toBe(true);
    expect(result.skipEeo).toBe(false);
  });

  it('parses valid profile data', () => {
    const data = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      country: 'US',
      workExperience: [{ company: 'Acme', title: 'Engineer', current: true, description: '' }],
      skills: ['React', 'TypeScript'],
    };
    const result = profileSchema.parse(data);
    expect(result.firstName).toBe('John');
    expect(result.workExperience).toHaveLength(1);
    expect(result.skills).toEqual(['React', 'TypeScript']);
  });

  it('rejects invalid email', () => {
    const result = profileSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('allows empty email', () => {
    const result = profileSchema.safeParse({ email: '' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL for linkedin', () => {
    const result = profileSchema.safeParse({ linkedin: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('allows empty URL', () => {
    const result = profileSchema.safeParse({ linkedin: '' });
    expect(result.success).toBe(true);
  });

  it('DEFAULT_PROFILE has correct defaults', () => {
    expect(DEFAULT_PROFILE.firstName).toBe('');
    expect(DEFAULT_PROFILE.dateOfBirth).toBe('');
    expect(DEFAULT_PROFILE.workAuthorization).toBe(true);
    expect(DEFAULT_PROFILE.sponsorshipNeeded).toBe(false);
    expect(DEFAULT_PROFILE.workExperience).toEqual([]);
    expect(DEFAULT_PROFILE.education).toEqual([]);
    expect(DEFAULT_PROFILE.skills).toEqual([]);
  });
});
