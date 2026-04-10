import type { FieldContext, MLClassifyResponse, MLScoreOptionsResponse } from '@/lib/ml/types';
import type { ScanResult, WidgetType } from '../types';

function widgetToInputType(wt: WidgetType): string {
  switch (wt) {
    case 'plain-text':
    case 'datepicker':
    case 'file-upload':
    case 'workday-date':
      return 'text';
    case 'native-select':
      return 'select';
    case 'react-select':
    case 'autocomplete':
    case 'workday-dropdown':
    case 'workday-multiselect':
      return 'combobox';
    case 'checkbox':
      return 'checkbox';
    case 'checkbox-group':
    case 'workday-virtualized-checkbox':
      return 'radio-group';
    default:
      return wt;
  }
}

const ML_CONFIDENCE_HIGH = 0.5;
const ML_CONFIDENCE_LOW = 0.3;

const LOW_THRESHOLD_CATEGORIES = new Set([
  'email',
  'phone',
  'resume',
  'coverLetter',
  'linkedin',
  'github',
  'twitter',
  'portfolio',
  'firstName',
  'lastName',
  'fullName',
  'location',
  'country',
  'workAuth',
  'sponsorship',
  'canWorkFromLocation',
]);

export interface MLResult {
  category: string;
  confidence: number;
}

/**
 * Batch classify fields via the ML model in the service worker.
 * Returns a map of field index → { category, confidence } for fields above threshold.
 */
export async function classifyWithML(
  fields: ScanResult[],
): Promise<{ map: Map<number, MLResult>; available: boolean }> {
  const map = new Map<number, MLResult>();
  if (fields.length === 0) return { map, available: true };

  const contexts: FieldContext[] = fields.map((f) => ({
    label: f.label,
    type: widgetToInputType(f.widgetType),
    options: f.groupLabels,
    placeholder: (f.element as HTMLInputElement).placeholder || undefined,
    name: (f.element as HTMLInputElement).name || undefined,
    ariaLabel: (f.element as HTMLElement).getAttribute('aria-label') || undefined,
    sectionHeading: f.sectionHeading || undefined,
  }));

  try {
    const response: MLClassifyResponse = await chrome.runtime.sendMessage({
      type: 'ML_CLASSIFY',
      fields: contexts,
    });

    if (response?.error) return { map, available: false };

    if (response?.classifications) {
      for (let i = 0; i < response.classifications.length; i++) {
        const c = response.classifications[i]!;
        if (!c.category) continue;
        const threshold = LOW_THRESHOLD_CATEGORIES.has(c.category)
          ? ML_CONFIDENCE_LOW
          : ML_CONFIDENCE_HIGH;
        if (c.confidence >= threshold) {
          map.set(i, { category: c.category, confidence: c.confidence });
        }
      }
    }
    return { map, available: true };
  } catch {
    return { map, available: false };
  }
}

/**
 * Score options for a field using the ML model's scoring head.
 * Returns the best matching option index and score.
 */
export async function scoreOptionsWithML(
  question: string,
  profileValue: string,
  options: string[],
): Promise<{ bestIndex: number; score: number }> {
  try {
    const response: MLScoreOptionsResponse = await chrome.runtime.sendMessage({
      type: 'ML_SCORE_OPTIONS',
      question,
      profileValue,
      options,
    });
    if (response?.error) return { bestIndex: -1, score: 0 };
    return { bestIndex: response.bestIndex, score: response.score };
  } catch {
    return { bestIndex: -1, score: 0 };
  }
}
