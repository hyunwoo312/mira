import { vi } from 'vitest';

const store: Record<string, unknown> = {};

export const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        if (typeof keys === 'string') return { [keys]: store[keys] };
        const result: Record<string, unknown> = {};
        for (const k of keys) result[k] = store[k];
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete store[key];
      }),
    },
  },
  runtime: {
    getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
    sendMessage: vi.fn(),
  },
  sidePanel: {
    setPanelBehavior: vi.fn(),
  },
};

export function setupChromeMock() {
  (globalThis as Record<string, unknown>).chrome = chromeMock;
}

export function clearChromeStore() {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}
