import { useEffect, useCallback, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, DEFAULT_PROFILE, SCHEMA_VERSION, type Profile } from '@/lib/schema';
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

export function useProfile() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [store, setStore] = useState<PresetStore | null>(null);
  const [lastSaved, setLastSaved] = useState<number>(0);

  const form = useForm<Profile>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(profileSchema) as any,
    defaultValues: DEFAULT_PROFILE,
    mode: 'onChange',
  });

  // Load presets on mount
  useEffect(() => {
    loadPresetStore().then((loaded) => {
      setStore(loaded);
      const profile = getActiveProfile(loaded);
      form.reset(profile);
      setIsLoaded(true);
    });
  }, [form]);

  // Auto-save: debounced save on any form change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isLoaded || !store) return;
    // eslint-disable-next-line react-hooks/incompatible-library -- watch() subscription is intentional for auto-save; stale memoization is not a concern here
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
    const blob = new Blob([JSON.stringify(currentStore, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mira-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Import profile data from a JSON file
  const importData = useCallback(
    async (file: File) => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Invalid file: not valid JSON');
      }

      // Validate imported data has the PresetStore shape
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('activePresetId' in parsed) ||
        !('presets' in parsed) ||
        !Array.isArray((parsed as PresetStore).presets) ||
        (parsed as PresetStore).presets.length === 0
      ) {
        throw new Error('Invalid profile data: missing required fields');
      }

      const imported = parsed as PresetStore;

      // Validate each preset has required fields and a valid profile
      for (const preset of imported.presets) {
        if (typeof preset.id !== 'string' || typeof preset.name !== 'string') {
          throw new Error('Invalid profile data: preset missing id or name');
        }
        const result = profileSchema.safeParse(preset.profile);
        if (!result.success) {
          throw new Error(`Invalid profile data in preset "${preset.name}"`);
        }
        preset.profile = result.data;
      }

      // Ensure activePresetId points to an existing preset
      if (!imported.presets.find((p) => p.id === imported.activePresetId)) {
        imported.activePresetId = imported.presets[0]!.id;
      }

      // Stamp with current schema version
      imported.version = SCHEMA_VERSION;

      await savePresetStore(imported);
      setStore(imported);
      const profile = getActiveProfile(imported);
      form.reset(profile);
    },
    [form],
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
    switchPreset,
    addNewPreset,
    removePreset,
    rename,
    exportAllData,
    importData,
    deleteAllData,
  };
}
