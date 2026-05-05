import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE, type Profile } from '@/lib/schema';
import { commitImport, detectConflicts, isMeaningfulValue, validateParsedFields } from '../commit';
import type { ImportPayload } from '../types';

function makePayload(fields: Partial<Profile>): ImportPayload {
  return {
    source: 'resume-pdf',
    fileName: 'resume.pdf',
    fileSize: 1024,
    fields,
    file: new File([new Uint8Array([0])], 'resume.pdf', { type: 'application/pdf' }),
  };
}

describe('isMeaningfulValue', () => {
  it.each([
    ['', false],
    ['  ', false],
    ['hello', true],
    [0, true],
    [false, true],
    [true, true],
    [-1, true],
    [undefined, false],
    [null, false],
    [[], false],
    [['x'], true],
    [{}, true],
  ])('%j → %s', (value, expected) => {
    expect(isMeaningfulValue(value)).toBe(expected);
  });
});

describe('commitImport', () => {
  it('overwrite-all writes parsed values, replacing existing', () => {
    const current = { ...DEFAULT_PROFILE, firstName: 'OLD', email: 'old@x.com' };
    const payload = makePayload({ firstName: 'New', email: 'new@x.com', phone: '555' });
    const result = commitImport(current, payload, 'overwrite-all');

    expect(result.profile.firstName).toBe('New');
    expect(result.profile.email).toBe('new@x.com');
    expect(result.profile.phone).toBe('555');
    expect(result.fieldsApplied).toBe(3);
    expect(result.conflictsResolved).toBe(2);
    expect(result.fieldsSkipped).toBe(0);
    expect(result.attachFile).toBe(true);
  });

  it('skip-conflicts only fills empty fields', () => {
    const current = { ...DEFAULT_PROFILE, firstName: 'KEEP', email: '' };
    const payload = makePayload({ firstName: 'New', email: 'new@x.com', phone: '555' });
    const result = commitImport(current, payload, 'skip-conflicts');

    expect(result.profile.firstName).toBe('KEEP'); // existing kept
    expect(result.profile.email).toBe('new@x.com'); // empty filled
    expect(result.profile.phone).toBe('555'); // empty filled
    expect(result.fieldsApplied).toBe(2);
    expect(result.fieldsSkipped).toBe(1);
    expect(result.conflictsResolved).toBe(0);
  });

  it('skip-all writes nothing but still requests file attachment', () => {
    const current = { ...DEFAULT_PROFILE, firstName: 'KEEP' };
    const payload = makePayload({ firstName: 'New', email: 'new@x.com' });
    const result = commitImport(current, payload, 'skip-all');

    expect(result.profile).toEqual(current);
    expect(result.attachFile).toBe(true);
    expect(result.fieldsApplied).toBe(0);
    expect(result.fieldsSkipped).toBe(2);
  });

  it('empty parsed values never overwrite existing data', () => {
    const current = { ...DEFAULT_PROFILE, firstName: 'KEEP', email: 'keep@x.com' };
    const payload = makePayload({ firstName: '', email: '   ', phone: '555' });
    const result = commitImport(current, payload, 'overwrite-all');

    expect(result.profile.firstName).toBe('KEEP');
    expect(result.profile.email).toBe('keep@x.com');
    expect(result.profile.phone).toBe('555');
    expect(result.fieldsApplied).toBe(1);
  });

  it('array fields replace on overwrite-all', () => {
    const current = {
      ...DEFAULT_PROFILE,
      skills: ['old1', 'old2'],
    };
    const payload = makePayload({ skills: ['new1'] });
    const result = commitImport(current, payload, 'overwrite-all');
    expect(result.profile.skills).toEqual(['new1']);
  });

  it('array fields are kept on skip-conflicts when existing is non-empty', () => {
    const current = {
      ...DEFAULT_PROFILE,
      skills: ['old1', 'old2'],
    };
    const payload = makePayload({ skills: ['new1'] });
    const result = commitImport(current, payload, 'skip-conflicts');
    expect(result.profile.skills).toEqual(['old1', 'old2']);
    expect(result.fieldsSkipped).toBe(1);
  });

  it('empty parsed array does not overwrite', () => {
    const current = { ...DEFAULT_PROFILE, skills: ['keep'] };
    const payload = makePayload({ skills: [] });
    const result = commitImport(current, payload, 'overwrite-all');
    expect(result.profile.skills).toEqual(['keep']);
    expect(result.fieldsApplied).toBe(0);
  });
});

describe('validateParsedFields', () => {
  it('passes through fully-valid fields', () => {
    const out = validateParsedFields({
      firstName: 'Avery',
      email: 'a@b.co',
      phone: '+1-555',
      skills: ['React'],
    });
    expect(out).toEqual({
      firstName: 'Avery',
      email: 'a@b.co',
      phone: '+1-555',
      skills: ['React'],
    });
  });

  it('drops invalid email but keeps valid neighbors', () => {
    const out = validateParsedFields({
      firstName: 'Avery',
      email: 'not-an-email',
      phone: '+1-555',
    });
    expect(out.firstName).toBe('Avery');
    expect(out.phone).toBe('+1-555');
    expect(out.email).toBeUndefined();
  });

  it('drops invalid LinkedIn URL but keeps GitHub', () => {
    const out = validateParsedFields({
      linkedin: 'not a url',
      github: 'https://github.com/avery',
    });
    expect(out.linkedin).toBeUndefined();
    expect(out.github).toBe('https://github.com/avery');
  });
});

describe('detectConflicts', () => {
  it('flags fields where existing has data', () => {
    const current = { ...DEFAULT_PROFILE, firstName: 'OLD', phone: '' };
    const fields = { firstName: 'New', phone: '555' };
    const { conflicts, toApply } = detectConflicts(current, fields);
    expect(conflicts.has('firstName')).toBe(true);
    expect(conflicts.has('phone')).toBe(false);
    expect(toApply.has('firstName')).toBe(true);
    expect(toApply.has('phone')).toBe(true);
  });

  it('does not include fields with empty parsed values in toApply', () => {
    const current = { ...DEFAULT_PROFILE };
    const fields = { firstName: '', phone: '555' };
    const { toApply } = detectConflicts(current, fields);
    expect(toApply.has('firstName')).toBe(false);
    expect(toApply.has('phone')).toBe(true);
  });
});
