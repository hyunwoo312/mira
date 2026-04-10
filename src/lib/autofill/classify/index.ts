import type { ScanResult } from '../types';
import { classifyByOptions } from './options';
import { classifyField } from './patterns';
import { classifyWithML } from './ml';

export { classifyByOptions } from './options';
export { classifyField } from './patterns';
export { classifyWithML } from './ml';

/**
 * Run three-tier classification on an array of ScanResult fields.
 * Mutates fields in place (sets category, classifiedBy, mlConfidence).
 * Returns whether the ML model was available.
 */
export async function classifyFields(fields: ScanResult[]): Promise<boolean> {
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
    if (
      (field.widgetType === 'checkbox' || field.widgetType === 'radio-group') &&
      field.groupLabels &&
      field.groupLabels.length === 1 &&
      /^(yes[,.]?\s+)?(i\s+)?(acknowledge|agree|accept|confirm|understand|consent)/i.test(
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

  // Batch ML classification
  let mlAvailable = true;
  if (needML.length > 0) {
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

  return mlAvailable;
}
