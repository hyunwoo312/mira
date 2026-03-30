import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveFeedback, loadFeedback, clearFeedback, type FeedbackEntry } from '../feedback';

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

describe('saveFeedback', () => {
  it('saves an entry that can be loaded back', async () => {
    const entry = makeEntry();
    await saveFeedback(entry);

    const result = await loadFeedback();
    expect(result).toEqual([entry]);
  });

  it('appends to existing entries', async () => {
    const first = makeEntry({ fieldLabel: 'First Name' });
    const second = makeEntry({ fieldLabel: 'Last Name' });

    await saveFeedback(first);
    await saveFeedback(second);

    const result = await loadFeedback();
    expect(result).toEqual([first, second]);
  });

  it('respects 200 entry limit and trims oldest', async () => {
    const existing = Array.from({ length: 200 }, (_, i) => makeEntry({ fieldLabel: `Field ${i}` }));
    store['mira_fill_feedback'] = existing;

    const newest = makeEntry({ fieldLabel: 'Field 200' });
    await saveFeedback(newest);

    const result = await loadFeedback();
    expect(result).toHaveLength(200);
    expect(result[0]!.fieldLabel).toBe('Field 1');
    expect(result[199]!.fieldLabel).toBe('Field 200');
  });

  it('handles empty/missing storage gracefully', async () => {
    store['mira_fill_feedback'] = undefined;

    const entry = makeEntry();
    await saveFeedback(entry);

    const result = await loadFeedback();
    expect(result).toEqual([entry]);
  });

  it('silently handles storage errors', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Storage quota exceeded'),
    );

    await expect(saveFeedback(makeEntry())).resolves.toBeUndefined();
  });
});

describe('loadFeedback', () => {
  it('returns empty array when no feedback exists', async () => {
    const result = await loadFeedback();
    expect(result).toEqual([]);
  });

  it('returns stored entries', async () => {
    const entries = [makeEntry({ fieldLabel: 'Name' }), makeEntry({ fieldLabel: 'Phone' })];
    store['mira_fill_feedback'] = entries;

    const result = await loadFeedback();
    expect(result).toEqual(entries);
  });
});

describe('clearFeedback', () => {
  it('removes all entries', async () => {
    store['mira_fill_feedback'] = [makeEntry()];

    await clearFeedback();

    const result = await loadFeedback();
    expect(result).toEqual([]);
  });
});
