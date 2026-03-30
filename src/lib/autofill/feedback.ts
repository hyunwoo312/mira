/**
 * Stores fill feedback (misclassifications) to chrome.storage.local.
 * This data can later be exported as training data corrections.
 */

const FEEDBACK_KEY = 'mira_fill_feedback';
const MAX_ENTRIES = 200;

export interface FeedbackEntry {
  fieldLabel: string;
  status: 'filled' | 'skipped' | 'failed';
  filledCategory?: string;
  pageUrl: string;
  timestamp: string;
}

export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  try {
    const result = await chrome.storage.local.get(FEEDBACK_KEY);
    const existing: FeedbackEntry[] = Array.isArray(result[FEEDBACK_KEY])
      ? result[FEEDBACK_KEY]
      : [];
    existing.push(entry);
    // Keep only the most recent entries
    const trimmed = existing.slice(-MAX_ENTRIES);
    await chrome.storage.local.set({ [FEEDBACK_KEY]: trimmed });
  } catch {
    // Silently fail — feedback is non-critical
  }
}

export async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const result = await chrome.storage.local.get(FEEDBACK_KEY);
    return Array.isArray(result[FEEDBACK_KEY]) ? result[FEEDBACK_KEY] : [];
  } catch {
    return [];
  }
}

export async function clearFeedback(): Promise<void> {
  await chrome.storage.local.remove(FEEDBACK_KEY);
}
