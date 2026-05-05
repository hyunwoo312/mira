import { useCallback, useRef, useState } from 'react';
import { parseResumePdf, ResumeParseError, describeParseError } from '@/lib/import/resume-parser';
import type { ImportPayload } from '@/lib/import/types';

interface UseResumeImportOptions {
  onError?: (message: string) => void;
}

interface UseResumeImportResult {
  pending: ImportPayload | null;
  parsing: boolean;
  triggerImport: () => void;
  parseFile: (file: File) => void;
  closeReview: () => void;
}

/**
 * Opens a file picker, parses the chosen PDF, and surfaces the resulting
 * ImportPayload. The consumer renders the review modal driven by `pending`
 * and calls `closeReview` to dismiss / commit.
 */
export function useResumeImport({ onError }: UseResumeImportOptions = {}): UseResumeImportResult {
  const [pending, setPending] = useState<ImportPayload | null>(null);
  const [parsing, setParsing] = useState(false);
  // Stable ref for the input so we can clean up between triggers.
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parseFile = useCallback(
    (file: File) => {
      if (parsing) return;
      setParsing(true);
      void parseResumePdf(file)
        .then((payload) => {
          setPending(payload);
        })
        .catch((err) => {
          const msg =
            err instanceof ResumeParseError
              ? describeParseError(err.cause)
              : "We couldn't read this file. Try a different one.";
          onError?.(msg);
        })
        .finally(() => {
          setParsing(false);
        });
    },
    [parsing, onError],
  );

  const triggerImport = useCallback(() => {
    if (parsing) return;
    if (inputRef.current) {
      inputRef.current.remove();
      inputRef.current = null;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      inputRef.current = null;
      if (!file) return;
      parseFile(file);
    });
    document.body.appendChild(input);
    inputRef.current = input;
    input.click();
  }, [parsing, parseFile]);

  const closeReview = useCallback(() => {
    setPending(null);
  }, []);

  return { pending, parsing, triggerImport, parseFile, closeReview };
}
