export const SETTINGS_KEY = 'mira_settings';

export type OverlayDismissMs = 4000 | 8000 | 15000 | null;

export interface Settings {
  hideOverlay: boolean;
  overlayDismissMs: OverlayDismissMs;
  skipEeo: boolean;
  skipSalary: boolean;
  saveApplications: boolean;
  mlDisabled: boolean;
  verboseLogging: boolean;
}

export const DEFAULTS: Settings = {
  hideOverlay: false,
  overlayDismissMs: 8000,
  skipEeo: false,
  skipSalary: false,
  saveApplications: true,
  mlDisabled: false,
  verboseLogging: false,
};

function pick(raw: Partial<Settings>): Settings {
  // `null` is a valid value for overlayDismissMs ("never"), so don't fall
  // back on nullish — only fall back when the key is actually missing.
  const dismiss = 'overlayDismissMs' in raw ? raw.overlayDismissMs! : DEFAULTS.overlayDismissMs;
  return {
    hideOverlay: raw.hideOverlay ?? DEFAULTS.hideOverlay,
    overlayDismissMs: dismiss,
    skipEeo: raw.skipEeo ?? DEFAULTS.skipEeo,
    skipSalary: raw.skipSalary ?? DEFAULTS.skipSalary,
    saveApplications: raw.saveApplications ?? DEFAULTS.saveApplications,
    mlDisabled: raw.mlDisabled ?? DEFAULTS.mlDisabled,
    verboseLogging: raw.verboseLogging ?? DEFAULTS.verboseLogging,
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const raw = stored[SETTINGS_KEY];
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    return pick(raw as Partial<Settings>);
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = pick({ ...current, ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function resetSettings(): Promise<Settings> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULTS });
  return { ...DEFAULTS };
}
