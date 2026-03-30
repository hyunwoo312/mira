import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'mira_theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY] as Theme | undefined;
      if (saved === 'dark') {
        setThemeState('dark');
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    chrome.storage.local.set({ [STORAGE_KEY]: t });
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
