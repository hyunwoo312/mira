/**
 * Offscreen document entry point.
 * Loads the unified ML model and handles classification + scoring
 * requests from the service worker.
 */

import { FieldClassifier } from '@/lib/ml/classifier';
import type { OffscreenRequest, FieldContext, Classification } from '@/lib/ml/types';

const classifier = new FieldClassifier();

chrome.runtime.onMessage.addListener(
  (message: OffscreenRequest, _sender, sendResponse: (response: unknown) => void) => {
    switch (message.type) {
      case 'OFFSCREEN_LOAD_MODEL':
        classifier
          .load((status, progress, error) => {
            chrome.runtime.sendMessage({ type: 'ML_STATUS', status, progress, error });
          })
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case 'OFFSCREEN_CLASSIFY':
        classifier
          .classify(message.fields as FieldContext[])
          .then((classifications: Classification[]) =>
            sendResponse({ requestId: message.requestId, classifications }),
          )
          .catch((err: Error) =>
            sendResponse({ requestId: message.requestId, classifications: [], error: err.message }),
          );
        return true;

      case 'OFFSCREEN_MATCH_ANSWERS':
        classifier
          .matchAnswers(message.fieldLabels as string[], message.questions as string[])
          .then((matches) => sendResponse({ requestId: message.requestId, matches }))
          .catch((err: Error) =>
            sendResponse({ requestId: message.requestId, matches: [], error: err.message }),
          );
        return true;

      case 'OFFSCREEN_MATCH_OPTION':
        // Legacy embeddings-based option matching — now routed through scoreOptions
        classifier
          .scoreOptions(
            message.value as string,
            message.value as string,
            message.options as string[],
          )
          .then((result) =>
            sendResponse({
              requestId: message.requestId,
              bestIndex: result.bestIndex,
              similarity: result.score,
            }),
          )
          .catch((err: Error) =>
            sendResponse({
              requestId: message.requestId,
              bestIndex: -1,
              similarity: 0,
              error: err.message,
            }),
          );
        return true;

      case 'OFFSCREEN_SCORE_OPTIONS':
        classifier
          .scoreOptions(
            message.question as string,
            message.profileValue as string,
            message.options as string[],
          )
          .then((result) => sendResponse({ requestId: message.requestId, ...result }))
          .catch((err: Error) =>
            sendResponse({
              requestId: message.requestId,
              bestIndex: -1,
              score: 0,
              error: err.message,
            }),
          );
        return true;

      case 'OFFSCREEN_GET_STATUS':
        sendResponse({ status: classifier.getStatus() });
        return true;

      case 'OFFSCREEN_UNLOAD':
        classifier
          .unload()
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
        return true;
    }
  },
);
