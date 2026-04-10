import type { ATSScanner, ScanResult, ATSName } from '../types';
import {
  getSectionHeading,
  resolveWidgetType,
  scanFieldsetGroups,
  scanUngroupedByContainer,
  scanIndividualElements,
  classifyByContext,
} from './shared';

/** Phase: Scan Ashby fieldEntry button groups and single checkboxes. */
export function scanFieldEntryGroups(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const fieldEntries = document.querySelectorAll('[class*="fieldEntry"], [class*="field-entry"]');
  for (const entry of fieldEntries) {
    const label =
      entry.querySelector(':scope > label, :scope > [class*="label"]')?.textContent?.trim() ?? '';
    if (!label) continue;

    const buttons = Array.from(entry.querySelectorAll<HTMLButtonElement>('button')).filter((b) => {
      const text = b.textContent?.trim() ?? '';
      return (
        text.length > 0 && text.length < 80 && !/(submit|save|cancel|close|back|next)/i.test(text)
      );
    });
    if (buttons.length >= 2 && buttons.length <= 6) {
      const sectionHeading = getSectionHeading(buttons[0]!);
      results.push({
        widgetType: 'button-group',
        element: buttons[0]!,
        label,
        category: null,
        ats,
        groupElements: buttons,
        groupLabels: buttons.map((b) => b.textContent?.trim() ?? ''),
        sectionHeading,
      });
      entry.querySelectorAll('input').forEach((inp) => groupedElements.add(inp as HTMLElement));
      continue;
    }

    const checkboxes = entry.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (checkboxes.length === 1 && !groupedElements.has(checkboxes[0]!)) {
      const sectionHeading = getSectionHeading(checkboxes[0]!);
      results.push({
        widgetType: 'checkbox',
        element: checkboxes[0]!,
        label,
        category: null,
        ats,
        sectionHeading,
      });
      groupedElements.add(checkboxes[0]!);
    }
  }
}

/** Phase: Group checkboxes by shared ID prefix (Ashby DEI groups). */
export function scanCheckboxesByIdPrefix(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const cbByName = new Map<string, HTMLInputElement[]>();
  for (const cb of allCheckboxes) {
    if (groupedElements.has(cb)) continue;
    const id = cb.id || '';
    const nameKey = id.replace(/-labeled-checkbox-\d+$/, '');
    if (!nameKey) continue;
    if (!cbByName.has(nameKey)) cbByName.set(nameKey, []);
    cbByName.get(nameKey)!.push(cb);
  }
  for (const [, cbs] of cbByName) {
    if (cbs.length < 2) continue;
    if (cbs.some((c) => groupedElements.has(c))) continue;

    let label = '';
    const container = cbs[0]!.closest('[class*="fieldEntry"], [class*="field-entry"]');
    if (container) {
      label =
        container.querySelector(':scope > label, :scope > [class*="label"]')?.textContent?.trim() ??
        '';
    }
    if (!label) {
      label = getSectionHeading(cbs[0]!);
    }
    if (!label) continue;

    const cbLabels = cbs.map((c) => c.labels?.[0]?.textContent?.trim() ?? c.name ?? '');
    const sectionHeading = getSectionHeading(cbs[0]!);
    const widgetType = resolveWidgetType(cbs[0]!, 'radio-group', cbs);
    results.push({
      widgetType,
      element: cbs[0]!,
      label,
      category: null,
      ats,
      groupElements: cbs,
      groupLabels: cbLabels,
      sectionHeading,
    });
    cbs.forEach((c) => groupedElements.add(c));
  }
}

export const ashby: ATSScanner = {
  name: 'ashby',

  detect() {
    const host = window.location.hostname;
    if (host.includes('ashbyhq.com') || host.includes('jobs.ashby')) return true;
    return !!document.querySelector('[class*="fieldEntry"]');
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenLabels = new Set<string>();
    const groupedElements = new Set<HTMLElement>();

    // Phase: Fieldset-based groups
    scanFieldsetGroups(results, groupedElements, 'ashby');

    // Phase: fieldEntry button groups and single checkboxes
    scanFieldEntryGroups(results, groupedElements, 'ashby');

    // Phase: Checkboxes grouped by shared ID prefix (DEI)
    scanCheckboxesByIdPrefix(results, groupedElements, 'ashby');

    // Phase: Ungrouped radios/checkboxes by parent container (Diversity Survey)
    scanUngroupedByContainer(results, groupedElements, 'ashby');

    // Standard individual element scan
    scanIndividualElements(results, seenLabels, groupedElements, 'ashby');
    classifyByContext(results);

    return results;
  },
};
