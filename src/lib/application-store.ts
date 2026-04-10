/**
 * Application history storage.
 * Stores a summary of each job application fill in chrome.storage.local.
 * Deduplicates multi-page forms (e.g., Workday) by canonical job ID.
 */

import type { ATSName } from './autofill/types';

export interface ApplicationEntry {
  id: string;
  url: string;
  company: string;
  role: string;
  location: string;
  ats: ATSName | string;
  timestamp: number;
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
}

const STORAGE_KEY = 'mira_applications';
const MAX_ENTRIES = 1000;
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Extract a canonical job identifier from the URL for deduplication. */
function extractJobId(url: string, ats?: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname;

    // Workday: company.wd5.myworkdayjobs.com/.../Job-Title_ID/apply
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
      const match = path.match(/\/job\/[^/]+\/([^/]+)/);
      return match ? `workday:${host}:${match[1]}` : `workday:${host}:${path}`;
    }

    // Greenhouse: job-boards.greenhouse.io/company/jobs/12345
    // Also matches embedded Greenhouse on custom domains when ATS is known
    if (host.includes('greenhouse.io') || host.includes('greenhouse') || ats === 'greenhouse') {
      const match = path.match(/\/jobs\/(\d+)/);
      return match ? `greenhouse:${match[1]}` : `greenhouse:${host}:${path}`;
    }

    // Lever: jobs.lever.co/company/uuid/apply
    if (host.includes('lever.co') || host.includes('jobs.lever') || ats === 'lever') {
      const match = path.match(/\/([0-9a-f-]{36})/);
      return match ? `lever:${match[1]}` : `lever:${host}:${path}`;
    }

    // Ashby: jobs.ashbyhq.com/company/uuid/application
    if (host.includes('ashbyhq.com') || host.includes('jobs.ashby') || ats === 'ashby') {
      const match = path.match(/\/([0-9a-f-]{36})/);
      return match ? `ashby:${match[1]}` : `ashby:${host}:${path}`;
    }

    // Fallback: use full origin + path (without query params)
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Extract company, role, and location from a Workday URL.
 *
 * URL patterns:
 *   company.wd5.myworkdayjobs.com/en-US/External/job/Location/Role_ID/apply
 *   company.wd1.myworkdayjobs.com/External/job/City-State/Job-Title_REQ123
 */
function parseWorkdayUrl(url: string): { company: string; role: string; location: string } {
  try {
    const u = new URL(url);
    const host = u.hostname;
    // Use decoded pathname so %2C → ","  etc.
    const path = decodeURIComponent(u.pathname);

    // Path structure: /en-US/Capital_One/job/McLean,-VA/Senior-Manager--Risk_R240162-1/apply/...
    // Segments before "/job/": [locale?, companySlug]
    // Segments after  "/job/": [location?, roleSlug, "apply", ...]
    const jobIdx = path.indexOf('/job/');

    // Company: prefer the path segment before "/job/" (e.g., "Capital_One" → "Capital One")
    // Fall back to subdomain if not available
    let company = '';
    if (jobIdx > 0) {
      const beforeJob = path.slice(1, jobIdx).split('/').filter(Boolean);
      // Skip locale segments like "en-US", "fr-FR"
      const companySegment = beforeJob.find((s) => !/^[a-z]{2}(-[A-Z]{2})?$/.test(s));
      if (companySegment) {
        company = companySegment.replace(/_/g, ' ').trim();
      }
    }
    if (!company) {
      // Fallback: subdomain "capitalone.wd12.myworkdayjobs.com" → "Capitalone"
      const subMatch =
        host.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/i) ??
        host.match(/^([^.]+)\.[^.]*\.?workday\.com$/i);
      if (subMatch?.[1]) {
        const raw = subMatch[1];
        company = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      }
    }

    let role = '';
    let location = '';

    if (jobIdx !== -1) {
      const afterJob = path.slice(jobIdx + 5); // after "/job/"
      const segments = afterJob.split('/').filter(Boolean);

      // Strip trailing non-content segments: "apply", "useMyLastApplication", etc.
      const applyIdx = segments.indexOf('apply');
      const meaningfulSegments = applyIdx >= 0 ? segments.slice(0, applyIdx) : segments;

      if (meaningfulSegments.length >= 2) {
        const roleSegment = meaningfulSegments[meaningfulSegments.length - 1]!;
        const locationSegments = meaningfulSegments.slice(0, -1);

        role = cleanRoleSegment(roleSegment);
        location = locationSegments
          .map((s) => s.replace(/-/g, ' '))
          .join(', ')
          .trim();
      } else if (meaningfulSegments.length === 1) {
        role = cleanRoleSegment(meaningfulSegments[0]!);
      }
    }

    return { company, role, location };
  } catch {
    return { company: '', role: '', location: '' };
  }
}

/** Clean a Workday role URL segment into a human-readable title. */
function cleanRoleSegment(segment: string): string {
  return (
    segment
      // Strip trailing requisition ID: _R240162-1, _JR-12345, _REQ123, etc.
      .replace(/_[A-Za-z]*\d[\w-]*$/, '')
      // Replace separator hyphens with spaces, collapsing multiples
      .replace(/-+/g, ' ')
      // Collapse multiple spaces
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/** Extract company and role from the page title, with URL fallback for Workday. */
export function parsePageTitle(
  title: string,
  url?: string,
  ats?: string,
): { company: string; role: string; location: string } {
  // Workday titles are useless ("Workday", "Apply - Workday") — extract from URL
  if (url && (ats === 'workday' || /myworkdayjobs\.com|workday\.com/i.test(url))) {
    const wd = parseWorkdayUrl(url);
    if (wd.company || wd.role) return wd;
  }

  // Common patterns:
  // "Software Engineer - Stripe" or "Stripe | Software Engineer"
  // "Apply for Software Engineer at Stripe"
  // "Software Engineer at Stripe - Job Application"
  const cleaned = title
    .replace(
      /\s*[-|–—]\s*(apply|application|job\s*(application|posting|board)?|careers?|hiring).*$/i,
      '',
    )
    .replace(/^(apply\s*(for|to)\s*)/i, '')
    .replace(/^(job\s*)?application\s*(for\s*)?/i, '')
    .trim();

  // Try "Role at/@ Company" (Ashby uses @, Greenhouse uses "at")
  const atMatch = cleaned.match(/^(.+?)\s+(?:at|@)\s+([^-|–—]+)$/i);
  if (atMatch) {
    return { role: atMatch[1]!.trim(), company: atMatch[2]!.trim(), location: '' };
  }

  // For "Company - Role" vs "Role - Company":
  // Lever uses "Company - Role". Greenhouse uses "Role - Company".
  // Heuristic: if the first segment is short (1-2 words) and doesn't contain
  // common role words, it's likely the company name.
  const parts = cleaned.split(/\s*[-|–—]\s*/);
  if (parts.length >= 2) {
    const first = parts[0]!.trim();
    const rest = parts.slice(1).join(' - ').trim();
    const roleWords =
      /engineer|developer|manager|designer|analyst|scientist|director|lead|senior|junior|intern|associate|coordinator|specialist|consultant|architect|head of/i;
    if (!roleWords.test(first) && roleWords.test(rest)) {
      // First part is company (e.g., "Plaid - Software Engineer")
      return { role: rest, company: first, location: '' };
    }
    // Otherwise assume "Role - Company" (split on last separator)
    const lastPart = parts[parts.length - 1]!.trim();
    const rolePart = parts.slice(0, -1).join(' - ').trim();
    return { role: rolePart, company: lastPart, location: '' };
  }

  return { role: cleaned || 'Unknown Role', company: '', location: '' };
}

/** Load all application entries from storage. */
export async function loadApplications(): Promise<ApplicationEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const entries = result[STORAGE_KEY];
  if (!Array.isArray(entries)) return [];
  return entries as ApplicationEntry[];
}

/** Save an application entry, deduplicating multi-page forms. */
export async function saveApplication(entry: Omit<ApplicationEntry, 'id'>): Promise<void> {
  const entries = await loadApplications();
  const ats = typeof entry.ats === 'string' ? entry.ats : undefined;
  const jobId = extractJobId(entry.url, ats);
  const now = entry.timestamp;

  // Check for duplicate: same job ID within dedup window
  const existingIdx = entries.findIndex((e) => {
    if (Math.abs(e.timestamp - now) > DEDUP_WINDOW_MS) return false;
    return extractJobId(e.url, ats) === jobId;
  });

  if (existingIdx >= 0) {
    const existing = entries[existingIdx]!;
    const samePage = existing.url === entry.url;

    if (samePage) {
      // Same page re-fill (user clicked fill again) — replace stats, don't sum
      entries[existingIdx] = {
        ...existing,
        filled: entry.filled,
        failed: entry.failed,
        skipped: entry.skipped,
        total: entry.total,
        durationMs: entry.durationMs,
        timestamp: now,
        location: entry.location || existing.location,
        company: entry.company || existing.company,
        role: entry.role || existing.role,
      };
    } else {
      // Different page of same job (e.g., Workday multi-page) — accumulate stats
      entries[existingIdx] = {
        ...existing,
        filled: existing.filled + entry.filled,
        failed: existing.failed + entry.failed,
        skipped: existing.skipped + entry.skipped,
        total: existing.total + entry.total,
        durationMs: existing.durationMs + entry.durationMs,
        timestamp: now,
        url: entry.url,
        location: entry.location || existing.location,
        company: entry.company || existing.company,
        role: entry.role || existing.role,
      };
    }
  } else {
    // New entry
    const id = crypto.randomUUID();
    entries.unshift({ id, ...entry });

    // Cap at MAX_ENTRIES
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

/** Delete a single application entry. */
export async function deleteApplication(id: string): Promise<void> {
  const entries = await loadApplications();
  const filtered = entries.filter((e) => e.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/** Clear all application history. */
export async function clearApplications(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
