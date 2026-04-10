import type { ATSScanner, ScanResult, WidgetType } from '../types';
import { lookupCategory, detectWorkdayWidget, type WorkdayWidgetHint } from '../workday/utils';
import { filledAutomationIds } from '../workday/experience';

// Re-use Workday-internal helpers that aren't exported from workday.ts
// We inline the necessary logic here to avoid coupling to legacy internals.

/**
 * Extract a concise label from a Workday rich-text element.
 * Rich-text legends can contain entire privacy policies — we want just the
 * heading or the actionable text (e.g., "GDPR Notice" or "I have read and
 * agree to the terms"), not the full legal wall.
 */
function extractRichTextLabel(richText: Element): string {
  // Prefer the first bold/strong element (usually the heading)
  const firstBold = richText.querySelector('b, strong');
  if (firstBold?.textContent?.trim()) {
    // If there's a second bold (e.g., "I have read and agree..."), combine them
    const allBolds = richText.querySelectorAll('b, strong');
    if (allBolds.length > 1) {
      const last = allBolds[allBolds.length - 1];
      const lastText = last?.textContent?.trim().replace(/\*$/, '').trim();
      if (lastText && lastText !== firstBold.textContent?.trim()) {
        return `${firstBold.textContent.trim()} ${lastText}`;
      }
    }
    return firstBold.textContent.trim();
  }

  // Fall back to first paragraph
  const firstP = richText.querySelector('p');
  if (firstP?.textContent?.trim()) return firstP.textContent.trim();

  // Last resort: full text, truncated
  const full = richText.textContent?.trim() ?? '';
  return full.length > 200 ? full.slice(0, 200) : full;
}

/** Resolve the label text for a Workday form field container. */
function resolveWorkdayLabel(container: HTMLElement): string {
  const directLabel = container.querySelector(':scope > label');
  if (directLabel?.textContent?.trim()) return directLabel.textContent.trim();

  const fieldset = container.querySelector('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const richText = legend.querySelector('[data-automation-id="richText"]');
      if (richText) return extractRichTextLabel(richText);
      const plainLabel = legend.querySelector('label');
      if (plainLabel?.textContent?.trim()) return plainLabel.textContent.trim();
      if (legend.textContent?.trim()) return legend.textContent.trim();
    }
  }

  const parentFieldset = container.closest('fieldset');
  if (parentFieldset) {
    const legend = parentFieldset.querySelector('legend');
    if (legend) {
      const richText = legend.querySelector('[data-automation-id="richText"]');
      if (richText) return extractRichTextLabel(richText);
      const plainLabel = legend.querySelector('label');
      if (plainLabel?.textContent?.trim()) return plainLabel.textContent.trim();
      if (legend.textContent?.trim()) return legend.textContent.trim();
    }
  }

  const button = container.querySelector('button[aria-haspopup="listbox"]');
  if (button) {
    const ariaLabel = button.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.replace(/\s*(Select One|Required)\s*/gi, '').trim();
    }
  }

  const input = container.querySelector('input, select, textarea, button');
  if (input?.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (forLabel?.textContent?.trim()) return forLabel.textContent.trim();
  }

  const anyLabel = container.querySelector('label');
  if (anyLabel?.textContent?.trim()) return anyLabel.textContent.trim();

  return '';
}

/** Map Workday widget hint to WidgetType. */
function resolveWorkdayWidgetType(
  container: HTMLElement,
  widgetHint: WorkdayWidgetHint | null,
): WidgetType {
  if (widgetHint) return widgetHint;

  const input = container.querySelector('input');
  if (input) {
    if (input.type === 'checkbox') return 'checkbox';
    if (input.type === 'radio') return 'radio-group';
    if (input.type === 'file') return 'file-upload';
    if (input.type === 'date') return 'datepicker';
    return 'plain-text';
  }
  if (container.querySelector('textarea')) return 'plain-text';
  if (container.querySelector('select')) return 'native-select';
  return 'plain-text';
}

/** Find the primary interactable element inside a Workday field container. */
function resolveWorkdayElement(
  container: HTMLElement,
  widgetHint: WorkdayWidgetHint | null,
): HTMLElement | null {
  if (widgetHint === 'workday-dropdown') {
    return container.querySelector('button[aria-haspopup="listbox"]');
  }
  if (widgetHint === 'workday-multiselect') {
    return container.querySelector('[data-uxi-widget-type="multiselect"] input');
  }
  if (widgetHint === 'workday-date') {
    return container.querySelector('[data-automation-id="dateInputWrapper"]');
  }
  if (widgetHint === 'workday-virtualized-checkbox') {
    return container.querySelector('[class*="CheckboxGroup"]') ?? container;
  }
  return (
    container.querySelector('input:not([type="hidden"])') ??
    container.querySelector('textarea') ??
    container.querySelector('select') ??
    null
  );
}

/** Collect radio group elements and labels. */
function collectRadioGroup(container: HTMLElement): {
  groupElements: HTMLElement[];
  groupLabels: string[];
} | null {
  const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  if (radios.length < 2) return null;
  const labels = radios.map((r) => {
    const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
    return lbl?.textContent?.trim() ?? r.value ?? '';
  });
  return { groupElements: radios, groupLabels: labels };
}

/** Collect virtualized checkbox labels. */
function collectVirtualizedLabels(container: HTMLElement): string[] {
  const labels: string[] = [];
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const lbl = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
    if (lbl?.textContent?.trim()) labels.push(lbl.textContent.trim());
  }
  return labels;
}

export const workday: ATSScanner = {
  name: 'workday',

  detect() {
    const host = window.location.hostname;
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) return true;
    return !!document.querySelector('[data-automation-id^="applyFlow"]');
  },

  scan(): ScanResult[] {
    const results: ScanResult[] = [];
    const seenElements = new Set<HTMLElement>();

    const containers = document.querySelectorAll<HTMLElement>('[data-automation-id^="formField-"]');

    for (const container of containers) {
      const automationId = container.getAttribute('data-automation-id')!;
      if (automationId === 'formField-') continue;
      if (filledAutomationIds.has(automationId)) continue;

      const widgetHint = detectWorkdayWidget(container);
      const element = resolveWorkdayElement(container, widgetHint);
      if (!element) continue;
      if (seenElements.has(element)) continue;
      seenElements.add(element);

      const widgetType = resolveWorkdayWidgetType(container, widgetHint);

      // Skip disabled/hidden elements (except file inputs)
      if (widgetType !== 'file-upload' && element instanceof HTMLInputElement && element.disabled)
        continue;

      const label = resolveWorkdayLabel(container);
      if (!label) continue;

      const category = lookupCategory(automationId);

      const field: ScanResult = {
        label,
        category,
        widgetType,
        ats: 'workday',
        element,
        classifiedBy: category ? 'static-map' : undefined,
      };

      // Radio groups need group elements/labels
      if (widgetType === 'radio-group' && !widgetHint) {
        const group = collectRadioGroup(container);
        if (group) {
          field.groupElements = group.groupElements;
          field.groupLabels = group.groupLabels;
          field.element = group.groupElements[0]!;
        }
      }

      // Virtualized checkbox groups need labels for matching
      if (widgetHint === 'workday-virtualized-checkbox') {
        field.groupLabels = collectVirtualizedLabels(container);
        const checkboxes = Array.from(
          container.querySelectorAll<HTMLElement>('input[type="checkbox"]'),
        );
        if (checkboxes.length > 0) {
          field.groupElements = checkboxes;
        }
      }

      results.push(field);
    }

    // SMS opt-in checkbox
    const smsCheckbox = document.querySelector<HTMLInputElement>(
      '[data-automation-id="phone-sms-opt-in"]',
    );
    if (smsCheckbox && !seenElements.has(smsCheckbox)) {
      results.push({
        widgetType: 'checkbox',
        element: smsCheckbox,
        label: 'SMS opt-in',
        category: 'smsConsent',
        ats: 'workday',
        classifiedBy: 'static-map',
      });
    }

    // File upload (Resume/CV)
    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      '[data-automation-id="file-upload-input-ref"]',
    );
    for (const fileInput of fileInputs) {
      if (seenElements.has(fileInput)) continue;
      const section = fileInput.closest('[role="group"]');
      const sectionId =
        section?.querySelector('[id*="-section"], [id*="Resume"], [id*="CV"]')?.id ?? '';
      const sectionText =
        section?.querySelector('h4, h3')?.textContent?.trim()?.toLowerCase() ?? '';
      if (
        sectionId.toLowerCase().includes('resume') ||
        sectionId.toLowerCase().includes('cv') ||
        sectionText.includes('resume') ||
        sectionText.includes('cv')
      ) {
        const uploadContainer = fileInput.closest('[data-automation-id="attachments-FileUpload"]');
        const alreadyUploaded = uploadContainer?.querySelector(
          '[data-automation-id="file-upload-successful"]',
        );
        if (alreadyUploaded) continue;

        results.push({
          widgetType: 'file-upload',
          element: fileInput,
          label: 'Resume/CV',
          category: 'resume',
          ats: 'workday',
          classifiedBy: 'static-map',
        });
      }
    }

    return results;
  },
};
