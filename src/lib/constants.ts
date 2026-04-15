// Chrome Web Store listing URL
export const CWS_URL = 'https://chromewebstore.google.com/detail/nmanfejonnmcnldcpbjhcglbbhdglbpa';

// Storage keys for CWS features
export const FILL_COUNT_KEY = 'mira_fill_count';
export const RATE_DISMISSED_KEY = 'mira_rate_dismissed';
export const CHANGELOG_KEY = 'mira_changelog';

// Idle timeout before unloading ML model (5 minutes)
export const ML_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Changelog entries keyed by version
export const CHANGELOG: Record<string, string[]> = {
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
