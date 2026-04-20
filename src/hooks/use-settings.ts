import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULTS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  resetSettings,
  type Settings,
} from '@/lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((s) => {
      if (!cancelled) {
        setSettings(s);
        setLoaded(true);
      }
    });

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const next = changes[SETTINGS_KEY].newValue;
      if (next && typeof next === 'object') {
        setSettings({ ...DEFAULTS, ...(next as Partial<Settings>) });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    const next = await resetSettings();
    setSettings(next);
    return next;
  }, []);

  return { settings, loaded, update, reset };
}
