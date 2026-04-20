/**
 * Shared debug-log formatter used by both the side-panel Fill Details
 * and the overlay's Copy button. Kept in one place so the two stay
 * in sync — previously they diverged and the overlay missed fields.
 */

interface DebugLogItem {
  field: string;
  value?: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: string;
  confidence?: number;
  skipReason?: string;
  failReason?: string;
  attemptedValue?: string;
  widgetType?: string;
  category?: string;
  sectionHeading?: string;
  groupLabels?: string[];
  elementHint?: string;
}

interface DebugLogResult {
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  ats?: string;
  durationMs?: number;
  mlAvailable?: boolean;
  totalFormElements?: number;
}

export function formatDebugLog(
  result: DebugLogResult | null,
  logs: DebugLogItem[],
  pageUrl: string,
): string {
  const lines: string[] = [];
  lines.push('=== MIRA FILL DEBUG LOG ===');
  if (pageUrl) lines.push(`URL: ${pageUrl}`);
  if (result) {
    lines.push(`ATS: ${result.ats ?? 'unknown'}`);
    if (result.totalFormElements != null)
      lines.push(`Form elements on page: ${result.totalFormElements}`);
    lines.push(`Fields scanned: ${result.total}`);
    lines.push(
      `Result: ${result.filled} filled, ${result.failed} failed, ${result.skipped} skipped`,
    );
    if (result.durationMs != null) lines.push(`Duration: ${result.durationMs}ms`);
    if (result.mlAvailable != null) lines.push(`ML: ${result.mlAvailable ? 'yes' : 'no'}`);
  }
  lines.push('');

  const groups: [string, DebugLogItem[]][] = [
    ['FILLED', logs.filter((l) => l.status === 'filled')],
    ['FAILED', logs.filter((l) => l.status === 'failed')],
    ['SKIPPED', logs.filter((l) => l.status === 'skipped')],
  ];

  for (const [groupLabel, groupLogs] of groups) {
    if (groupLogs.length === 0) continue;
    lines.push(`--- ${groupLabel} (${groupLogs.length}) ---`);
    for (const l of groupLogs) {
      lines.push(`  ${l.field}`);
      const confPct = l.confidence != null ? ` (${Math.round(l.confidence * 100)}%)` : '';
      lines.push(
        `    widget: ${l.widgetType ?? '?'}  |  category: ${l.category ?? 'none'}  |  by: ${l.source ?? '?'}${confPct}`,
      );
      if (l.value) lines.push(`    value: ${l.value}`);
      if (l.sectionHeading) lines.push(`    section: ${l.sectionHeading}`);
      if (l.groupLabels && l.groupLabels.length > 0)
        lines.push(`    options: [${l.groupLabels.join(', ')}]`);
      if (l.elementHint) lines.push(`    element: ${l.elementHint}`);
      if (l.attemptedValue) lines.push(`    attempted: ${l.attemptedValue}`);
      if (l.failReason) lines.push(`    reason: ${l.failReason}`);
      if (l.skipReason) lines.push(`    reason: ${l.skipReason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
