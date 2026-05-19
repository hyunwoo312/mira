import { describe, expect, it } from 'vitest';
import { createFailedFillResult } from '@/lib/fill-result';
import { formatDebugLog } from '../debug-log';

describe('formatDebugLog', () => {
  it('includes structured failure details', () => {
    const result = createFailedFillResult('no-form-detected', '0 candidate fields');
    const text = formatDebugLog(result, [], 'https://example.com/jobs');

    expect(text).toContain('Failure: No application form found (no-form-detected)');
    expect(text).toContain('Message: Mira could not find an application form on this page');
    expect(text).toContain('Open the application form, not just the job description page');
    expect(text).toContain('Retryable: yes');
    expect(text).toContain('Detail: 0 candidate fields');
  });

  it('includes fallback errors when no structured failure is present', () => {
    const text = formatDebugLog(null, [], 'https://example.com/jobs', 'Raw fill error');
    expect(text).toContain('Error: Raw fill error');
  });
});
