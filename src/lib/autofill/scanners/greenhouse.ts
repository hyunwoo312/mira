import type { ATSScanner, ScanResult } from '../types';
import { scanFieldsetGroups, scanIndividualElements, classifyByContext } from './shared';

export const greenhouse: ATSScanner = {
  name: 'greenhouse',

  detect() {
    const host = window.location.hostname;
    if (host.includes('greenhouse.io') || host.includes('boards.greenhouse')) return true;
    if (document.querySelector('#app_body, .job-app')) return true;
    // Embedded Greenhouse forms (e.g., HubSpot, custom career pages)
    if (document.querySelector('form[id*="greenhouse"], form[action*="greenhouse"]')) return true;
    // Greenhouse-style field IDs (question_NNNNN pattern + gh-apply elements)
    if (document.querySelector('#gh-apply-location, [id^="gh-apply"]')) return true;
    return false;
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenLabels = new Set<string>();
    const groupedElements = new Set<HTMLElement>();

    // Skip phone country code selects (native <select> near tel inputs)
    for (const sel of document.querySelectorAll<HTMLSelectElement>('select')) {
      if (sel.options.length < 100) continue;
      const parent = sel.closest('div, li, fieldset, section');
      if (parent?.querySelector('input[type="tel"]')) {
        groupedElements.add(sel);
      }
    }

    // Group checkboxes/radios inside fieldsets (e.g., "Working Location" checkbox group)
    scanFieldsetGroups(results, groupedElements, 'greenhouse');

    scanIndividualElements(results, seenLabels, groupedElements, 'greenhouse');
    classifyByContext(results);

    return results;
  },
};
