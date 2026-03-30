import { useState, useCallback, useEffect } from 'react';
import type { Profile } from '@/lib/schema';
import { profileToFillMap } from '@/lib/autofill/profile-map';
import { loadFiles } from '@/lib/file-storage';

export interface FillLogItem {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'heuristic' | 'options' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
}

interface FillState {
  isLoading: boolean;
  result: {
    filled: number;
    failed: number;
    skipped: number;
    total: number;
    durationMs?: number;
    mlAvailable?: boolean;
  } | null;
  logs: FillLogItem[];
  pageUrl: string;
  error: string | null;
}

export function useFill() {
  const [state, setState] = useState<FillState>({
    isLoading: false,
    result: null,
    logs: [],
    pageUrl: '',
    error: null,
  });

  const fill = useCallback(async (profile: Profile) => {
    setState({ isLoading: true, result: null, logs: [], pageUrl: '', error: null });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setState({
          isLoading: false,
          result: { filled: 0, failed: 0, skipped: 0, total: 0 },
          logs: [],
          pageUrl: '',
          error: null,
        });
        return;
      }

      const tabId = tab.id;

      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: 0 });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ['content-scripts/content.js'],
        });
        await new Promise((r) => setTimeout(r, 200));
      }

      const fillMap = profileToFillMap(profile);

      const files = await loadFiles();
      const activeResume = files.find((f) => f.category === 'resume' && f.isActive);
      const activeCoverLetter = files.find((f) => f.category === 'cover_letter' && f.isActive);
      if (activeResume) {
        fillMap.resume = JSON.stringify({
          name: activeResume.name,
          type: activeResume.type,
          data: activeResume.data,
        });
      }
      if (activeCoverLetter) {
        fillMap.coverLetter = JSON.stringify({
          name: activeCoverLetter.name,
          type: activeCoverLetter.type,
          data: activeCoverLetter.data,
        });
      }

      const answerBank = (profile.answerBank ?? []).filter((a) => a.question && a.answer);
      const fillMessage = { type: 'FILL', fillMap, answerBank };

      const response = await chrome.tabs
        .sendMessage(tabId, fillMessage, { frameId: 0 })
        .catch(() => ({ result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [] } }));

      const res = response?.result ?? { filled: 0, failed: 0, skipped: 0, total: 0, logs: [] };

      setState({
        isLoading: false,
        result: {
          filled: res.filled,
          failed: res.failed ?? 0,
          skipped: res.skipped ?? 0,
          total: res.total,
          durationMs: res.durationMs,
          mlAvailable: res.mlAvailable,
        },
        logs: res.logs ?? [],
        pageUrl: tab.url ?? '',
        error: null,
      });
    } catch (err) {
      setState({
        isLoading: false,
        result: null,
        logs: [],
        pageUrl: '',
        error: err instanceof Error ? err.message : 'Fill failed unexpectedly',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, logs: [], pageUrl: '', error: null });
  }, []);

  useEffect(() => {
    const handleTabChange = () => {
      setState((prev) =>
        prev.result ? { isLoading: false, result: null, logs: [], pageUrl: '', error: null } : prev,
      );
    };
    const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (changeInfo.url) handleTabChange();
    };
    chrome.tabs.onActivated.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, []);

  return { ...state, fill, reset };
}
