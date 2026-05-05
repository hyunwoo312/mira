// Chrome Web Store listing URL
export const CWS_URL = 'https://chromewebstore.google.com/detail/nmanfejonnmcnldcpbjhcglbbhdglbpa';

// Storage keys for CWS features
export const FILL_COUNT_KEY = 'mira_fill_count';
export const RATE_DISMISSED_KEY = 'mira_rate_dismissed';
export const CHANGELOG_KEY = 'mira_changelog';
export const FIRST_FILL_CELEBRATED_KEY = 'mira_first_fill_celebrated';
export const ONBOARDING_SEEN_KEY = 'mira_onboarding_seen';

// Idle timeout before unloading ML model (5 minutes)
export const ML_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Changelog entries keyed by version
export const CHANGELOG: Record<string, string[]> = {
  '0.3.0': [
    'Onboarding added — a guided walkthrough opens on first install with a sample candidate and a live demo form so you can try a real fill before building your own profile. Replay it any time from Settings → Onboarding.',
    'Pre-fill from a resume PDF — drop your resume into a fresh preset or the Documents tab, review what was parsed, and save. One-click undo if anything looks off. Everything stays on your device.',
    'Sharper form-field detection across all supported platforms — fewer skipped fields and fewer wrong fills.',
    'New logo and a refreshed Chrome Web Store listing with better screenshots.',
    "Liking Mira? There's now a little coffee-cup button in the side panel — feel free to buy me one.",
  ],
  '0.2.2': [
    'Added iCIMS support — fills job applications on iCIMS-hosted career pages',
    'New Settings panel — customize overlay timing, skip EEO/salary, manage privacy and data',
    'Polishing across fill accuracy and UI',
  ],
  '0.2.1': [
    'Auto-fill from right-click menu or Ctrl+Shift+F shortcut',
    'Live fill progress overlay on the page',
    'Now available on Chrome Web Store',
  ],
  '0.2.0': [
    'Added Workday support — multi-page forms, experience, education, and EEO',
    'Application tracker to log your fill history, exportable as CSV',
    'Smaller, faster ML model (47% reduction in size)',
    'Profile completeness indicator to help you fill in missing fields',
  ],
  '0.1.1': [
    'Improved form filling accuracy and UI polish',
    'Better handling of education and work experience fields',
  ],
  '0.1.0': [
    'First release with Ashby, Greenhouse, and Lever support',
    'On-device ML that classifies form fields without sending data anywhere',
    'Profile manager with resume and cover letter uploads',
  ],
};
