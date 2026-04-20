import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { icims } from '../../scanners/icims';
import { lookupIcimsCategory, extractIcimsSuffix } from '../../icims/utils';

describe('icims utils', () => {
  describe('extractIcimsSuffix', () => {
    it.each([
      ['PersonProfileFields.FirstName', 'FirstName'],
      ['PersonProfileFields.FirstName_rcf12345', 'FirstName'],
      ['CandProfileFields.School', 'School'],
      ['CandProfileFields.Employer_rcf9999', 'Employer'],
      ['Fields.AddressStreet1', 'AddressStreet1'],
    ])('%s → %s', (id, expected) => {
      expect(extractIcimsSuffix(id)).toBe(expected);
    });

    it.each([['randomId'], ['button-submit'], ['rcf12345'], ['']])('%s → null', (id) => {
      expect(extractIcimsSuffix(id)).toBeNull();
    });
  });

  describe('lookupIcimsCategory', () => {
    it.each([
      ['PersonProfileFields.FirstName', 'firstName'],
      ['PersonProfileFields.LastName', 'lastName'],
      ['PersonProfileFields.MiddleName', '__skip__'],
      ['PersonProfileFields.EmailAddress', 'email'],
      ['PersonProfileFields.AddressStreet1', 'address1'],
      ['PersonProfileFields.AddressCity', 'city'],
      ['PersonProfileFields.AddressZip', 'zipCode'],
      ['PersonProfileFields.LinkedInURL', 'linkedin'],
      ['CandProfileFields.School', 'school'],
      ['CandProfileFields.Degree', 'degree'],
      ['CandProfileFields.Employer_rcf99', 'company'],
      ['CandProfileFields.JobTitle', 'jobTitle'],
    ])('%s → %s', (id, expected) => {
      expect(lookupIcimsCategory(id)).toBe(expected);
    });

    it.each([['randomId'], ['PersonProfileFields.Unknown'], ['']])('%s → null', (id) => {
      expect(lookupIcimsCategory(id)).toBeNull();
    });
  });
});

describe('icims scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('should detect by ProfileFields DOM signature', () => {
      document.body.innerHTML = '<input id="PersonProfileFields.FirstName" />';
      expect(icims.detect()).toBe(true);
    });

    it('should detect by iCIMS_Anchor class', () => {
      document.body.innerHTML = '<div class="iCIMS_Anchor"></div>';
      expect(icims.detect()).toBe(true);
    });

    it('should not detect on generic page', () => {
      document.body.innerHTML = '<form><input /></form>';
      expect(icims.detect()).toBe(false);
    });
  });

  describe('scan', () => {
    it('should map PersonProfileFields suffixes via static map', () => {
      document.body.innerHTML = `
        <div class="icims-form">
          <label for="PersonProfileFields.FirstName">First Name</label>
          <input type="text" id="PersonProfileFields.FirstName" />
          <label for="PersonProfileFields.LastName">Last Name</label>
          <input type="text" id="PersonProfileFields.LastName" />
          <label for="PersonProfileFields.EmailAddress">Email</label>
          <input type="text" id="PersonProfileFields.EmailAddress" />
        </div>
      `;
      const results = icims.scan();
      const byCategory = new Map(results.map((r) => [r.category, r]));
      expect(byCategory.get('firstName')?.classifiedBy).toBe('static-map');
      expect(byCategory.get('lastName')).toBeDefined();
      expect(byCategory.get('email')).toBeDefined();
    });

    it('should skip MiddleName entries', () => {
      document.body.innerHTML = `
        <div>
          <label for="PersonProfileFields.MiddleName">Middle</label>
          <input type="text" id="PersonProfileFields.MiddleName" />
        </div>
      `;
      const results = icims.scan();
      expect(results.find((r) => r.category === 'firstName')).toBeUndefined();
      expect(results.every((r) => r.category !== '__skip__')).toBe(true);
    });

    it('should emit icims-typeahead for dropdown anchors', () => {
      document.body.innerHTML = `
        <div class="iCIMS_TextInputField">
          <label for="CandProfileFields.School_Input">School</label>
          <input type="text" id="CandProfileFields.School_Input" />
          <a id="CandProfileFields.School_icimsDropdown" href="javascript:;">Select...</a>
        </div>
      `;
      const results = icims.scan();
      const field = results.find((r) => r.widgetType === 'icims-typeahead');
      expect(field).toBeDefined();
      expect(field!.element.tagName).toBe('A');
    });

    it('should convert AddressCountry select-with-typeahead to icims-typeahead', () => {
      // Real DOM structure captured from AMD iCIMS
      document.body.innerHTML = `
        <div class="PersonProfileFields.Addresses1570139 iCIMS_TableRow iCIMS_FieldRow_Inline">
          <div class="iCIMS_InfoField iCIMS_InfoField_Candidate iCIMS_CollectionField iCIMS_TableCell">
            <label id="label_1570139_PersonProfileFields.AddressCountry" for="1570139_PersonProfileFields.AddressCountry">
              <span class="iCIMS_LabelText">Country/Region/Location</span>
            </label>
          </div>
          <div class="iCIMS_InfoData iCIMS_InfoData_Candidate iCIMS_CollectionField iCIMS_TableCell">
            <select id="1570139_PersonProfileFields.AddressCountry"
                    class="iCIMS_Forms_Global customFieldContainer dropdown-hide"
                    icimsdropdown-enabled="1">
              <option legacy="true"></option>
            </select>
            <a id="1570139_PersonProfileFields.AddressCountry_icimsDropdown"
               class="dropdown-select" role="combobox">
              <span class="dropdown-text">
                <span class="dropdown-placeholder">— Make a Selection —</span>
              </span>
            </a>
          </div>
        </div>
      `;
      const results = icims.scan();
      const country = results.find((r) => r.category === 'country');
      expect(country).toBeDefined();
      expect(country!.widgetType).toBe('icims-typeahead');
      expect(country!.element.tagName).toBe('A');
    });

    it('should emit icims-date for triple-input date containers', () => {
      document.body.innerHTML = `
        <div class="iCIMS_TextInputField">
          <label>Start Date</label>
          <input type="text" id="CandProfileFields.StartDate_Month" />
          <input type="text" id="CandProfileFields.StartDate_Date" />
          <input type="text" id="CandProfileFields.StartDate_Year" />
        </div>
      `;
      const results = icims.scan();
      const field = results.find((r) => r.widgetType === 'icims-date');
      expect(field).toBeDefined();
    });
  });
});
