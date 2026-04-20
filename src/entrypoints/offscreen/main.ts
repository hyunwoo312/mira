/**
 * Offscreen document entry point.
 * Loads the unified ML model and handles classification + scoring
 * requests from the service worker.
 */

import { FieldClassifier } from '@/lib/ml/classifier';
import type { OffscreenRequest, FieldContext, Classification } from '@/lib/ml/types';

const classifier = new FieldClassifier();

function isFieldArray(v: unknown): v is FieldContext[] {
  return Array.isArray(v) && v.every((f) => f && typeof f === 'object');
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

chrome.runtime.onMessage.addListener(
  (message: OffscreenRequest, sender, sendResponse: (response: unknown) => void) => {
    // Only accept requests from this extension's own scripts.
    if (sender.id && sender.id !== chrome.runtime.id) return false;
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
        if (!isFieldArray(message.fields)) {
          sendResponse({
            requestId: message.requestId,
            classifications: [],
            error: 'invalid fields',
          });
          return true;
        }
        classifier
          .classify(message.fields)
          .then((classifications: Classification[]) =>
            sendResponse({ requestId: message.requestId, classifications }),
          )
          .catch((err: Error) =>
            sendResponse({ requestId: message.requestId, classifications: [], error: err.message }),
          );
        return true;

      case 'OFFSCREEN_MATCH_ANSWERS':
        if (!isStringArray(message.fieldLabels) || !isStringArray(message.questions)) {
          sendResponse({ requestId: message.requestId, matches: [], error: 'invalid payload' });
          return true;
        }
        classifier
          .matchAnswers(message.fieldLabels, message.questions)
          .then((matches) => sendResponse({ requestId: message.requestId, matches }))
          .catch((err: Error) =>
            sendResponse({ requestId: message.requestId, matches: [], error: err.message }),
          );
        return true;

      case 'OFFSCREEN_MATCH_OPTION':
        // Legacy embeddings-based option matching — now routed through scoreOptions
        if (typeof message.value !== 'string' || !isStringArray(message.options)) {
          sendResponse({
            requestId: message.requestId,
            bestIndex: -1,
            similarity: 0,
            error: 'invalid payload',
          });
          return true;
        }
        classifier
          .scoreOptions(message.value, message.value, message.options)
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
        if (
          typeof message.question !== 'string' ||
          typeof message.profileValue !== 'string' ||
          !isStringArray(message.options)
        ) {
          sendResponse({
            requestId: message.requestId,
            bestIndex: -1,
            score: 0,
            error: 'invalid payload',
          });
          return true;
        }
        classifier
          .scoreOptions(message.question, message.profileValue, message.options)
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
