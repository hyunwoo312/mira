import type { ATSScanner, ATSName, ScanResult } from '../types';
import { resetLabelCache } from './shared';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { ashby } from './ashby';
import { workday } from './workday';
import { generic } from './generic';

/** Ordered list of ATS scanners. First match wins; generic is the fallback. */
const scanners: ATSScanner[] = [workday, greenhouse, lever, ashby];

/** Detect which ATS owns this page. Returns 'generic' if none match. */
export function detectATS(): ATSName {
  for (const s of scanners) {
    if (s.detect()) return s.name;
  }
  return 'generic';
}

/** Scan the page using the appropriate ATS scanner. */
export function scanPage(): ScanResult[] {
  resetLabelCache();

  const ats = detectATS();
  const scanner = scanners.find((s) => s.name === ats) ?? generic;
  return scanner.scan();
}
