import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isOnboardingUrl, getOnboardingUrl, openOnboardingTab } from '../index';

describe('onboarding URL helpers', () => {
  beforeEach(() => {
    globalThis.chrome = {
      ...(globalThis.chrome ?? {}),
      runtime: {
        ...(globalThis.chrome?.runtime ?? {}),
        getURL: (path: string) => `chrome-extension://abc123/${path}`,
      },
      tabs: {
        ...(globalThis.chrome?.tabs ?? {}),
        create: vi.fn().mockResolvedValue({ id: 42 }),
      },
    } as unknown as typeof chrome;
  });

  it('getOnboardingUrl returns the extension-scoped path', () => {
    expect(getOnboardingUrl()).toBe('chrome-extension://abc123/onboarding.html');
  });

  it('isOnboardingUrl matches the canonical URL', () => {
    expect(isOnboardingUrl('chrome-extension://abc123/onboarding.html')).toBe(true);
  });

  it('isOnboardingUrl tolerates query strings and hashes', () => {
    expect(isOnboardingUrl('chrome-extension://abc123/onboarding.html?phase=2')).toBe(true);
    expect(isOnboardingUrl('chrome-extension://abc123/onboarding.html#trial')).toBe(true);
  });

  it('isOnboardingUrl returns false for unrelated URLs', () => {
    expect(isOnboardingUrl('https://greenhouse.io/job/123')).toBe(false);
    expect(isOnboardingUrl('chrome-extension://abc123/sidepanel.html')).toBe(false);
    expect(isOnboardingUrl(undefined)).toBe(false);
    expect(isOnboardingUrl('')).toBe(false);
  });

  it('openOnboardingTab calls chrome.tabs.create with the canonical URL', async () => {
    await openOnboardingTab();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://abc123/onboarding.html',
    });
  });
});
