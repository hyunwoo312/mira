export type InputType =
  | 'text'
  | 'select'
  | 'checkbox'
  | 'radio-group'
  | 'combobox'
  | 'button-group'
  | 'file';

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
  | 'file-upload'
  | 'workday-dropdown'
  | 'workday-multiselect'
  | 'workday-date'
  | 'workday-virtualized-checkbox';

export type SkipReason = 'already-filled' | 'no-value' | 'file-on-text' | 'wrong-type';
export type FailReason = 'no-option-match' | 'no-dropdown' | 'select-failed' | 'element-error';

export type FillOutcome =
  | { status: 'filled'; matchedOption?: string; discoveredOptions?: string[] }
  | { status: 'skipped'; reason: SkipReason }
  | { status: 'failed'; reason: FailReason; discoveredOptions?: string[] };

export type ATSName = 'workday' | 'greenhouse' | 'lever' | 'ashby' | 'generic';

export interface ScanResult {
  label: string;
  description?: string;
  sectionHeading?: string;
  category: string | null;
  widgetType: WidgetType;
  ats: ATSName;
  element: HTMLElement;
  groupElements?: HTMLElement[];
  groupLabels?: string[];
  classifiedBy?: 'static-map' | 'options' | 'heuristic' | 'ml';
  mlConfidence?: number;
}

export interface ATSScanner {
  name: ATSName;
  detect(): boolean;
  scan(): ScanResult[];
}

export interface FillerOptions {
  ats: ATSName;
  category?: string;
  userLocation?: string;
  description?: string;
  placeholder?: string;
}

export interface SearchQuery {
  primary: string;
  fallback?: string;
}

export interface ClassifyResult {
  index: number;
  confidence: number;
  matchedText: string;
}

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
  atsHint?:
    | 'workday-dropdown'
    | 'workday-multiselect'
    | 'workday-date'
    | 'workday-virtualized-checkbox';
}

export interface FieldResult {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'static-map' | 'options' | 'heuristic' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
  // Debug metadata (only included in copy log, not displayed in UI)
  widgetType?: WidgetType;
  category?: string;
  sectionHeading?: string;
  groupLabels?: string[];
  elementHint?: string; // e.g. "input[type=text]#first_name"
  skipReason?: SkipReason;
  failReason?: FailReason;
  attemptedValue?: string; // fillMap value that was tried
}

export interface FillResult {
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  logs: FieldResult[];
  mlAvailable: boolean;
  durationMs: number;
  ats?: ATSName;
  totalFormElements?: number;
}
