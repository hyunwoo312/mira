import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadApplications,
  saveApplication,
  updateApplicationStatus,
  type ApplicationEntry,
} from '../application-store';

const STORAGE_KEY = 'mira_applications';
let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (data: Record<string, unknown>) => {
          Object.assign(store, data);
        }),
      },
    },
  });
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'app-1'),
  });
});

function makeEntry(overrides?: Partial<ApplicationEntry>): ApplicationEntry {
  return {
    id: 'existing',
    url: 'https://jobs.example.com/apply/1',
    company: 'Example',
    role: 'Engineer',
    location: 'Remote',
    ats: 'greenhouse',
    status: 'applied',
    timestamp: 1_700_000_000_000,
    filled: 4,
    failed: 1,
    skipped: 2,
    total: 7,
    durationMs: 1200,
    ...overrides,
  };
}

describe('application-store status', () => {
  it('defaults legacy entries to applied when loading', async () => {
    const { status: _status, ...legacy } = makeEntry();
    store[STORAGE_KEY] = [legacy];

    await expect(loadApplications()).resolves.toEqual([makeEntry()]);
  });

  it('saves new applications with applied status', async () => {
    const { id: _id, status: _status, ...entry } = makeEntry();

    await saveApplication(entry);

    expect(store[STORAGE_KEY]).toEqual([{ id: 'app-1', status: 'applied', ...entry }]);
  });

  it('updates application status without changing fill stats', async () => {
    store[STORAGE_KEY] = [makeEntry()];

    await updateApplicationStatus('existing', 'interviewing');

    expect(store[STORAGE_KEY]).toEqual([makeEntry({ status: 'interviewing' })]);
  });
});
