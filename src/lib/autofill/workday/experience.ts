import type { FillableField, FillOutcome, InputType, FieldResult, WidgetType } from '../types';
import type { Profile } from '../../schema';
import { bridgeSetText } from '../bridge';
import {
  detectWorkdayPage,
  lookupCategory,
  detectWorkdayWidget,
  type WorkdayWidgetHint,
} from './utils';
import { fillWorkdayDropdown, fillWorkdayDate, fillWorkdayMultiselect } from '../fillers/workday';
import { elementHint } from '../pipeline';

function staticMapLogMeta(
  field: FillableField,
): Pick<FieldResult, 'widgetType' | 'category' | 'elementHint'> {
  const widgetType: WidgetType =
    field.atsHint === 'workday-dropdown'
      ? 'workday-dropdown'
      : field.atsHint === 'workday-multiselect'
        ? 'workday-multiselect'
        : field.atsHint === 'workday-date'
          ? 'workday-date'
          : field.atsHint === 'workday-virtualized-checkbox'
            ? 'workday-virtualized-checkbox'
            : 'plain-text';
  return {
    widgetType,
    category: field.category ?? undefined,
    elementHint: elementHint(field.element),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Track automation IDs that have been filled by the orchestrator.
 * Shared with scanners/workday.ts to prevent duplicate fills.
 */
export const filledAutomationIds = new Set<string>();

export function isWorkdayFieldFilled(automationId: string): boolean {
  return filledAutomationIds.has(automationId);
}

export async function prepareAndFillWorkdayExperience(
  profile: Profile,
  signal?: AbortSignal,
): Promise<FieldResult[]> {
  const page = detectWorkdayPage();
  if (page !== 'myExperience') return [];

  const logs: FieldResult[] = [];
  filledAutomationIds.clear();

  // ── Work Experience ──
  for (let i = 0; i < profile.workExperience.length; i++) {
    if (signal?.aborted) break;
    const work = profile.workExperience[i]!;
    if (!work.title && !work.company) continue;

    const section = findSectionByLabel('Work Experience');
    if (!section) break;

    const addBtn = findAddButton(section);
    if (!addBtn) break;
    addBtn.click();
    await sleep(800);

    const workFields = scanWorkdayFieldsInContainer(section, i);
    for (const field of workFields) {
      if (signal?.aborted) break;
      const value = resolveWorkEntryValue(field.category!, work);
      if (!value) continue;
      try {
        const outcome = await fillSingleField(field, value);
        if (outcome.status === 'filled') {
          logs.push({
            field: field.label,
            value,
            status: 'filled',
            source: 'static-map',
            ...staticMapLogMeta(field),
          });
          const container = field.element.closest('[data-automation-id^="formField-"]');
          const aid = container?.getAttribute('data-automation-id');
          if (aid) filledAutomationIds.add(aid);
        }
      } catch {
        /* Continue */
      }
      await sleep(150);
    }
  }

  // ── Education ──
  for (let i = 0; i < profile.education.length; i++) {
    if (signal?.aborted) break;
    const edu = profile.education[i]!;
    if (!edu.school) continue;

    const section = findSectionByLabel('Education');
    if (!section) break;

    const addBtn = findAddButton(section);
    if (!addBtn) break;
    addBtn.click();
    await sleep(800);

    const eduFields = scanWorkdayFieldsInContainer(section, i);
    for (const field of eduFields) {
      if (signal?.aborted) break;
      const value = resolveEduEntryValue(field.category!, edu);
      if (!value) continue;
      try {
        const outcome = await fillSingleField(field, value);
        if (outcome.status === 'filled') {
          logs.push({
            field: field.label,
            value,
            status: 'filled',
            source: 'static-map',
            ...staticMapLogMeta(field),
          });
          const container = field.element.closest('[data-automation-id^="formField-"]');
          const aid = container?.getAttribute('data-automation-id');
          if (aid) filledAutomationIds.add(aid);
        }
      } catch {
        /* Continue */
      }
      await sleep(150);
    }
  }

  // ── Websites ──
  const urls = [profile.linkedin, profile.github, profile.portfolio].filter(Boolean);
  for (const url of urls) {
    if (signal?.aborted) break;
    const section = findSectionByLabel('Websites');
    if (!section) break;

    const addBtn = findAddButton(section);
    if (!addBtn) break;
    addBtn.click();
    await sleep(500);

    const urlInputs = section.querySelectorAll<HTMLInputElement>(
      '[data-automation-id="formField-url"] input[type="text"]',
    );
    const lastInput = urlInputs[urlInputs.length - 1];
    if (lastInput && !lastInput.value) {
      try {
        await bridgeSetText(lastInput, url);
        logs.push({
          field: 'Website URL',
          value: url,
          status: 'filled',
          source: 'static-map',
          widgetType: 'plain-text',
          category: 'websiteUrl',
          elementHint: elementHint(lastInput),
        });
      } catch {
        /* Continue */
      }
    }
  }

  // Mark ALL url field containers as filled so the main scanner skips them
  const allUrlContainers = document.querySelectorAll('[data-automation-id^="formField-url"]');
  for (const container of allUrlContainers) {
    const aid = container.getAttribute('data-automation-id');
    if (aid) filledAutomationIds.add(aid);
  }

  return logs;
}

// ── Internal helpers ────────────────────────────────────────────────────

function findSectionByLabel(label: string): HTMLElement | null {
  const headings = document.querySelectorAll<HTMLElement>('[id$="-section"]');
  for (const h of headings) {
    if (h.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
      return h.closest('[role="group"]');
    }
  }
  return null;
}

function findAddButton(section: HTMLElement): HTMLButtonElement | null {
  const buttons = section.querySelectorAll<HTMLButtonElement>('[data-automation-id="add-button"]');
  return buttons.length > 0 ? buttons[buttons.length - 1]! : null;
}

function resolveWorkdayLabel(container: HTMLElement): string {
  const directLabel = container.querySelector(':scope > label');
  if (directLabel?.textContent?.trim()) return directLabel.textContent.trim();
  const fieldset = container.querySelector('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const richText = legend.querySelector('[data-automation-id="richText"]');
      if (richText?.textContent?.trim()) return richText.textContent.trim();
      const plainLabel = legend.querySelector('label');
      if (plainLabel?.textContent?.trim()) return plainLabel.textContent.trim();
      if (legend.textContent?.trim()) return legend.textContent.trim();
    }
  }
  const button = container.querySelector('button[aria-haspopup="listbox"]');
  if (button) {
    const ariaLabel = button.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.replace(/\s*(Select One|Required)\s*/gi, '').trim();
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

function resolveWorkdayInputType(
  container: HTMLElement,
  widgetHint: WorkdayWidgetHint | null,
): InputType {
  if (widgetHint === 'workday-dropdown' || widgetHint === 'workday-multiselect') return 'combobox';
  if (widgetHint === 'workday-date') return 'text';
  if (widgetHint === 'workday-virtualized-checkbox') return 'radio-group';
  const input = container.querySelector('input');
  if (input) {
    if (input.type === 'checkbox') return 'checkbox';
    if (input.type === 'radio') return 'radio-group';
    if (input.type === 'file') return 'file';
    return 'text';
  }
  if (container.querySelector('textarea')) return 'text';
  if (container.querySelector('select')) return 'select';
  return 'text';
}

function resolveWorkdayElement(
  container: HTMLElement,
  widgetHint: WorkdayWidgetHint | null,
): HTMLElement | null {
  if (widgetHint === 'workday-dropdown')
    return container.querySelector('button[aria-haspopup="listbox"]');
  if (widgetHint === 'workday-multiselect')
    return container.querySelector('[data-uxi-widget-type="multiselect"] input');
  if (widgetHint === 'workday-date')
    return container.querySelector('[data-automation-id="dateInputWrapper"]');
  if (widgetHint === 'workday-virtualized-checkbox')
    return container.querySelector('[class*="CheckboxGroup"]') ?? container;
  return (
    container.querySelector('input:not([type="hidden"])') ??
    container.querySelector('textarea') ??
    container.querySelector('select') ??
    null
  );
}

function scanWorkdayFieldsInContainer(
  container: HTMLElement,
  _entryIndex: number,
): FillableField[] {
  const fields: FillableField[] = [];

  const panels = container.querySelectorAll<HTMLElement>(
    '[role="group"][aria-labelledby*="-panel"]',
  );
  const targetPanel = panels.length > 0 ? panels[panels.length - 1]! : container;

  const formFields = targetPanel.querySelectorAll<HTMLElement>(
    '[data-automation-id^="formField-"]',
  );

  for (const ff of formFields) {
    const automationId = ff.getAttribute('data-automation-id')!;
    const category = lookupCategory(automationId);
    if (!category || category === '__skip__') continue;

    const widgetHint = detectWorkdayWidget(ff);
    const element = resolveWorkdayElement(ff, widgetHint);
    if (!element) continue;

    const label = resolveWorkdayLabel(ff);
    if (!label) continue;

    fields.push({
      type: resolveWorkdayInputType(ff, widgetHint),
      element,
      label,
      category,
      classifiedBy: 'heuristic',
      atsHint: widgetHint ?? undefined,
    });
  }

  return fields;
}

function resolveWorkEntryValue(category: string, work: Profile['workExperience'][0]): string {
  switch (category) {
    case 'jobTitle':
      return work.title;
    case 'company':
      return work.company;
    case 'workLocation':
      return work.location ?? '';
    case 'currentlyWorkHere':
      return work.current ? 'Yes' : '';
    case 'workStartDate':
      return work.startMonth && work.startYear ? `${work.startMonth}/${work.startYear}` : '';
    case 'workEndDate':
      if (work.current) return '';
      return work.endMonth && work.endYear ? `${work.endMonth}/${work.endYear}` : '';
    case 'workDescription':
      return work.description;
    default:
      return '';
  }
}

function resolveEduEntryValue(category: string, edu: Profile['education'][0]): string {
  switch (category) {
    case 'school':
      return edu.school;
    case 'degree':
      return edu.degree;
    case 'fieldOfStudy':
      return edu.fieldOfStudy;
    case 'gpa':
      return edu.gpa;
    case 'eduStartYear':
      return edu.startYear ? String(edu.startYear) : '';
    case 'eduGradYear':
      return edu.gradYear ? String(edu.gradYear) : '';
    default:
      return '';
  }
}

async function fillSingleField(field: FillableField, value: string): Promise<FillOutcome> {
  const hint = field.atsHint;
  if (hint === 'workday-dropdown')
    return fillWorkdayDropdown(field.element, value, field.category!);
  if (hint === 'workday-date') return fillWorkdayDate(field.element, value);
  if (hint === 'workday-multiselect')
    return fillWorkdayMultiselect(field.element, value, field.category ?? undefined, field.label);

  if (field.type === 'checkbox') {
    const checkbox = field.element as HTMLInputElement;
    const shouldCheck = /^(yes|true|1)$/i.test(value);
    if (shouldCheck && !checkbox.checked) {
      checkbox.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      checkbox.click();
      await sleep(50);
    }
    return { status: 'filled' };
  }

  field.element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await bridgeSetText(field.element, value);
  await sleep(100);
  return { status: 'filled' };
}
