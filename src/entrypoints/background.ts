/**
 * Service worker: manages side panel behavior, offscreen document
 * lifecycle, and message routing for ML inference.
 */

import type { ModelStatus } from '@/lib/ml/types';
import { logger } from '@/lib/logger';

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  let offscreenReady = false;
  let mlStatus: ModelStatus = 'idle';
  let sidePanelPort: chrome.runtime.Port | null = null;

  async function ensureOffscreen(): Promise<void> {
    if (offscreenReady) return;

    // Check if offscreen document already exists
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    if (contexts.length > 0) {
      offscreenReady = true;
      return;
    }

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'ML model inference for field classification',
    });
    offscreenReady = true;

    // Wait for offscreen JS to initialize, then load the model with retries.
    // chrome.offscreen.createDocument resolves when HTML loads, but the JS
    // listener may not be registered yet — delay before first attempt.
    const loadModel = (attempt = 0) => {
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOAD_MODEL' }).catch(() => {
        if (attempt < 5) {
          setTimeout(() => loadModel(attempt + 1), 1000);
        } else {
          logger.error('Model failed to load after 5 attempts', 'background');
        }
      });
    };
    setTimeout(() => loadModel(), 1000);
  }

  async function destroyOffscreen(): Promise<void> {
    if (!offscreenReady) return;
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // Already closed
    }
    offscreenReady = false;
    mlStatus = 'idle';
  }

  let destroyTimer: ReturnType<typeof setTimeout> | null = null;

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sidepanel') return;

    sidePanelPort = port;

    // Cancel pending destroy if sidepanel reopened quickly
    if (destroyTimer) {
      clearTimeout(destroyTimer);
      destroyTimer = null;
    }

    ensureOffscreen();

    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
      // Delay destroy so quick close-and-reopen doesn't trigger full reload
      destroyTimer = setTimeout(() => {
        destroyTimer = null;
        destroyOffscreen();
      }, 10_000);
    });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ML_STATUS') {
      mlStatus = message.status as ModelStatus;
      sidePanelPort?.postMessage(message);
      return false;
    }

    if (message.type === 'ML_CLASSIFY') {
      (async () => {
        try {
          await ensureOffscreen();
          const response = await chrome.runtime.sendMessage({
            type: 'OFFSCREEN_CLASSIFY',
            requestId: crypto.randomUUID(),
            fields: message.fields,
          });
          sendResponse(response ?? { classifications: [], error: 'No response from offscreen' });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          sendResponse({ classifications: [], error: msg });
        }
      })();
      return true;
    }

    if (message.type === 'ML_MATCH_ANSWERS') {
      (async () => {
        try {
          await ensureOffscreen();
          const response = await chrome.runtime.sendMessage({
            type: 'OFFSCREEN_MATCH_ANSWERS',
            requestId: crypto.randomUUID(),
            fieldLabels: message.fieldLabels,
            questions: message.questions,
          });
          sendResponse(response ?? { matches: [], error: 'No response' });
        } catch (err: unknown) {
          sendResponse({
            matches: [],
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();
      return true;
    }

    if (message.type === 'ML_GET_STATUS') {
      sendResponse({ status: mlStatus });
      return true;
    }

    return false;
  });
});
