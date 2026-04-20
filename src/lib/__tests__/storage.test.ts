import { describe, it, expect, beforeEach } from 'vitest';
import type { PresetStore } from '../storage';
import {
  loadPresetStore,
  getActiveProfile,
  addPreset,
  deletePreset,
  renamePreset,
} from '../storage';
import { DEFAULT_PROFILE } from '../schema';
import { clearChromeStore, chromeMock } from '@/test/chrome-mock';

describe('storage', () => {
  beforeEach(() => {
    clearChromeStore();
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
    chromeMock.storage.local.remove.mockClear();
  });

  describe('loadPresetStore', () => {
    it('returns default store when storage is empty', async () => {
      const store = await loadPresetStore();
      expect(store.presets).toHaveLength(1);
      expect(store.presets[0]!.name).toBe('Default');
      expect(store.activePresetId).toBe(store.presets[0]!.id);
    });

    it('migrates legacy mira_profile to preset store', async () => {
      const legacy = { ...DEFAULT_PROFILE, firstName: 'Jane', email: 'jane@test.com' };
      chromeMock.storage.local.get.mockResolvedValueOnce({ mira_profile: legacy });

      const store = await loadPresetStore();
      expect(store.presets).toHaveLength(1);
      expect(store.presets[0]!.name).toBe('Default');
      expect(store.presets[0]!.profile.firstName).toBe('Jane');
      // Should have removed the legacy key
      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('mira_profile');
    });

    it('loads existing preset store', async () => {
      const existing = {
        version: 1,
        activePresetId: 'abc',
        presets: [
          { id: 'abc', name: 'Work', profile: { ...DEFAULT_PROFILE, firstName: 'Work' } },
          { id: 'def', name: 'Personal', profile: { ...DEFAULT_PROFILE, firstName: 'Personal' } },
        ],
      };
      chromeMock.storage.local.get.mockResolvedValueOnce({ mira_presets: existing });

      const store = await loadPresetStore();
      expect(store.presets).toHaveLength(2);
      expect(store.activePresetId).toBe('abc');
    });
  });

  describe('getActiveProfile', () => {
    it('returns the active preset profile', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'b',
        presets: [
          { id: 'a', name: 'A', profile: { ...DEFAULT_PROFILE, firstName: 'A' } },
          { id: 'b', name: 'B', profile: { ...DEFAULT_PROFILE, firstName: 'B' } },
        ],
      };
      expect(getActiveProfile(store).firstName).toBe('B');
    });
  });

  describe('addPreset', () => {
    it('adds a new preset', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [{ id: 'a', name: 'Default', profile: DEFAULT_PROFILE }],
      };
      const updated = addPreset(store, 'Work', DEFAULT_PROFILE);
      expect(updated).not.toBeNull();
      expect(updated!.presets).toHaveLength(2);
      expect(updated!.presets[1]!.name).toBe('Work');
    });

    it('returns null at max presets', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: Array.from({ length: 5 }, (_, i) => ({
          id: String(i),
          name: `P${i}`,
          profile: DEFAULT_PROFILE,
        })),
      };
      expect(addPreset(store, 'Extra', DEFAULT_PROFILE)).toBeNull();
    });
  });

  describe('deletePreset', () => {
    it('deletes a preset', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [
          { id: 'a', name: 'A', profile: DEFAULT_PROFILE },
          { id: 'b', name: 'B', profile: DEFAULT_PROFILE },
        ],
      };
      const updated = deletePreset(store, 'b');
      expect(updated!.presets).toHaveLength(1);
    });

    it('returns null when trying to delete last preset', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [{ id: 'a', name: 'Default', profile: DEFAULT_PROFILE }],
      };
      expect(deletePreset(store, 'a')).toBeNull();
    });

    it('switches active when deleting active preset', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [
          { id: 'a', name: 'A', profile: DEFAULT_PROFILE },
          { id: 'b', name: 'B', profile: DEFAULT_PROFILE },
        ],
      };
      const updated = deletePreset(store, 'a');
      expect(updated!.activePresetId).toBe('b');
    });
  });

  describe('renamePreset', () => {
    it('renames a preset', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [{ id: 'a', name: 'Default', profile: DEFAULT_PROFILE }],
      };
      const updated = renamePreset(store, 'a', 'SWE');
      expect(updated.presets[0]!.name).toBe('SWE');
    });

    it('truncates long names', () => {
      const store: PresetStore = {
        version: 1,
        activePresetId: 'a',
        presets: [{ id: 'a', name: 'Default', profile: DEFAULT_PROFILE }],
      };
      const updated = renamePreset(store, 'a', 'A very long preset name that exceeds the max');
      expect(updated.presets[0]!.name.length).toBeLessThanOrEqual(20);
    });
  });
});
