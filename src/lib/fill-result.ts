export type FillFailureCode =
  | 'already-running'
  | 'content-script-unavailable'
  | 'demo-fill-failed'
  | 'injection-failed'
  | 'no-active-tab'
  | 'no-form-detected'
  | 'preset-not-found'
  | 'restricted-page'
  | 'unexpected';

export interface FillFailure {
  code: FillFailureCode;
  title: string;
  message: string;
  retryable: boolean;
  detail?: string;
}

export interface FillResultSummary {
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs?: number;
  mlAvailable?: boolean;
  ats?: string;
  totalFormElements?: number;
  failure?: FillFailure;
}

const FAILURE_COPY: Record<FillFailureCode, Omit<FillFailure, 'code' | 'detail'>> = {
  'already-running': {
    title: 'Fill already running',
    message: 'Mira is still filling this application. Wait for the current fill to finish.',
    retryable: true,
  },
  'content-script-unavailable': {
    title: 'Page did not respond',
    message:
      'Mira injected the fill script, but the page did not respond. Reload the page and try again.',
    retryable: true,
  },
  'demo-fill-failed': {
    title: 'Demo fill failed',
    message: 'The onboarding demo did not respond. Reload the onboarding tab and try again.',
    retryable: true,
  },
  'injection-failed': {
    title: 'Could not access this page',
    message: 'Chrome blocked Mira from injecting the fill script on this page.',
    retryable: false,
  },
  'no-active-tab': {
    title: 'No active tab',
    message: 'Open a job application tab, then run Mira again.',
    retryable: true,
  },
  'no-form-detected': {
    title: 'No application form found',
    message:
      'Mira could not find an application form on this page. Open the application form, not just the job description page.',
    retryable: true,
  },
  'preset-not-found': {
    title: 'Profile preset not found',
    message: 'Select an existing profile preset and try again.',
    retryable: true,
  },
  'restricted-page': {
    title: 'Unsupported page',
    message: 'Chrome does not allow extensions to fill this kind of page.',
    retryable: false,
  },
  unexpected: {
    title: 'Fill failed',
    message: 'Mira hit an unexpected error while filling this page.',
    retryable: true,
  },
};

export function createFillFailure(code: FillFailureCode, detail?: string): FillFailure {
  return { code, ...FAILURE_COPY[code], detail };
}

export function createFailedFillResult(code: FillFailureCode, detail?: string): FillResultSummary {
  return {
    filled: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    failure: createFillFailure(code, detail),
  };
}

export function isRestrictedFillUrl(url?: string): boolean {
  if (!url) return false;
  if (/^(chrome|edge|brave|opera|vivaldi|about|devtools):/i.test(url)) return true;
  if (/^chrome-extension:/i.test(url)) return true;
  return /^https:\/\/chromewebstore\.google\.com\//i.test(url);
}

export function fillErrorMessage(
  result: FillResultSummary | null,
  fallback?: string | null,
): string | null {
  return result?.failure?.message ?? fallback ?? null;
}
