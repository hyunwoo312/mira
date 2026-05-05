import { describe, it, expect } from 'vitest';
import { parseResumePdf, ResumeParseError, describeParseError } from '../resume-parser';

function makeFile(bytes: number[], name = 'r.pdf'): File {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
}

describe('parseResumePdf — validation failures', () => {
  it('throws ResumeParseError on wrong magic bytes', async () => {
    const file = makeFile([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    await expect(parseResumePdf(file)).rejects.toBeInstanceOf(ResumeParseError);
    await expect(parseResumePdf(file)).rejects.toMatchObject({
      cause: { kind: 'validation' },
    });
  });

  it('throws ResumeParseError on tiny file', async () => {
    const file = makeFile([0x25]);
    await expect(parseResumePdf(file)).rejects.toBeInstanceOf(ResumeParseError);
  });
});

describe('describeParseError', () => {
  it.each([
    [{ kind: 'encrypted' as const }, /locked/i],
    [{ kind: 'no-text-layer' as const }, /selectable text/i],
    [{ kind: 'parser-failed' as const, message: 'oops' }, /couldn't read/i],
    [{ kind: 'validation' as const, message: 'too big' }, /too big/i],
  ])('describes %j', (err, regex) => {
    expect(describeParseError(err)).toMatch(regex);
  });
});
