export type InputType =
  | 'text'
  | 'select'
  | 'checkbox'
  | 'radio-group'
  | 'combobox'
  | 'button-group'
  | 'file';

/** Granular widget type determined at fill time by inspecting the live DOM. */
export type WidgetType =
  | 'plain-text'
  | 'datepicker'
  | 'native-select'
  | 'react-select'
  | 'autocomplete'
  | 'radio-group'
  | 'checkbox'
  | 'checkbox-group'
  | 'button-group'
  | 'file-upload';

export type SkipReason = 'already-filled' | 'no-value' | 'file-on-text' | 'wrong-type';
export type FailReason = 'no-option-match' | 'no-dropdown' | 'select-failed' | 'element-error';

export type FillOutcome =
  | { status: 'filled' }
  | { status: 'skipped'; reason: SkipReason }
  | { status: 'failed'; reason: FailReason };

export interface FillableField {
  type: InputType;
  element: HTMLElement;
  label: string;
  category: string | null;
  groupElements?: HTMLElement[];
  groupLabels?: string[];
  sectionHeading?: string;
  description?: string;
  classifiedBy?: 'options' | 'heuristic' | 'ml';
  mlConfidence?: number;
}

export interface FieldResult {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'options' | 'heuristic' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
}

export interface FillResult {
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  logs: FieldResult[];
  mlAvailable: boolean;
  durationMs: number;
}
