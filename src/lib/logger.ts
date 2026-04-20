/**
 * Extension-scoped logger. Writes to chrome.storage.local instead of the page console.
 * Keeps a rolling buffer of the last 100 log entries.
 * Access logs via the side panel settings or chrome.storage.local.get('mira_logs').
 */

const LOG_KEY = 'mira_logs';
const SETTINGS_KEY = 'mira_settings';
const MAX_ENTRIES = 100;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
}

async function writeLog(level: LogLevel, message: string, context?: string): Promise<void> {
  try {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const result = await chrome.storage.local.get(LOG_KEY);
    const existing: LogEntry[] = Array.isArray(result[LOG_KEY]) ? result[LOG_KEY] : [];
    existing.push(entry);
    const trimmed = existing.slice(-MAX_ENTRIES);
    await chrome.storage.local.set({ [LOG_KEY]: trimmed });
  } catch {
    // Storage unavailable — last resort fallback
  }
}

async function isVerbose(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get(SETTINGS_KEY);
    const s = r[SETTINGS_KEY] as { verboseLogging?: boolean } | undefined;
    return s?.verboseLogging === true;
  } catch {
    return false;
  }
}

export const logger = {
  debug: async (message: string, context?: string) => {
    if (await isVerbose()) {
      // eslint-disable-next-line no-console
      console.debug('[mira]', context ? `[${context}]` : '', message);
      writeLog('debug', message, context);
    }
  },
  info: (message: string, context?: string) => writeLog('info', message, context),
  warn: (message: string, context?: string) => writeLog('warn', message, context),
  error: (message: string, context?: string) => writeLog('error', message, context),
};

export async function loadLogs(): Promise<LogEntry[]> {
  try {
    const result = await chrome.storage.local.get(LOG_KEY);
    return Array.isArray(result[LOG_KEY]) ? result[LOG_KEY] : [];
  } catch {
    return [];
  }
}

export async function clearLogs(): Promise<void> {
  await chrome.storage.local.remove(LOG_KEY);
}
