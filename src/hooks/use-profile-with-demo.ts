import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from './use-profile';
import { useActiveTabUrl } from './use-active-tab-url';
import { isOnboardingUrl } from '@/lib/onboarding';
import { DEMO_PROFILE } from '@/lib/onboarding/demo-profile';
import type { Preset } from '@/lib/storage';

export const DEMO_PRESET_ID = '__mira_demo__';
export const DEMO_PRESET_NAME = 'Demo (Onboarding)';

const DEMO_PRESET: Preset = {
  id: DEMO_PRESET_ID,
  name: DEMO_PRESET_NAME,
  profile: DEMO_PROFILE,
};

/**
 * Wraps `useProfile` with onboarding-tab-aware demo preset injection.
 * - On the onboarding tab, a synthetic Demo preset appears in the list and
 *   is selected by default. The user can switch to any real preset; demo
 *   data is never persisted.
 * - Off the onboarding tab, the demo preset is hidden and the user's real
 *   active preset is used.
 */
export function useProfileWithDemo() {
  const url = useActiveTabUrl();
  const isOnboardingTab = isOnboardingUrl(url);

  // Tracks which preset the user has explicitly selected during this
  // onboarding-tab session; null means "use demo by default".
  const [demoSessionActiveId, setDemoSessionActiveId] = useState<string | null>(null);

  const isDemoActive =
    isOnboardingTab && (demoSessionActiveId === null || demoSessionActiveId === DEMO_PRESET_ID);

  const real = useProfile({ paused: isDemoActive });

  // Reset the form on actual demo↔real transitions only; useProfile owns
  // form-resetting for normal preset switches.
  const wasDemoActiveRef = useRef(isDemoActive);
  useEffect(() => {
    if (!real.isLoaded) return;
    const wasDemoActive = wasDemoActiveRef.current;
    wasDemoActiveRef.current = isDemoActive;
    if (wasDemoActive === isDemoActive) return;
    if (isDemoActive) {
      real.form.reset(DEMO_PROFILE);
    } else {
      const stored = real.presets.find((p) => p.id === real.activePresetId);
      if (stored) real.form.reset(stored.profile);
    }
  }, [isDemoActive, real.isLoaded, real.form, real.presets, real.activePresetId]);

  const presets: Preset[] = isOnboardingTab ? [DEMO_PRESET, ...real.presets] : real.presets;

  const activePresetId = isDemoActive
    ? DEMO_PRESET_ID
    : (demoSessionActiveId ?? real.activePresetId);

  const switchPreset = useCallback(
    async (presetId: string) => {
      if (!isOnboardingTab) {
        await real.switchPreset(presetId);
        return;
      }
      if (presetId === DEMO_PRESET_ID) {
        setDemoSessionActiveId(DEMO_PRESET_ID);
        real.form.reset(DEMO_PROFILE);
        return;
      }
      // Switching to a real preset on the onboarding tab — pause stays off
      // (since active is no longer demo) and we delegate to real.switchPreset.
      setDemoSessionActiveId(presetId);
      await real.switchPreset(presetId);
    },
    [isOnboardingTab, real],
  );

  const removePreset = useCallback(
    async (presetId: string) => {
      if (presetId === DEMO_PRESET_ID) return false;
      return real.removePreset(presetId);
    },
    [real],
  );

  const rename = useCallback(
    async (presetId: string, name: string) => {
      if (presetId === DEMO_PRESET_ID) return;
      return real.rename(presetId, name);
    },
    [real],
  );

  return {
    ...real,
    presets,
    activePresetId,
    switchPreset,
    removePreset,
    rename,
    isDemoActive,
  };
}
