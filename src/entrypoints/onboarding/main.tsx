import React from 'react';
import ReactDOM from 'react-dom/client';
import { Onboarding } from '@/components/onboarding/onboarding';
import { applyStoredTheme } from '@/lib/theme';
import { initBridge } from '@/lib/autofill/bridge';
import { installPageBridge } from '@/entrypoints/page-script.content';
import type { FillOverlay } from '@/lib/overlay/fill-overlay';
import '../../assets/main.css';

applyStoredTheme();

// Content scripts don't inject on chrome-extension:// URLs, so install the
// page-side bridge handler directly. The onboarding page is its own world,
// so isolated/main bridging collapses into one — the postMessage protocol
// still works because both sides live in this window.
installPageBridge();
initBridge();

// Mirror the host-page overlay handler so the onboarding tab gets the same
// fill-progress + result UI when triggered from the side panel.
let overlay: FillOverlay | null = null;
async function getOverlay(): Promise<FillOverlay | null> {
  if (!overlay) {
    const mod = await import('@/lib/overlay/fill-overlay');
    overlay = new mod.FillOverlay();
  }
  return overlay;
}
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FILL_OVERLAY_SHOW') {
    void getOverlay().then((o) => o?.show(message.phase));
  } else if (message?.type === 'FILL_OVERLAY_RESULT') {
    if (message.result && Array.isArray(message.logs)) {
      void getOverlay().then((o) => o?.showResult(message.result, message.logs));
    }
  } else if (message?.type === 'FILL_OVERLAY_DISMISS') {
    overlay?.dismiss();
  }
  return false;
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Onboarding />
  </React.StrictMode>,
);
