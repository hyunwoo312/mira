import type { Profile } from '@/lib/schema';

const PREFIX = 'mira_import_dismissed_';

export function dismissalStorageKey(presetId: string): string {
  return `${PREFIX}${presetId}`;
}

/**
 * A preset counts as "untouched" if the user has clearly not started filling
 * it in: no name, no email, no work, no education. We tolerate other fields
 * being set (e.g., user pasted a phone number) — the goal is to detect a
 * brand-new empty preset, not impose a strict "completely default" check.
 */
export function isPresetUntouched(profile: Profile): boolean {
  return (
    !profile.firstName.trim() &&
    !profile.lastName.trim() &&
    !profile.email.trim() &&
    profile.workExperience.length === 0 &&
    profile.education.length === 0
  );
}

export async function isImportPromptDismissed(presetId: string): Promise<boolean> {
  const key = dismissalStorageKey(presetId);
  const data = await chrome.storage.local.get(key);
  return data[key] === true;
}

export async function dismissImportPrompt(presetId: string): Promise<void> {
  await chrome.storage.local.set({ [dismissalStorageKey(presetId)]: true });
}

export async function clearImportPromptDismissal(presetId: string): Promise<void> {
  await chrome.storage.local.remove(dismissalStorageKey(presetId));
}
