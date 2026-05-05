import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveFeedback, type FeedbackEntry } from '../feedback';

const STORAGE_KEY = 'mira_fill_feedback';
let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn().mockImplementation(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
          Object.assign(store, data);
        }),
        remove: vi.fn().mockImplementation(async (key: string) => {
          delete store[key];
        }),
      },
    },
  } as unknown as typeof chrome;
});

function makeEntry(overrides?: Partial<FeedbackEntry>): FeedbackEntry {
  return {
    fieldLabel: 'Email',
    status: 'filled',
    filledCategory: 'email',
    pageUrl: 'https://example.com/apply',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function readStored(): FeedbackEntry[] {
  return Array.isArray(store[STORAGE_KEY]) ? (store[STORAGE_KEY] as FeedbackEntry[]) : [];
}

describe('saveFeedback', () => {
  it('saves an entry to chrome storage', async () => {
    const entry = makeEntry();
    await saveFeedback(entry);
    expect(readStored()).toEqual([entry]);
  });

  it('appends to existing entries', async () => {
    const first = makeEntry({ fieldLabel: 'First Name' });
    const second = makeEntry({ fieldLabel: 'Last Name' });

    await saveFeedback(first);
    await saveFeedback(second);

    expect(readStored()).toEqual([first, second]);
  });

  it('respects 200 entry limit and trims oldest', async () => {
    const existing = Array.from({ length: 200 }, (_, i) => makeEntry({ fieldLabel: `Field ${i}` }));
    store[STORAGE_KEY] = existing;

    const newest = makeEntry({ fieldLabel: 'Field 200' });
    await saveFeedback(newest);

    const result = readStored();
    expect(result).toHaveLength(200);
    expect(result[0]!.fieldLabel).toBe('Field 1');
    expect(result[199]!.fieldLabel).toBe('Field 200');
  });

  it('handles empty/missing storage gracefully', async () => {
    store[STORAGE_KEY] = undefined;

    const entry = makeEntry();
    await saveFeedback(entry);

    expect(readStored()).toEqual([entry]);
  });

  it('silently handles storage errors', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Storage quota exceeded'),
    );

    await expect(saveFeedback(makeEntry())).resolves.toBeUndefined();
  });
});
