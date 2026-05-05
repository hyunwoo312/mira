import { useEffect } from 'react';
import { fillPage } from '@/lib/autofill/pipeline';
import { profileToFillMap } from '@/lib/autofill/profile-map';
import { DEMO_PROFILE } from '@/lib/onboarding/demo-profile';
import { loadFiles } from '@/lib/file-storage';
import type { Profile } from '@/lib/schema';

export const ONBOARDING_FILL_MESSAGE = 'MIRA_ONBOARDING_FILL';
export const ONBOARDING_FILL_RESPONSE = 'MIRA_ONBOARDING_FILL_DONE';

export interface DemoFillStats {
  filled: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

interface FillResponse extends DemoFillStats {
  type: typeof ONBOARDING_FILL_RESPONSE;
  logs: unknown[];
}

/** Most recent demo-fill stats — read by the Submitted phase. */
let lastFillStats: DemoFillStats | null = null;
const subscribers = new Set<(stats: DemoFillStats) => void>();

export function getLastDemoFillStats(): DemoFillStats | null {
  return lastFillStats;
}

export function subscribeDemoFillStats(fn: (stats: DemoFillStats) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Listen for fill requests from the side panel and run them on the local DOM. */
export function useDemoFillListener() {
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r: FillResponse | { error: string }) => void,
    ) => {
      if (
        !message ||
        typeof message !== 'object' ||
        (message as { type?: string }).type !== ONBOARDING_FILL_MESSAGE
      ) {
        return false;
      }

      const profile = (message as { profile?: Profile }).profile ?? DEMO_PROFILE;
      void runDemoFill(profile)
        .then((r) => {
          lastFillStats = {
            filled: r.filled,
            failed: r.failed,
            skipped: r.skipped,
            durationMs: r.durationMs,
          };
          for (const fn of subscribers) fn(lastFillStats);
          sendResponse(r);
        })
        .catch((e: Error) => sendResponse({ error: e.message }));
      return true;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}

async function runDemoFill(profile: Profile): Promise<FillResponse> {
  // User-uploaded resume / cover letter live in the real profile's file
  // storage. Surface their filenames in the fillMap so the demo form's file
  // inputs reflect the upload (the actual file attachment lives in storage
  // and is referenced by the file uploader's existing flow).
  const files = await loadFiles().catch(() => [] as Awaited<ReturnType<typeof loadFiles>>);
  const fillMap = profileToFillMap(profile);
  const resume =
    files.find((f) => f.category === 'resume' && f.isActive) ??
    files.find((f) => f.category === 'resume');
  const coverLetter =
    files.find((f) => f.category === 'cover_letter' && f.isActive) ??
    files.find((f) => f.category === 'cover_letter');
  if (resume) fillMap.resume = resume.name;
  if (coverLetter) fillMap.coverLetter = coverLetter.name;

  const result = await fillPage(fillMap, profile.answerBank, undefined, {
    profile,
  });

  return {
    type: ONBOARDING_FILL_RESPONSE,
    filled: result.filled,
    failed: result.failed,
    skipped: result.skipped,
    durationMs: result.durationMs,
    logs: (result.logs as unknown[]).slice(0, 200),
  };
}
