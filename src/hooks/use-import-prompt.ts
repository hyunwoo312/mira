import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '@/lib/schema';
import {
  dismissalStorageKey,
  dismissImportPrompt,
  isImportPromptDismissed,
  isPresetUntouched,
} from '@/lib/import/empty-state';

interface UseImportPromptArgs {
  presetId: string;
  profile: Profile;
  /** Skip the prompt entirely (e.g., during onboarding/demo) */
  paused?: boolean;
}

interface UseImportPromptResult {
  shouldShow: boolean;
  dismiss: () => Promise<void>;
}

/**
 * Combines profile state + per-preset dismissal flag to decide whether to
 * show the empty-state prompt. Reactive to storage changes from other tabs.
 */
export function useImportPrompt({
  presetId,
  profile,
  paused,
}: UseImportPromptArgs): UseImportPromptResult {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!presetId) return;
    let cancelled = false;
    void isImportPromptDismissed(presetId).then((value) => {
      if (!cancelled) setDismissed(value);
    });
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  useEffect(() => {
    if (!presetId) return;
    const key = dismissalStorageKey(presetId);
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (key in changes) {
        setDismissed(changes[key]!.newValue === true);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [presetId]);

  const dismiss = useCallback(async () => {
    if (!presetId) return;
    await dismissImportPrompt(presetId);
    setDismissed(true);
  }, [presetId]);

  const shouldShow = !paused && dismissed === false && !!presetId && isPresetUntouched(profile);

  return { shouldShow, dismiss };
}
