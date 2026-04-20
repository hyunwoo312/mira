import type { ATSScanner, ScanResult } from '../types';
import { scanFieldsetGroups, scanIndividualElements, classifyByContext } from './shared';

// Greenhouse indexed work/education fields use predictable ID patterns:
//   title-0, company-name-0, start-date-month-0, start-date-year-0,
//   end-date-month-0, end-date-year-0, school--0, degree--0, discipline--0,
//   current-role-0 (the "I currently work here" checkbox, sometimes with a
//   _n suffix when Greenhouse wraps the input in a checkbox-group scaffold).
// The ID alone is a strong enough signal — no need for section-heading gating,
// which fails on embedded forms where heading markup is often stripped.
const ID_CATEGORY_MAP: [RegExp, string][] = [
  [/^title-\d+$/, 'jobTitle'],
  [/^company(?:-name)?-\d+$/, 'company'],
  [/^start-date-month-\d+$/, 'workStartMonth'],
  [/^start-date-year-\d+$/, 'workStartYear'],
  [/^end-date-month-\d+$/, 'workEndMonth'],
  [/^end-date-year-\d+$/, 'workEndYear'],
  [/^school-{1,2}\d+$/, 'school'],
  [/^degree-{1,2}\d+$/, 'degree'],
  [/^discipline-{1,2}\d+$/, 'fieldOfStudy'],
  [/^current-role-\d+(?:_\d+)?$/, 'currentRole'],
];

function classifyByGreenhouseId(results: ScanResult[]): void {
  for (const field of results) {
    if (field.category) continue;
    const id = field.element.id || field.element.getAttribute('name') || '';
    if (!id) continue;
    for (const [re, category] of ID_CATEGORY_MAP) {
      if (re.test(id)) {
        field.category = category;
        field.classifiedBy = 'heuristic';
        break;
      }
    }
  }
}

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
    classifyByGreenhouseId(results);
    classifyByContext(results);

    return results;
  },
};
