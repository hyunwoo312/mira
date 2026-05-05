export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'mira_theme';

/** Apply the saved theme class on `<html>` before React paints. */
export function applyStoredTheme(): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.get(THEME_STORAGE_KEY).then((result) => {
    const saved = result[THEME_STORAGE_KEY] as Theme | undefined;
    document.documentElement.classList.toggle('dark', saved === 'dark');
  });
}
