import { fillPage } from '@/lib/autofill/pipeline';
import { logger } from '@/lib/logger';
import { initBridge } from '@/lib/autofill/bridge';
import { detectATS } from '@/lib/autofill/scanners/index';
import { prepareAndFillWorkdayExperience } from '@/lib/autofill/workday/experience';
import type { FillOverlay } from '@/lib/overlay/fill-overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  registration: 'runtime',
  main() {
    // Prevent duplicate listeners if script is re-injected
    if ((window as unknown as Record<string, unknown>).__miraContentLoaded) return;
    (window as unknown as Record<string, unknown>).__miraContentLoaded = true;

    initBridge();

    let fillController: AbortController | null = null;
    window.addEventListener('beforeunload', () => {
      fillController?.abort();
    });

    // Overlay — lazy-loaded, top frame only
    let overlay: FillOverlay | null = null;
    async function getOverlay(): Promise<FillOverlay | null> {
      if (window !== window.top) return null;
      if (!overlay) {
        const mod = await import('@/lib/overlay/fill-overlay');
        overlay = new mod.FillOverlay();
      }
      return overlay;
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // ── Overlay messages ──
      if (message.type === 'FILL_OVERLAY_SHOW') {
        getOverlay().then((o) => o?.show(message.phase));
        return false;
      }
      if (message.type === 'FILL_OVERLAY_RESULT') {
        if (message.result && Array.isArray(message.logs)) {
          getOverlay().then((o) => o?.showResult(message.result, message.logs));
        }
        return false;
      }
      if (message.type === 'FILL_OVERLAY_DISMISS') {
        overlay?.dismiss();
        return false;
      }

      if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
        return true;
      }

      if (message.type === 'DETECT_FORM') {
        const hasForm = !!(
          (
            document.querySelector('[data-automation-id^="applyFlow"]') || // Workday
            document.querySelector('[class*="fieldEntry"]') || // Ashby
            document.querySelector('.application-question') || // Lever
            document.querySelector('#app_body, .job-app, #application') || // Greenhouse
            document.querySelector('#application-form, .application--form') || // Greenhouse embedded
            document.querySelector(
              'form[action*="greenhouse"], form[action*="lever"], form[action*="ashby"]',
            )
          ) // Generic ATS embedded
        );
        sendResponse({ hasForm, isTop: window === window.top });
        return true;
      }

      if (message.type === 'FILL') {
        const fillMap = message.fillMap;
        if (!fillMap || typeof fillMap !== 'object' || Array.isArray(fillMap)) {
          sendResponse({
            type: 'FILL_RESULT',
            result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [], mlAvailable: false },
            error: 'Invalid fillMap',
          });
          return true;
        }
        if (Object.keys(fillMap).length > 200) {
          sendResponse({
            type: 'FILL_RESULT',
            result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [], mlAvailable: false },
            error: 'fillMap too large',
          });
          return true;
        }

        fillController?.abort();
        fillController = new AbortController();

        const rawBank = message.answerBank;
        const answerBank = Array.isArray(rawBank)
          ? rawBank
              .filter(
                (e: unknown): e is { question: string; answer: string } =>
                  typeof e === 'object' &&
                  e !== null &&
                  typeof (e as Record<string, unknown>).question === 'string' &&
                  typeof (e as Record<string, unknown>).answer === 'string' &&
                  ((e as Record<string, unknown>).question as string).length <= 500 &&
                  ((e as Record<string, unknown>).answer as string).length <= 2000,
              )
              .slice(0, 50)
          : [];

        const doFill = async () => {
          // Workday: expand Add sections and fill experience entries before main pipeline
          let preLogs: { field: string; value: string; status: string; source?: string }[] = [];
          if (detectATS() === 'workday' && message.profile) {
            preLogs = await prepareAndFillWorkdayExperience(
              message.profile,
              fillController!.signal,
            );
          }

          const result = await fillPage(
            fillMap as Record<string, string>,
            answerBank,
            fillController!.signal,
          );

          // Merge pre-fill logs into main result
          if (preLogs.length > 0) {
            result.logs.unshift(...(preLogs as typeof result.logs));
            result.filled += preLogs.filter((l) => l.status === 'filled').length;
            result.total += preLogs.length;
          }

          return result;
        };

        doFill()
          .then((result) => {
            sendResponse({ type: 'FILL_RESULT', result });
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Fill failed: ${errMsg}`, window.location.href);
            sendResponse({
              type: 'FILL_RESULT',
              result: { filled: 0, total: 0, logs: [], mlAvailable: false },
              error: errMsg,
            });
          });
        return true;
      }
      return false;
    });
  },
});
