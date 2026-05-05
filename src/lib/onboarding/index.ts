/**
 * Onboarding URL + state helpers shared between background, side panel,
 * fill pipeline, and the onboarding entrypoint itself.
 */

const ONBOARDING_PATH = 'onboarding.html';

export function getOnboardingUrl(): string {
  return chrome.runtime.getURL(ONBOARDING_PATH);
}

/** True when the URL points to this extension's onboarding page. */
export function isOnboardingUrl(url: string | undefined): boolean {
  if (!url) return false;
  const onboardingUrl = getOnboardingUrl();
  return url.startsWith(onboardingUrl);
}

export async function openOnboardingTab(): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url: getOnboardingUrl() });
}
