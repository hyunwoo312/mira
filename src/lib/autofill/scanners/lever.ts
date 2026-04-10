import type { ATSScanner, ScanResult, ATSName } from '../types';
import {
  isVisible,
  getSectionHeading,
  resolveWidgetType,
  scanCheckboxesByContentMatch,
  scanIndividualElements,
  classifyByContext,
} from './shared';

/** Lever multiple-choice questions: CSS-hidden radios in ul[data-qa]. */
function scanLeverMultipleChoice(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const containers = document.querySelectorAll<HTMLElement>('ul[data-qa="multiple-choice"]');
  for (const ul of containers) {
    // Skip if the question container or any ancestor is hidden.
    // Lever puts EEO surveys inside div.hidden (display:none) until user selects a country.
    const question = ul.closest('.application-question, .custom-question') as HTMLElement | null;
    if (question && !isVisible(question)) continue;

    const radios = Array.from(ul.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    if (radios.length < 2) continue;

    const labels = radios.map((r) => {
      const span = r.parentElement?.querySelector('.application-answer-alternative');
      return span?.textContent?.trim() ?? r.labels?.[0]?.textContent?.trim() ?? r.value ?? '';
    });

    const labelEl = question?.querySelector('.application-label .text, .application-label');
    const questionLabel = labelEl?.textContent?.trim() ?? '';
    if (!questionLabel) continue;

    const sectionHeading = getSectionHeading(radios[0]!);

    results.push({
      widgetType: 'radio-group',
      element: radios[0]!,
      label: questionLabel,
      category: null,
      ats,
      groupElements: radios,
      groupLabels: labels,
      sectionHeading,
    });
    radios.forEach((r) => groupedElements.add(r));
  }
}

/**
 * Lever checkbox groups: .application-question containers with multiple
 * checkboxes sharing a name attribute (pronouns, race, gender, etc.).
 * Groups them as checkbox-group with the .application-label as question label.
 */
function scanLeverCheckboxGroups(
  results: ScanResult[],
  groupedElements: Set<HTMLElement>,
  ats: ATSName,
): void {
  const questions = document.querySelectorAll<HTMLElement>(
    '.application-question, .custom-question',
  );
  for (const q of questions) {
    // Skip hidden containers (ancestor display:none hides everything inside)
    if (!isVisible(q)) continue;

    const checkboxes = Array.from(
      q.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).filter((cb) => !cb.disabled && !groupedElements.has(cb));
    if (checkboxes.length < 2) continue;

    const labelEl = q.querySelector('.application-label .text, .application-label');
    const questionLabel = labelEl?.textContent?.trim() ?? '';
    if (!questionLabel) continue;

    const labels = checkboxes.map((cb) => {
      const span = cb.parentElement?.querySelector('.application-answer-alternative');
      return span?.textContent?.trim() ?? cb.labels?.[0]?.textContent?.trim() ?? cb.value ?? '';
    });

    const sectionHeading = getSectionHeading(checkboxes[0]!);
    const widgetType = resolveWidgetType(checkboxes[0]!, 'radio-group', checkboxes);

    results.push({
      widgetType,
      element: checkboxes[0]!,
      label: questionLabel,
      category: null,
      classifiedBy: undefined,
      ats,
      groupElements: checkboxes,
      groupLabels: labels,
      sectionHeading,
    });
    checkboxes.forEach((cb) => groupedElements.add(cb));
  }
}

export const lever: ATSScanner = {
  name: 'lever',

  detect() {
    const host = window.location.hostname;
    if (host.includes('lever.co') || host.includes('jobs.lever')) return true;
    return !!document.querySelector('.application-question');
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenLabels = new Set<string>();
    const groupedElements = new Set<HTMLElement>();

    // Phase: Lever multiple-choice radio groups (CSS-hidden radios)
    scanLeverMultipleChoice(results, groupedElements, 'lever');

    // Phase: Lever checkbox groups (pronouns, race, gender — grouped by .application-question)
    scanLeverCheckboxGroups(results, groupedElements, 'lever');

    // Phase: Group remaining ungrouped checkboxes by content matching
    scanCheckboxesByContentMatch(results, groupedElements, 'lever');

    // Standard individual element scan
    scanIndividualElements(results, seenLabels, groupedElements, 'lever');
    classifyByContext(results);

    // Location inputs are plain text fields that trigger an API-driven dropdown.
    // Override to autocomplete so they get routed to fillAutocomplete.
    for (const field of results) {
      if (field.widgetType !== 'plain-text') continue;
      if (/\blocation\b|where.*located|current.*location/i.test(field.label)) {
        field.widgetType = 'autocomplete';
      }
    }

    return results;
  },
};
