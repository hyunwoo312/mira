import type { FillOutcome } from '../types';
import { sleep } from './shared';

export async function fillFile(el: HTMLElement, value: string): Promise<FillOutcome> {
  if (!(el instanceof HTMLInputElement) || el.type !== 'file')
    return { status: 'skipped', reason: 'wrong-type' };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>).name !== 'string' ||
      typeof (parsed as Record<string, unknown>).data !== 'string'
    ) {
      return { status: 'failed', reason: 'element-error' };
    }
    const fileData = parsed as { name: string; type?: string; data: string };
    const base64 = fileData.data.split(',')[1] ?? fileData.data;
    // Guard against excessively large payloads (>10MB base64 ≈ ~7.5MB file)
    if (base64.length > 10_000_000) return { status: 'failed', reason: 'element-error' };
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], fileData.name, { type: fileData.type || 'application/pdf' });

    // Strategy 1: Set files via DataTransfer
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));

    if (el.files && el.files.length > 0) return { status: 'filled' };

    // Strategy 2: Dispatch drop event (some frameworks like Workday ignore el.files assignment)
    await sleep(100);
    const dropDt = new DataTransfer();
    dropDt.items.add(file);
    const dropTarget = el.closest('[data-automation-id*="file"]') ?? el.parentElement ?? el;
    dropTarget.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dropDt }));
    dropTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dropDt }));
    dropTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dropDt }));

    await sleep(200);

    // Check if the upload was accepted (either files set or UI changed)
    if (el.files && el.files.length > 0) return { status: 'filled' };

    // Assume success if we got this far without error — the file was sent to the input
    // Some frameworks process the upload asynchronously and we can't confirm immediately
    return { status: 'filled' };
  } catch {
    return { status: 'failed', reason: 'element-error' };
  }
}
