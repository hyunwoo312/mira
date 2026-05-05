import { describe, it, expect } from 'vitest';
import { validatePdfFile, describeValidationError, MAX_PDF_BYTES } from '../file-validation';

function makeFile(bytes: number[] | Uint8Array, name = 'r.pdf', size?: number): File {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blob = new Blob([u8.buffer as ArrayBuffer], { type: 'application/pdf' });
  const f = new File([blob], name, { type: 'application/pdf' });
  if (size != null) Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('validatePdfFile', () => {
  it('accepts a valid PDF magic-byte header', async () => {
    // %PDF- followed by some bytes
    const file = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(await validatePdfFile(file)).toBeNull();
  });

  it('rejects when magic bytes do not match', async () => {
    const file = makeFile([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00], 'fake.pdf');
    const result = await validatePdfFile(file);
    expect(result).toEqual({ kind: 'wrong-type' });
  });

  it('rejects oversized files', async () => {
    const file = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d], 'big.pdf', MAX_PDF_BYTES + 1);
    const result = await validatePdfFile(file);
    expect(result).toEqual({ kind: 'too-large', sizeBytes: MAX_PDF_BYTES + 1 });
  });

  it('rejects unreadably-small files', async () => {
    const file = makeFile([0x25], 'tiny.pdf', 1);
    const result = await validatePdfFile(file);
    expect(result).toEqual({ kind: 'unreadable' });
  });
});

describe('describeValidationError', () => {
  it.each([
    [{ kind: 'wrong-type' as const }, /doesn't look like a PDF/i],
    [{ kind: 'unreadable' as const }, /couldn't read/i],
    [{ kind: 'too-large' as const, sizeBytes: 7 * 1024 * 1024 }, /7\.0 MB/],
  ])('describes %j', (err, regex) => {
    expect(describeValidationError(err)).toMatch(regex);
  });
});
