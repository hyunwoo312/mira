import { fillPage } from '@/lib/autofill/pipeline';
import { logger } from '@/lib/logger';
import { initBridge } from '@/lib/autofill/bridge';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    // Initialize page script bridge
    initBridge();

    let fillController: AbortController | null = null;
    window.addEventListener('beforeunload', () => {
      fillController?.abort();
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
        return true;
      }

      if (message.type === 'FILL') {
        if (window !== window.top) return false;

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

        fillPage(fillMap as Record<string, string>, answerBank, fillController.signal)
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
