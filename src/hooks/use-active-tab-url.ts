import { useEffect, useState } from 'react';

/** Track the URL of the active tab in the current window. Updates on tab switch and URL change. */
export function useActiveTabUrl(): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const refresh = () => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => setUrl(tab?.url));
    };
    refresh();

    const handleActivated = () => refresh();
    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      _tabId,
      changeInfo,
      tab,
    ) => {
      if (!tab.active) return;
      if (changeInfo.url || changeInfo.status === 'complete') refresh();
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  return url;
}
