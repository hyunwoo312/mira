const FILES_KEY_PREFIX = 'mira_files';
const LEGACY_FILES_KEY = 'mira_files';

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_STORAGE = 50 * 1024 * 1024; // 50 MB total

function filesKey(presetId?: string): string {
  return presetId ? `${FILES_KEY_PREFIX}_${presetId}` : LEGACY_FILES_KEY;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64
  category: 'resume' | 'cover_letter' | 'other';
  isActive: boolean;
  uploadedAt: number;
}

export async function loadFiles(presetId?: string): Promise<StoredFile[]> {
  try {
    const key = filesKey(presetId);
    const result = await chrome.storage.local.get([key, LEGACY_FILES_KEY]);

    // If preset-specific files exist, use them
    if (Array.isArray(result[key])) return result[key];

    // Migrate legacy files to the first preset that accesses them, then delete the legacy key
    if (presetId && Array.isArray(result[LEGACY_FILES_KEY])) {
      const legacy = result[LEGACY_FILES_KEY] as StoredFile[];
      await chrome.storage.local.set({ [key]: legacy });
      await chrome.storage.local.remove(LEGACY_FILES_KEY);
      return legacy;
    }

    return [];
  } catch {
    return [];
  }
}

export async function saveFiles(files: StoredFile[], presetId?: string): Promise<void> {
  await chrome.storage.local.set({ [filesKey(presetId)]: files });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Estimate actual byte size from base64 strings stored in Chrome storage.
 *  Chrome storage stores JSON — base64 data as a string uses ~1.37x the decoded byte size. */
export function estimateStorageBytes(files: StoredFile[]): number {
  return files.reduce((sum, f) => {
    const dataLen = f.data?.length ?? 0;
    // Base64 string in JSON storage ≈ original bytes * 4/3 + JSON overhead
    return sum + Math.ceil(dataLen) + 100; // +100 for metadata (name, type, etc.)
  }, 0);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
