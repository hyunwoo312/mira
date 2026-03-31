import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadFiles,
  saveFiles,
  fileToBase64,
  generateId,
  estimateStorageBytes,
  formatFileSize,
  MAX_FILE_SIZE,
  MAX_TOTAL_STORAGE,
  type StoredFile,
} from '@/lib/file-storage';

export function useFiles(presetId?: string) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const setTimedError = useCallback(
    (message: string) => {
      clearError();
      setError(message);
      errorTimerRef.current = setTimeout(() => {
        setError(null);
        errorTimerRef.current = null;
      }, 5000);
    },
    [clearError],
  );

  useEffect(() => {
    setIsLoaded(false); // eslint-disable-line react-hooks/set-state-in-effect -- intentional reset on preset switch
    loadFiles(presetId).then((f) => {
      setFiles(f);
      setIsLoaded(true);
    });
  }, [presetId]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const persist = useCallback(
    async (updated: StoredFile[]) => {
      await saveFiles(updated, presetId);
      setFiles(updated);
    },
    [presetId],
  );

  const addFile = useCallback(
    async (file: File, category: StoredFile['category']) => {
      clearError();

      if (file.size > MAX_FILE_SIZE) {
        setTimedError(
          `File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit (${formatFileSize(file.size)})`,
        );
        return;
      }

      const currentUsage = estimateStorageBytes(files);
      if (currentUsage + file.size > MAX_TOTAL_STORAGE) {
        setTimedError(
          `Storage quota exceeded. Using ${formatFileSize(currentUsage)} of ${formatFileSize(MAX_TOTAL_STORAGE)}. Free up space before uploading.`,
        );
        return;
      }

      const data = await fileToBase64(file);
      const newFile: StoredFile = {
        id: generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        data,
        category,
        isActive: false,
        uploadedAt: Date.now(),
      };

      const updated = [...files, newFile];

      // Auto-activate if first file in category
      const sameCategory = updated.filter((f) => f.category === category);
      if (sameCategory.length === 1) {
        newFile.isActive = true;
      }

      await persist(updated);
    },
    [files, persist, clearError, setTimedError],
  );

  const removeFile = useCallback(
    async (id: string) => {
      const file = files.find((f) => f.id === id);
      let updated = files.filter((f) => f.id !== id);

      // If removed file was active, activate next in same category
      if (file?.isActive) {
        const next = updated.find((f) => f.category === file.category);
        if (next) next.isActive = true;
      }

      await persist(updated);
    },
    [files, persist],
  );

  const setActive = useCallback(
    async (id: string) => {
      const file = files.find((f) => f.id === id);
      if (!file) return;

      const updated = files.map((f) => ({
        ...f,
        isActive: f.category === file.category ? f.id === id : f.isActive,
      }));

      await persist(updated);
    },
    [files, persist],
  );

  const getByCategory = useCallback(
    (category: StoredFile['category']) => files.filter((f) => f.category === category),
    [files],
  );

  return { files, isLoaded, error, clearError, addFile, removeFile, setActive, getByCategory };
}
