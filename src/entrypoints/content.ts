import { fillPage } from '@/lib/autofill/pipeline';
import { logger } from '@/lib/logger';
import { initBridge } from '@/lib/autofill/bridge';
import { detectATS } from '@/lib/autofill/scanners/index';
import { prepareAndFillWorkdayExperience } from '@/lib/autofill/workday/experience';
import { dedupeLogs } from '@/lib/autofill/pipeline';
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

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Reject messages not from this extension's own scripts.
      if (sender.id && sender.id !== chrome.runtime.id) return false;

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
            document.querySelector('[id*="ProfileFields."]') || // iCIMS (form fields live inside the iframe)
            document.querySelector('.iCIMS_Anchor, .iCIMS_InnerIframe') || // iCIMS wrappers
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
        // Guard individual values too — a resume base64 fits in ~7MB, so 10MB
        // is a generous ceiling. Anything bigger is almost certainly an
        // injection attempt or a serialization bug.
        const MAX_VALUE_LEN = 10_000_000;
        for (const v of Object.values(fillMap)) {
          if (typeof v === 'string' && v.length > MAX_VALUE_LEN) {
            sendResponse({
              type: 'FILL_RESULT',
              result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [], mlAvailable: false },
              error: 'fillMap value too large',
            });
            return true;
          }
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

          const settings =
            message.settings && typeof message.settings === 'object'
              ? (message.settings as { mlDisabled?: boolean; verboseLogging?: boolean })
              : {};

          const result = await fillPage(
            fillMap as Record<string, string>,
            answerBank,
            fillController!.signal,
            { mlDisabled: settings.mlDisabled === true },
          );

          // Workday preLogs arrive after fillPage's own dedup, so re-dedup
          // against the merged set or duplicates leak through.
          if (preLogs.length > 0) {
            const merged = [...(preLogs as typeof result.logs), ...result.logs];
            result.logs = dedupeLogs(merged);
            result.filled = result.logs.filter((l) => l.status === 'filled').length;
            result.failed = result.logs.filter((l) => l.status === 'failed').length;
            result.skipped = result.logs.filter((l) => l.status === 'skipped').length;
            result.total = result.filled + result.failed + result.skipped;
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
