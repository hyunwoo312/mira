import { useState, useCallback, useEffect, useRef } from 'react';

export interface FillLogItem {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'static-map' | 'heuristic' | 'options' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
  widgetType?: string;
  category?: string;
  sectionHeading?: string;
  groupLabels?: string[];
  elementHint?: string;
  skipReason?: string;
  failReason?: string;
  attemptedValue?: string;
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
    ats?: string;
    totalFormElements?: number;
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

  // Port for push notifications from background. Reconnects with backoff
  // so shortcut/context fills still reach the sidepanel after SW restarts.
  const portRef = useRef<chrome.runtime.Port | null>(null);
  useEffect(() => {
    let disposed = false;

    const handleMessage = (message: {
      type: string;
      result?: FillState['result'];
      logs?: unknown[];
      pageUrl?: string;
      error?: string | null;
    }) => {
      if (message.type === 'FILL_STARTED') {
        setState({ isLoading: true, result: null, logs: [], pageUrl: '', error: null });
      }
      if (message.type === 'FILL_RESULT') {
        setState({
          isLoading: false,
          result: message.result ?? null,
          logs: (message.logs as FillLogItem[]) ?? [],
          pageUrl: message.pageUrl ?? '',
          error: message.error ?? null,
        });
      }
    };

    let retryDelayMs = 500;
    const MAX_DELAY_MS = 30_000;

    const connect = () => {
      if (disposed) return;
      const port = chrome.runtime.connect({ name: 'sidepanel' });
      portRef.current = port;
      port.onMessage.addListener((msg) => {
        retryDelayMs = 500;
        handleMessage(msg);
      });
      port.onDisconnect.addListener(() => {
        portRef.current = null;
        if (disposed) return;
        setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_DELAY_MS);
      });
    };

    connect();

    return () => {
      disposed = true;
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, []);

  const fill = useCallback(async () => {
    setState({ isLoading: true, result: null, logs: [], pageUrl: '', error: null });
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_FILL' });
      setState({
        isLoading: false,
        result: response?.result ?? null,
        logs: (response?.logs as FillLogItem[]) ?? [],
        pageUrl: response?.pageUrl ?? '',
        error: response?.error ?? null,
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

  // Reset on tab change or URL change
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
