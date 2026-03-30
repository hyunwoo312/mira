/**
 * Types for ML inference messaging between
 * content script ↔ service worker ↔ offscreen document.
 */

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FieldContext {
  label: string;
  type: string;
  options?: string[];
  placeholder?: string;
  name?: string;
  ariaLabel?: string;
  sectionHeading?: string;
}

export interface Classification {
  label: string;
  category: string;
  confidence: number;
}

export interface AnswerMatch {
  fieldLabel: string;
  questionIndex: number;
  similarity: number;
}

/** Messages sent TO the offscreen document */
export type OffscreenRequest =
  | { type: 'OFFSCREEN_LOAD_MODEL' }
  | { type: 'OFFSCREEN_CLASSIFY'; requestId: string; fields: FieldContext[] }
  | {
      type: 'OFFSCREEN_MATCH_ANSWERS';
      requestId: string;
      fieldLabels: string[];
      questions: string[];
    }
  | { type: 'OFFSCREEN_MATCH_OPTION'; requestId: string; value: string; options: string[] }
  | { type: 'OFFSCREEN_UNLOAD' };

/** Messages sent FROM the offscreen document */
export type OffscreenResponse =
  | { type: 'ML_STATUS'; status: ModelStatus; progress?: number; error?: string }
  | { type: 'ML_CLASSIFY_RESULT'; requestId: string; classifications: Classification[] };

/** Messages sent from content script to service worker */
export interface MLClassifyRequest {
  type: 'ML_CLASSIFY';
  fields: FieldContext[];
}

export interface MLMatchAnswersRequest {
  type: 'ML_MATCH_ANSWERS';
  fieldLabels: string[];
  questions: string[];
}

export interface MLMatchAnswersResponse {
  matches: AnswerMatch[];
  error?: string;
}

/** ML semantic option matching: content script → service worker */
export interface MLMatchOptionRequest {
  type: 'ML_MATCH_OPTION';
  value: string;
  options: string[];
}

export interface MLMatchOptionResponse {
  bestIndex: number;
  similarity: number;
  error?: string;
}

/** Response from service worker to content script */
export interface MLClassifyResponse {
  classifications: Classification[];
  error?: string;
}
