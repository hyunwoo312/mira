import type { Profile } from './schema';
import { profileSchema, DEFAULT_PROFILE, SCHEMA_VERSION } from './schema';

const PRESETS_KEY = 'mira_presets';
const LEGACY_KEY = 'mira_profile';
const MAX_PRESETS = 5;

export interface Preset {
  id: string;
  name: string;
  profile: Profile;
}

export interface PresetStore {
  version: number;
  activePresetId: string;
  presets: Preset[];
}

function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function createDefaultStore(): PresetStore {
  const id = generateId();
  return {
    version: SCHEMA_VERSION,
    activePresetId: id,
    presets: [{ id, name: 'Default', profile: DEFAULT_PROFILE }],
  };
}

// ── Schema Migrations ──
// Each migration transforms profile data from version N to N+1.
// Zod's .safeParse() fills in new fields with defaults, so migrations
// only need to handle renames, removals, or value transforms.

type Migration = (profile: Record<string, unknown>) => Record<string, unknown>;

const DROPDOWN_STRING_TO_INDEX: Record<string, string[]> = {
  gender: ['Male', 'Female', 'Non-binary', 'Decline to self-identify'],
  transgender: ['Yes', 'No', 'Decline to self-identify'],
  sexualOrientation: [
    'Heterosexual / Straight',
    'Gay',
    'Lesbian',
    'Bisexual',
    'Queer',
    'Asexual',
    'Pansexual',
    'Prefer not to say',
    'Not listed / Other',
  ],
  race: [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Two or More Races',
    'Decline to self-identify',
  ],
  veteranStatus: [
    'I am not a protected veteran',
    'I identify as a protected veteran',
    'Decline to self-identify',
  ],
  disabilityStatus: [
    'Yes, I have a disability',
    'No, I do not have a disability',
    'Decline to self-identify',
  ],
  visaType: [
    'US Citizen',
    'Green Card / Permanent Resident',
    'H-1B',
    'L-1',
    'O-1',
    'TN',
    'E-2',
    'OPT',
    'CPT',
    'F-1',
    'Other',
  ],
  securityClearance: ['None', 'Confidential', 'Secret', 'Top Secret', 'TS/SCI'],
  noticePeriod: ['Immediately', '2 weeks', '1 month', '2 months', '3+ months'],
};

function migrateStringToIndex(value: unknown, options: string[]): number {
  if (typeof value === 'number') return value; // already migrated
  if (typeof value !== 'string' || !value) return -1;
  const lower = value.toLowerCase().trim();
  const exact = options.findIndex((o) => o.toLowerCase() === lower);
  if (exact >= 0) return exact;
  // Partial match for old values that may differ slightly
  const partial = options.findIndex(
    (o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower),
  );
  return partial >= 0 ? partial : -1;
}

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: Added twitter, willingToTravel, smsConsent, visaType, securityClearance.
  1: (p) => p,
  // v2 → v3: Added additionalLinks array. Default [] via safeParse.
  2: (p) => p,
  // v3 → v4: Added location to workExperience entries. Default '' via safeParse.
  3: (p) => p,
  // v4 → v5: EEO + preferences dropdown fields changed from strings to numeric indices.
  4: (p) => {
    const migrated = { ...p };
    for (const [field, options] of Object.entries(DROPDOWN_STRING_TO_INDEX)) {
      migrated[field] = migrateStringToIndex(p[field], options);
    }
    return migrated;
  },
  // v5 → v6: Removed lgbtq and additionalUrlLabel fields.
  5: (p) => {
    const { lgbtq: _, additionalUrlLabel: __, ...rest } = p;
    return rest;
  },
};

function migrateProfile(profile: Record<string, unknown>, fromVersion: number): Profile {
  let data = { ...profile };
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) data = migrate(data);
  }
  return profileSchema.safeParse(data).data ?? DEFAULT_PROFILE;
}

/** Load presets, migrating from legacy single-profile storage if needed. */
export async function loadPresetStore(): Promise<PresetStore> {
  try {
    const result = await chrome.storage.local.get([PRESETS_KEY, LEGACY_KEY]);

    if (result[PRESETS_KEY]) {
      const raw = result[PRESETS_KEY] as PresetStore & { version?: number };
      const storedVersion = raw.version ?? 1;

      // Validate and migrate each preset's profile
      const needsMigration = storedVersion < SCHEMA_VERSION;
      raw.presets = raw.presets.map((p) => ({
        ...p,
        profile: needsMigration
          ? migrateProfile(p.profile as unknown as Record<string, unknown>, storedVersion)
          : (profileSchema.safeParse(p.profile).data ?? DEFAULT_PROFILE),
      }));
      raw.version = SCHEMA_VERSION;

      if (raw.presets.length === 0) return createDefaultStore();
      if (!raw.presets.find((p) => p.id === raw.activePresetId)) {
        raw.activePresetId = raw.presets[0]!.id;
      }

      // Persist migrated data
      if (needsMigration) {
        await chrome.storage.local.set({ [PRESETS_KEY]: raw });
      }
      return raw;
    }

    // Migrate from legacy single profile (pre-preset era, treat as v1)
    if (result[LEGACY_KEY]) {
      const profile = migrateProfile(result[LEGACY_KEY] as Record<string, unknown>, 1);
      const id = generateId();
      const store: PresetStore = {
        version: SCHEMA_VERSION,
        activePresetId: id,
        presets: [{ id, name: 'Default', profile }],
      };
      await chrome.storage.local.set({ [PRESETS_KEY]: store });
      await chrome.storage.local.remove(LEGACY_KEY);
      return store;
    }

    return createDefaultStore();
  } catch {
    return createDefaultStore();
  }
}

/** Save the entire preset store. */
export async function savePresetStore(store: PresetStore): Promise<void> {
  await chrome.storage.local.set({ [PRESETS_KEY]: store });
}

/** Save just the active preset's profile. */
export async function saveActiveProfile(
  store: PresetStore,
  profile: Profile,
): Promise<PresetStore> {
  const updated: PresetStore = {
    ...store,
    presets: store.presets.map((p) => (p.id === store.activePresetId ? { ...p, profile } : p)),
  };
  await savePresetStore(updated);
  return updated;
}

/** Add a new preset (copies the given profile). Returns null if at max. */
export function addPreset(store: PresetStore, name: string, profile: Profile): PresetStore | null {
  if (store.presets.length >= MAX_PRESETS) return null;
  const id = generateId();
  return {
    version: store.version,
    activePresetId: id,
    presets: [...store.presets, { id, name, profile }],
  };
}

/** Delete a preset. Can't delete the last one. */
export function deletePreset(store: PresetStore, presetId: string): PresetStore | null {
  if (store.presets.length <= 1) return null;
  const remaining = store.presets.filter((p) => p.id !== presetId);
  return {
    version: store.version,
    activePresetId: store.activePresetId === presetId ? remaining[0]!.id : store.activePresetId,
    presets: remaining,
  };
}

/** Rename a preset. */
export function renamePreset(store: PresetStore, presetId: string, name: string): PresetStore {
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === presetId ? { ...p, name: name.slice(0, 20) } : p)),
  };
}

/** Get the active preset's profile. */
export function getActiveProfile(store: PresetStore): Profile {
  const preset = store.presets.find((p) => p.id === store.activePresetId);
  return preset?.profile ?? DEFAULT_PROFILE;
}

/** Clear all extension data from storage. */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

// Legacy exports for backward compatibility during migration
export async function loadProfile(): Promise<Profile> {
  const store = await loadPresetStore();
  return getActiveProfile(store);
}

export async function saveProfile(profile: Profile): Promise<void> {
  const store = await loadPresetStore();
  await saveActiveProfile(store, profile);
}
