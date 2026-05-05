// Match `useFiles`' MAX_FILE_SIZE — if we accept a PDF for parse but the
// downstream attach rejects it, the user ends up with profile data filled but
// no resume on the preset. Keep the two limits aligned.
export const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

export type ValidationError =
  | { kind: 'too-large'; sizeBytes: number }
  | { kind: 'wrong-type' }
  | { kind: 'unreadable' };

/**
 * Check magic bytes — never trust file extensions.
 * PDF files start with `%PDF-` (0x25 0x50 0x44 0x46 0x2D).
 */
export async function validatePdfFile(file: File): Promise<ValidationError | null> {
  if (file.size > MAX_PDF_BYTES) {
    return { kind: 'too-large', sizeBytes: file.size };
  }
  if (file.size < 5) {
    return { kind: 'unreadable' };
  }
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const expected = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  for (let i = 0; i < expected.length; i++) {
    if (head[i] !== expected[i]) return { kind: 'wrong-type' };
  }
  return null;
}

export function describeValidationError(err: ValidationError): string {
  switch (err.kind) {
    case 'too-large':
      return `File is ${(err.sizeBytes / (1024 * 1024)).toFixed(1)} MB. Mira accepts resume PDFs up to 5 MB.`;
    case 'wrong-type':
      return "This doesn't look like a PDF file.";
    case 'unreadable':
      return "We couldn't read this file. Try a different one.";
  }
}
