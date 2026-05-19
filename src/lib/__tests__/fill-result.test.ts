import { describe, expect, it } from 'vitest';
import { createFailedFillResult, fillErrorMessage, isRestrictedFillUrl } from '../fill-result';

describe('fill-result helpers', () => {
  it('builds a user-facing failure result', () => {
    const result = createFailedFillResult('restricted-page', 'Cannot access chrome://settings');

    expect(result).toMatchObject({
      filled: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      failure: {
        code: 'restricted-page',
        title: 'Unsupported page',
        retryable: false,
        detail: 'Cannot access chrome://settings',
      },
    });
  });

  it('detects browser and Chrome Web Store pages as restricted', () => {
    expect(isRestrictedFillUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedFillUrl('edge://settings')).toBe(true);
    expect(isRestrictedFillUrl('https://chromewebstore.google.com/detail/mira')).toBe(true);
    expect(isRestrictedFillUrl('https://jobs.ashbyhq.com/example')).toBe(false);
  });

  it('prefers failure messages over fallback errors', () => {
    const result = createFailedFillResult('no-form-detected');
    expect(fillErrorMessage(result, 'Raw error')).toBe(result.failure!.message);
    expect(fillErrorMessage(null, 'Raw error')).toBe('Raw error');
  });
});
