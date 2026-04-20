import type { ScanResult, FillOutcome, FillerOptions } from '../types';
import { fillText, fillDatepicker } from './text';
import { fillNativeSelect, fillReactSelect, fillAutocomplete } from './select';
import { fillRadioGroup, fillCheckboxGroup, fillButtonGroup, fillCheckbox } from './group';
import { fillFile } from './file';
import {
  fillWorkdayDropdown,
  fillWorkdayDate,
  fillWorkdayVirtualizedCheckbox,
  fillWorkdayMultiselect,
} from './workday';
import { fillIcimsTypeahead, fillIcimsDate } from './icims';

export { fillText, fillDatepicker } from './text';
export { fillNativeSelect, fillReactSelect, fillAutocomplete } from './select';
export { fillRadioGroup, fillCheckboxGroup, fillButtonGroup, fillCheckbox } from './group';
export { fillFile } from './file';

export async function fillField(
  field: ScanResult,
  value: string,
  opts: FillerOptions,
): Promise<FillOutcome> {
  const category = opts.category;
  const isLocation = category === 'location' || category === 'city' || category === 'state';

  switch (field.widgetType) {
    case 'plain-text':
      return fillText(field.element, value, category);

    case 'datepicker':
      return fillDatepicker(field.element, value);

    case 'native-select':
      return fillNativeSelect(field.element, value, category, field.label);

    case 'react-select':
      return fillReactSelect(field.element, value, isLocation, category, field.label);

    case 'autocomplete':
      return fillAutocomplete(
        field.element,
        value,
        isLocation,
        category,
        opts.description,
        field.label,
      );

    case 'radio-group':
      return fillRadioGroup(field.groupElements!, field.groupLabels!, value, category, field.label);

    case 'checkbox':
      return fillCheckbox(field.element, value);

    case 'checkbox-group':
      return fillCheckboxGroup(
        field.groupElements!,
        field.groupLabels!,
        value,
        category,
        field.label,
      );

    case 'button-group':
      return fillButtonGroup(
        field.groupElements!,
        field.groupLabels!,
        value,
        category,
        field.label,
      );

    case 'file-upload':
      return fillFile(field.element, value);

    case 'workday-dropdown':
      return fillWorkdayDropdown(field.element, value, category);

    case 'workday-date':
      return fillWorkdayDate(field.element, value);

    case 'workday-virtualized-checkbox':
      return fillWorkdayVirtualizedCheckbox(
        field.element,
        field.groupElements ?? [],
        field.groupLabels ?? [],
        value,
        category,
      );

    case 'workday-multiselect':
      return fillWorkdayMultiselect(field.element, value, category, field.label);

    case 'icims-typeahead':
      return fillIcimsTypeahead(field.element, value, category, field.label);

    case 'icims-date':
      return fillIcimsDate(field.element, value);

    default:
      return { status: 'skipped', reason: 'wrong-type' };
  }
}
