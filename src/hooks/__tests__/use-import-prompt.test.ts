import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DEFAULT_PROFILE } from '@/lib/schema';
import { useImportPrompt } from '../use-import-prompt';

describe('useImportPrompt', () => {
  beforeEach(() => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(
      () => Promise.resolve({}) as Promise<never>,
    );
    vi.spyOn(chrome.storage.local, 'set').mockImplementation(
      () => Promise.resolve() as Promise<never>,
    );
    vi.spyOn(chrome.storage.local.onChanged, 'addListener').mockImplementation(() => {});
    vi.spyOn(chrome.storage.local.onChanged, 'removeListener').mockImplementation(() => {});
  });

  it('shows the prompt for an untouched preset that is not dismissed', async () => {
    const { result } = renderHook(() =>
      useImportPrompt({ presetId: 'p1', profile: DEFAULT_PROFILE }),
    );
    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
  });

  it('hides the prompt when paused (e.g., demo profile active)', async () => {
    const { result } = renderHook(() =>
      useImportPrompt({ presetId: 'p1', profile: DEFAULT_PROFILE, paused: true }),
    );
    await waitFor(() => {
      expect(result.current.shouldShow).toBe(false);
    });
  });

  it('hides the prompt when the profile already has data', async () => {
    const { result } = renderHook(() =>
      useImportPrompt({
        presetId: 'p1',
        profile: { ...DEFAULT_PROFILE, firstName: 'Avery', email: 'a@b.co' },
      }),
    );
    await waitFor(() => {
      expect(result.current.shouldShow).toBe(false);
    });
  });

  it('hides the prompt when persistently dismissed', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(
      () => Promise.resolve({ mira_import_dismissed_p1: true }) as Promise<never>,
    );
    const { result } = renderHook(() =>
      useImportPrompt({ presetId: 'p1', profile: DEFAULT_PROFILE }),
    );
    await waitFor(() => {
      expect(result.current.shouldShow).toBe(false);
    });
  });

  it('dismiss() writes the per-preset flag and flips visibility', async () => {
    const setSpy = vi
      .spyOn(chrome.storage.local, 'set')
      .mockImplementation(() => Promise.resolve() as Promise<never>);

    const { result } = renderHook(() =>
      useImportPrompt({ presetId: 'p1', profile: DEFAULT_PROFILE }),
    );
    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });

    await act(async () => {
      await result.current.dismiss();
    });

    expect(setSpy).toHaveBeenCalledWith({ mira_import_dismissed_p1: true });
    expect(result.current.shouldShow).toBe(false);
  });
});
