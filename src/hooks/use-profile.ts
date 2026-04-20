import { useEffect, useCallback, useState, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, DEFAULT_PROFILE, type Profile } from '@/lib/schema';
import { DROPDOWN_FIELDS, findIndex } from '@/lib/field-options';
import {
  loadPresetStore,
  savePresetStore,
  saveActiveProfile,
  getActiveProfile,
  addPreset,
  deletePreset,
  renamePreset,
  clearAllData,
  type PresetStore,
  type Preset,
} from '@/lib/storage';
import { saveSettings } from '@/lib/settings';

const MIGRATIONS_KEY = 'mira_migrations';

async function migrateLegacySkipEeo(store: PresetStore): Promise<void> {
  const r = await chrome.storage.local.get(MIGRATIONS_KEY);
  const done = (r[MIGRATIONS_KEY] as Record<string, boolean> | undefined) ?? {};
  if (done.skipEeoConsolidation) return;

  const hasLegacy = store.presets.some((p) => p.profile?.skipEeo === true);
  if (hasLegacy) await saveSettings({ skipEeo: true });

  await chrome.storage.local.set({
    [MIGRATIONS_KEY]: { ...done, skipEeoConsolidation: true },
  });
}

export function useProfile() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [store, setStore] = useState<PresetStore | null>(null);
  const [lastSaved, setLastSaved] = useState<number>(0);

  const form = useForm<Profile>({
    // zodResolver infers the schema's input type (pre-default); useForm wants
    // the output type (post-default). `unknown` cast bridges the two cleanly.
    resolver: zodResolver(profileSchema) as unknown as Resolver<Profile>,
    defaultValues: DEFAULT_PROFILE,
    mode: 'onChange',
  });

  // Load presets on mount
  useEffect(() => {
    loadPresetStore().then(async (loaded) => {
      setStore(loaded);
      const profile = getActiveProfile(loaded);
      form.reset(profile);
      setIsLoaded(true);
      migrateLegacySkipEeo(loaded).catch((err) => {
        console.warn('[mira] skipEeo migration failed:', err);
      });
    });
  }, [form]);

  // Auto-save: debounced save on any form change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isLoaded || !store) return;

    const sub = form.watch(() => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        const parsed = profileSchema.safeParse(form.getValues());
        if (parsed.success) {
          saveActiveProfile(store, parsed.data).then((updated) => {
            setStore(updated);
            setLastSaved(Date.now());
          });
        }
      }, 800);
    });
    return () => {
      sub.unsubscribe();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isLoaded, store, form]);

  // Flush current form values to storage immediately (cancels debounce)
  const saveNow = useCallback(async () => {
    if (!store) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    const parsed = profileSchema.safeParse(form.getValues());
    if (parsed.success) {
      const updated = await saveActiveProfile(store, parsed.data);
      setStore(updated);
      setLastSaved(Date.now());
    }
  }, [store, form]);

  // Switch active preset
  const switchPreset = useCallback(
    async (presetId: string) => {
      if (!store) return;
      const updated: PresetStore = { ...store, activePresetId: presetId };
      await savePresetStore(updated);
      setStore(updated);
      const profile = getActiveProfile(updated);
      form.reset(profile);
    },
    [store, form],
  );

  // Add a new preset — carries over personal section only, defaults for rest
  const addNewPreset = useCallback(
    async (name: string) => {
      if (!store) return false;
      const current = form.getValues();
      const newProfile: Profile = {
        ...DEFAULT_PROFILE,
        // Carry over personal section
        firstName: current.firstName,
        lastName: current.lastName,
        preferredName: current.preferredName,
        pronouns: current.pronouns,
        email: current.email,
        phone: current.phone,
        address1: current.address1,
        address2: current.address2,
        city: current.city,
        state: current.state,
        zipCode: current.zipCode,
        country: current.country,
        dateOfBirth: current.dateOfBirth,
      };
      const updated = addPreset(store, name, newProfile);
      if (!updated) return false; // at max
      await savePresetStore(updated);
      // Initialize empty file storage for the new preset so it doesn't inherit legacy files
      const newId = updated.presets.find(
        (p) => p.name === name && p.id !== store.activePresetId,
      )?.id;
      if (newId) {
        const { saveFiles } = await import('@/lib/file-storage');
        await saveFiles([], newId);
      }
      setStore(updated);
      const profile = getActiveProfile(updated);
      form.reset(profile);
      return true;
    },
    [store, form],
  );

  // Delete a preset
  const removePreset = useCallback(
    async (presetId: string) => {
      if (!store) return false;
      const updated = deletePreset(store, presetId);
      if (!updated) return false; // can't delete last
      await savePresetStore(updated);
      setStore(updated);
      // If we deleted the active one, load the new active
      if (store.activePresetId === presetId) {
        const profile = getActiveProfile(updated);
        form.reset(profile);
      }
      return true;
    },
    [store, form],
  );

  // Rename a preset
  const rename = useCallback(
    async (presetId: string, name: string) => {
      if (!store) return;
      const updated = renamePreset(store, presetId, name);
      await savePresetStore(updated);
      setStore(updated);
    },
    [store],
  );

  // Export all profile data as a JSON file download
  const exportAllData = useCallback(async () => {
    const currentStore = await loadPresetStore();
    const activeProfile = getActiveProfile(currentStore);
    const presetName =
      currentStore.presets.find((p) => p.id === currentStore.activePresetId)?.name ?? 'profile';
    const safeName = presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mira-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Import profile data from a JSON file into the current preset.
  // Supports two formats:
  //   1. Full PresetStore (legacy export) — imports the first preset's profile
  //   2. Plain Profile object — imports directly
  const importData = useCallback(
    async (file: File) => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Invalid file: not valid JSON');
      }

      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid profile data');
      }

      let importedProfile: Profile;

      // Format 1: Full PresetStore (has presets array)
      if ('presets' in parsed && Array.isArray((parsed as PresetStore).presets)) {
        const presets = (parsed as PresetStore).presets;
        if (presets.length === 0) throw new Error('No presets found in file');

        // Use the active preset's profile, or the first one
        const activeId = (parsed as PresetStore).activePresetId;
        const target = presets.find((p) => p.id === activeId) ?? presets[0]!;
        // Migrate old string-based dropdown values to numeric indices
        const raw = target.profile as Record<string, unknown>;
        for (const [field, options] of Object.entries(DROPDOWN_FIELDS)) {
          if (field in raw && typeof raw[field] === 'string') {
            raw[field] = findIndex(options, raw[field] as string);
          }
        }
        const result = profileSchema.safeParse(raw);
        if (!result.success) throw new Error('Invalid profile data in imported file');
        importedProfile = result.data;
      }
      // Format 2: Plain profile object
      else {
        // Migrate old string-based dropdown values to numeric indices
        const raw = parsed as Record<string, unknown>;
        for (const [field, options] of Object.entries(DROPDOWN_FIELDS)) {
          if (field in raw && typeof raw[field] === 'string') {
            raw[field] = findIndex(options, raw[field] as string);
          }
        }
        const result = profileSchema.safeParse(raw);
        if (!result.success) throw new Error('Invalid profile data');
        importedProfile = result.data;
      }

      // Replace only the current preset's profile
      if (!store) return;
      const updated: PresetStore = {
        ...store,
        presets: store.presets.map((p) =>
          p.id === store.activePresetId ? { ...p, profile: importedProfile } : p,
        ),
      };

      await savePresetStore(updated);
      setStore(updated);
      form.reset(importedProfile);
    },
    [form, store],
  );

  // Delete all extension data and re-initialize with defaults
  const deleteAllData = useCallback(async () => {
    await clearAllData();
    const freshStore = await loadPresetStore(); // returns default store
    setStore(freshStore);
    const profile = getActiveProfile(freshStore);
    form.reset(profile);
  }, [form]);

  const presets: Preset[] = store?.presets ?? [];
  const activePresetId = store?.activePresetId ?? '';

  return {
    form,
    isLoaded,
    lastSaved,
    presets,
    activePresetId,
    saveNow,
    switchPreset,
    addNewPreset,
    removePreset,
    rename,
    exportAllData,
    importData,
    deleteAllData,
  };
}
