import { parseResumeText } from './resume-heuristics';
import { validatePdfFile, describeValidationError } from './file-validation';
import type { ImportPayload } from './types';

export type ParseError =
  | { kind: 'validation'; message: string }
  | { kind: 'encrypted' }
  | { kind: 'no-text-layer' }
  | { kind: 'parser-failed'; message: string };

export class ResumeParseError extends Error {
  constructor(public readonly cause: ParseError) {
    super(describeParseError(cause));
    this.name = 'ResumeParseError';
  }
}

export function describeParseError(err: ParseError): string {
  switch (err.kind) {
    case 'validation':
      return err.message;
    case 'encrypted':
      return 'This PDF is locked. Unlock it and try again.';
    case 'no-text-layer':
      return "This PDF doesn't have selectable text. Try a text-based PDF or fill manually.";
    case 'parser-failed':
      return `We couldn't read this resume (${err.message}).`;
  }
}

/**
 * Lazy-load pdfjs only when invoked. Keeps the cold-start bundle lean for users
 * who never use resume import.
 */
export async function parseResumePdf(file: File): Promise<ImportPayload> {
  const validationError = await validatePdfFile(file);
  if (validationError) {
    throw new ResumeParseError({
      kind: 'validation',
      message: describeValidationError(validationError),
    });
  }

  const text = await extractPdfText(file);
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    // 20 chars is below any real resume — likely scanned or empty.
    throw new ResumeParseError({ kind: 'no-text-layer' });
  }

  const fields = parseResumeText(text);
  return {
    source: 'resume-pdf',
    fileName: file.name,
    fileSize: file.size,
    fields,
    file,
  };
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/password|encrypted/i.test(message)) {
      throw new ResumeParseError({ kind: 'encrypted' });
    }
    throw new ResumeParseError({ kind: 'parser-failed', message });
  }

  try {
    const lines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      lines.push(joinTextItemsByLine(content.items));
    }
    return lines.join('\n');
  } finally {
    void pdf.destroy();
  }
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[]; // [a, b, c, d, e, f] — e is x-coord, f is y-coord
}

interface Tuple {
  x: number;
  y: number;
  str: string;
}

/**
 * pdfjs returns text items in reading order but without explicit line breaks.
 * Group items by their baseline y-coordinate within each detected column, then
 * concat columns left-to-right. Falls back to a single-column join when no
 * clear column gap is detected.
 */
function joinTextItemsByLine(items: unknown[]): string {
  const tuples: Tuple[] = [];
  for (const raw of items) {
    const item = raw as PdfTextItemLike;
    if (typeof item.str !== 'string' || item.str.trim().length === 0) continue;
    const x = Array.isArray(item.transform) ? Math.round(item.transform[4] ?? 0) : 0;
    const y = Array.isArray(item.transform) ? Math.round(item.transform[5] ?? 0) : 0;
    tuples.push({ x, y, str: item.str });
  }
  if (tuples.length === 0) return '';

  const split = detectTwoColumnSplit(tuples);
  if (split !== null) {
    const left = tuples.filter((t) => t.x < split);
    const right = tuples.filter((t) => t.x >= split);
    if (!isRightAlignedRail(left, right)) {
      return [groupByY(left), groupByY(right)].filter(Boolean).join('\n\n');
    }
  }

  return groupByY(tuples);
}

/**
 * Distinguish a true two-column layout from a single column with right-aligned
 * content (e.g., LaTeX templates that flush dates/locations to the right margin
 * on the same baseline as the entry header). In the latter case, "right column"
 * items share y-buckets with left items — joining them per-line preserves the
 * association between an entry and its date.
 */
function isRightAlignedRail(left: Tuple[], right: Tuple[]): boolean {
  if (right.length === 0) return true;
  const leftYs = new Set(left.map((t) => t.y));
  let shared = 0;
  const rightYs = new Set<number>();
  for (const t of right) {
    rightYs.add(t.y);
    if (leftYs.has(t.y)) shared += 1;
  }
  // If most right items sit on the same y as a left item, it's right-aligned
  // content rather than a separate column.
  return shared / right.length >= 0.5;
}

/**
 * Returns an x-coordinate to split on if the items appear to form two columns
 * with a clear gutter, otherwise null. Heuristic: project x-coords to a 1D
 * histogram, look for a wide empty band in the middle third of the page.
 */
function detectTwoColumnSplit(tuples: Tuple[]): number | null {
  if (tuples.length < 30) return null; // tiny resume, not worth columnizing
  const xs = tuples.map((t) => t.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin;
  if (xRange < 200) return null;

  const bins = 40;
  const counts = new Array<number>(bins).fill(0);
  for (const x of xs) {
    const bin = Math.min(bins - 1, Math.floor(((x - xMin) / xRange) * bins));
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  // Look for the longest run of empty bins inside the middle 60% of the page.
  const startBin = Math.floor(bins * 0.2);
  const endBin = Math.floor(bins * 0.8);
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = startBin; i <= endBin; i++) {
    if ((counts[i] ?? 0) === 0) {
      if (runStart === -1) runStart = i;
      const len = i - runStart + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  }
  if (bestLen < 4) return null; // gutter under ~10% of page width — not a clear split
  const gutterCenterBin = bestStart + bestLen / 2;
  return xMin + (gutterCenterBin / bins) * xRange;
}

function groupByY(tuples: Tuple[]): string {
  const buckets = new Map<number, Tuple[]>();
  for (const t of tuples) {
    if (!buckets.has(t.y)) buckets.set(t.y, []);
    buckets.get(t.y)!.push(t);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0]) // descending y = top to bottom
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}
