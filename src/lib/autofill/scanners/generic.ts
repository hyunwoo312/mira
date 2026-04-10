import type { ATSScanner, ScanResult } from '../types';
import {
  scanFieldsetGroups,
  scanCheckboxesByContentMatch,
  scanUngroupedByContainer,
  scanIndividualElements,
  classifyByContext,
} from './shared';
import { scanFieldEntryGroups, scanCheckboxesByIdPrefix } from './ashby';

export const generic: ATSScanner = {
  name: 'generic',

  detect() {
    return true; // Always matches as fallback
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenLabels = new Set<string>();
    const groupedElements = new Set<HTMLElement>();

    // Phase 0: Fieldset-based groups
    scanFieldsetGroups(results, groupedElements, 'generic');

    // Phase 0b: fieldEntry button groups + single checkboxes
    scanFieldEntryGroups(results, groupedElements, 'generic');

    // Phase 0c: Checkboxes by shared ID prefix
    scanCheckboxesByIdPrefix(results, groupedElements, 'generic');

    // Phase 0d: Adjacent ungrouped checkboxes by content matching
    scanCheckboxesByContentMatch(results, groupedElements, 'generic');

    // Phase 0e: Ungrouped radios/checkboxes by parent container
    scanUngroupedByContainer(results, groupedElements, 'generic');

    // Phase 1: Individual form elements
    scanIndividualElements(results, seenLabels, groupedElements, 'generic');
    classifyByContext(results);

    return results;
  },
};
