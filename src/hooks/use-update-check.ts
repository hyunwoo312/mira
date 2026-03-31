import { useState, useEffect } from 'react';

const GITHUB_REPO = 'hyunwoo312/mira';
const CACHE_KEY = 'mira_update_check';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedCheck {
  latestVersion: string | null;
  checkedAt: number;
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  useEffect(() => {
    const currentVersion = chrome.runtime.getManifest().version;

    (async () => {
      try {
        const cached = await chrome.storage.local.get(CACHE_KEY);
        const entry = cached[CACHE_KEY] as CachedCheck | undefined;

        if (entry && Date.now() - entry.checkedAt < CACHE_TTL_MS) {
          if (entry.latestVersion && isNewer(entry.latestVersion, currentVersion)) {
            setUpdateAvailable(entry.latestVersion);
          }
          return;
        }

        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
        if (!res.ok) return;

        const data = await res.json();
        const latestVersion = (data.tag_name as string) ?? null;

        await chrome.storage.local.set({
          [CACHE_KEY]: { latestVersion, checkedAt: Date.now() } satisfies CachedCheck,
        });

        if (latestVersion && isNewer(latestVersion, currentVersion)) {
          setUpdateAvailable(latestVersion);
        }
      } catch {
        // Network error or rate limited — silently ignore
      }
    })();
  }, []);

  return {
    updateAvailable,
    releasesUrl: `https://github.com/${GITHUB_REPO}/releases/latest`,
  };
}
