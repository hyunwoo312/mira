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
    const existing = await loadFeedbackEntries();
    existing.push(entry);
    // Keep only the most recent entries
    const trimmed = existing.slice(-MAX_ENTRIES);
    await chrome.storage.local.set({ [FEEDBACK_KEY]: trimmed });
  } catch {
    // Silently fail — feedback is non-critical
  }
}

export async function loadFeedbackEntries(): Promise<FeedbackEntry[]> {
  try {
    const result = await chrome.storage.local.get(FEEDBACK_KEY);
    return Array.isArray(result[FEEDBACK_KEY]) ? (result[FEEDBACK_KEY] as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

export function formatFeedbackBundle(entries: FeedbackEntry[]): string {
  const lines = ['=== MIRA LOCAL FEEDBACK ===', `Entries: ${entries.length}`, ''];
  for (const entry of entries) {
    lines.push(`${entry.timestamp}  ${entry.status.toUpperCase()}  ${entry.fieldLabel}`);
    if (entry.filledCategory) lines.push(`  value/category: ${entry.filledCategory}`);
    lines.push(`  url: ${entry.pageUrl}`);
  }
  return lines.join('\n');
}
