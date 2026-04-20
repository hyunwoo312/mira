import type { ScanResult } from '../types';
import { classifyByOptions } from './options';
import { classifyField } from './patterns';
import { classifyWithML } from './ml';
import { bridgeGetSelectState } from '../bridge';
import { pruneWorkSectionAddresses } from '../scanners/shared';

export { classifyByOptions } from './options';
export { classifyField } from './patterns';
export { classifyWithML } from './ml';

/**
 * Populate groupLabels for react-select / autocomplete fields by peeking at
 * the React-internal option state. Scanners can't walk into React state
 * reliably during scan (options are only visible after the dropdown opens),
 * but we can ask the bridge right before ML classification so the ML sees
 * the same Yes/No signal the field will actually present.
 *
 * Fields without accessible state (lazy-loaded, async, or non-react-select
 * widgets) are left unchanged — the model gracefully degrades to label-only
 * classification as before.
 */
async function enrichSelectOptions(fields: ScanResult[]): Promise<void> {
  const needsEnrich = fields.filter(
    (f) =>
      (f.widgetType === 'react-select' || f.widgetType === 'autocomplete') &&
      (!f.groupLabels || f.groupLabels.length === 0),
  );
  if (needsEnrich.length === 0) return;

  await Promise.all(
    needsEnrich.map(async (field) => {
      try {
        const state = await bridgeGetSelectState(field.element);
        if (state && state.options.length > 0 && state.options.length <= 20) {
          field.groupLabels = state.options.map((o) => o.label);
        }
      } catch {
        /* bridge unavailable — fall back to label-only classification */
      }
    }),
  );
}

export interface ClassifyOptions {
  mlDisabled?: boolean;
}

/**
 * Run three-tier classification on an array of ScanResult fields.
 * Mutates fields in place (sets category, classifiedBy, mlConfidence).
 * Returns whether the ML model was available.
 */
export async function classifyFields(
  fields: ScanResult[],
  opts: ClassifyOptions = {},
): Promise<boolean> {
  // Populate react-select/autocomplete options up-front (via React state
  // peek) so downstream heuristics — options-first, single-option
  // acknowledgment — can use them. Previously this ran only before the ML
  // batch, which meant single-option formality dropdowns (e.g. a
  // "Thank you" react-select) never hit the acknowledgment heuristic and
  // leaked into ML with unrelated top predictions.
  const unclassifiedSelects = fields.filter((f) => !(f.category && f.classifiedBy));
  await enrichSelectOptions(unclassifiedSelects);

  const needML: ScanResult[] = [];

  for (const field of fields) {
    // Pre-classified fields (e.g., Workday static field map) — skip all tiers
    if (field.category && field.classifiedBy) continue;

    // Tier 1: Options-first (selects, radios, button-groups with known option signatures)
    if (field.groupLabels && field.groupLabels.length >= 2) {
      const cat = classifyByOptions(field.groupLabels);
      if (cat) {
        field.category = cat;
        field.classifiedBy = 'options';
        continue;
      }
    }

    // Tier 2: Heuristic patterns (short unambiguous labels)
    const heuristicCat = classifyField(field.label);
    if (heuristicCat) {
      field.category = heuristicCat;
      field.classifiedBy = 'heuristic';
      continue;
    }

    // Tier 2b: Single-option acknowledgment fields (required toggles with no data)
    // Single checkboxes with long legal text, or groups where the only option is "I Acknowledge" etc.
    if (field.widgetType === 'checkbox' && field.label.length > 80) {
      field.category = 'consent';
      field.classifiedBy = 'heuristic';
      continue;
    }
    // Single-option acknowledgment fields. Covers checkbox/radio-group as well
    // as react-select/autocomplete (options populated via enrichSelectOptions).
    // Examples: "I acknowledge..."/"I agree..."/"Thank you" formalities where
    // the only valid input is the acknowledgment option itself — no profile
    // data applies, classify as consent so the filler picks the one option.
    if (
      (field.widgetType === 'checkbox' ||
        field.widgetType === 'radio-group' ||
        field.widgetType === 'react-select' ||
        field.widgetType === 'autocomplete') &&
      field.groupLabels &&
      field.groupLabels.length === 1 &&
      /^(yes[,.]?\s+)?(i\s+)?(acknowledge|agree|accept|confirm|understand|consent|read|thank\s*you|ok(?:ay)?|got\s*it|continue|proceed)/i.test(
        field.groupLabels[0]!,
      )
    ) {
      field.category = 'consent';
      field.classifiedBy = 'heuristic';
      continue;
    }

    // Tier 3: Queue for ML batch
    needML.push(field);
  }

  let mlAvailable = !opts.mlDisabled;
  if (needML.length > 0 && !opts.mlDisabled) {
    const result = await classifyWithML(needML);
    mlAvailable = result.available;
    for (let i = 0; i < needML.length; i++) {
      const mlResult = result.map.get(i);
      if (mlResult) {
        needML[i]!.category = mlResult.category;
        needML[i]!.classifiedBy = 'ml';
        needML[i]!.mlConfidence = mlResult.confidence;
      }
    }
  }

  // Post-ML validation: textareas are almost never standard fields.
  // Only a few categories legitimately use textareas (e.g., workDescription).
  // Reject all other ML predictions on textareas to prevent misclassification.
  const TEXTAREA_ALLOWED_CATEGORIES = new Set([
    'workDescription',
    'customQuestion',
    'unknown',
    '__skip__',
  ]);
  for (const field of needML) {
    if (!field.category) continue;
    if (
      field.element instanceof HTMLTextAreaElement &&
      !TEXTAREA_ALLOWED_CATEGORIES.has(field.category)
    ) {
      field.category = null;
      field.classifiedBy = undefined;
      field.mlConfidence = undefined;
    }
  }

  // Post-ML validation: if ML chose a category that contradicts the field's options,
  // override with Tier 2 patterns. E.g., ML says "race" but options are Yes/No → isHispanic.
  const OPTION_SPECIFIC_CATEGORIES = new Set([
    'race',
    'gender',
    'degree',
    'veteranStatus',
    'disabilityStatus',
  ]);
  for (const field of needML) {
    if (!field.category || !OPTION_SPECIFIC_CATEGORIES.has(field.category)) continue;
    if (!field.groupLabels || field.groupLabels.length < 2) continue;
    const optionsLower = field.groupLabels.map((o) => o.toLowerCase().trim());
    const isGenericYesNo = optionsLower.every((o) =>
      /^(yes|no|decline|i don'?t|prefer not|not applicable)/.test(o),
    );
    if (isGenericYesNo) {
      const patternCat = classifyField(field.label);
      if (patternCat) {
        field.category = patternCat;
        field.classifiedBy = 'heuristic';
      }
    }
  }

  // Post-classification: scrub home-address categories that landed on fields
  // inside work-experience sections (the value belongs to the employer, not
  // the user). Runs here so heuristic- and ML-classified fields are covered
  // in addition to static-map ones.
  pruneWorkSectionAddresses(fields);

  return mlAvailable;
}
