import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { greenhouse } from '../../scanners/greenhouse';

describe('greenhouse scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('should detect by #app_body', () => {
      document.body.innerHTML = '<div id="app_body"></div>';
      expect(greenhouse.detect()).toBe(true);
    });

    it('should detect by .job-app', () => {
      document.body.innerHTML = '<div class="job-app"></div>';
      expect(greenhouse.detect()).toBe(true);
    });

    it('should not detect on generic page', () => {
      document.body.innerHTML = '<form></form>';
      expect(greenhouse.detect()).toBe(false);
    });
  });

  describe('scan', () => {
    it('should scan text inputs with labels', () => {
      document.body.innerHTML = `
        <div id="app_body">
          <label for="first_name">First Name</label>
          <input type="text" id="first_name" />
          <label for="last_name">Last Name</label>
          <input type="text" id="last_name" />
        </div>
      `;
      const results = greenhouse.scan();
      expect(results.length).toBe(2);
      expect(results[0]!.label).toBe('First Name');
      expect(results[0]!.widgetType).toBe('plain-text');
      expect(results[0]!.ats).toBe('greenhouse');
      expect(results[1]!.label).toBe('Last Name');
    });

    it('should scan select elements with options', () => {
      document.body.innerHTML = `
        <div id="app_body">
          <label for="country">Country</label>
          <select id="country">
            <option value="">Select...</option>
            <option value="us">United States</option>
            <option value="ca">Canada</option>
          </select>
        </div>
      `;
      const results = greenhouse.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.widgetType).toBe('native-select');
      expect(results[0]!.groupLabels).toContain('United States');
    });

    it('should skip phone country code selects adjacent to tel inputs', () => {
      const options = Array.from(
        { length: 200 },
        (_, i) => `<option value="${i + 1}">${i + 1}</option>`,
      ).join('');
      document.body.innerHTML = `
        <div id="app_body">
          <div>
            <select id="phone_code">${options}</select>
            <input type="tel" id="phone" />
          </div>
        </div>
      `;
      const results = greenhouse.scan();
      // The tel input should be found, but the country code select should be skipped
      expect(results.every((r) => r.widgetType !== 'native-select')).toBe(true);
    });

    it('should group radio buttons by name', () => {
      document.body.innerHTML = `
        <div id="app_body">
          <fieldset>
            <legend>Gender</legend>
            <label><input type="radio" name="gender" value="male" /> Male</label>
            <label><input type="radio" name="gender" value="female" /> Female</label>
          </fieldset>
        </div>
      `;
      const results = greenhouse.scan();
      const radioField = results.find((r) => r.widgetType === 'radio-group');
      expect(radioField).toBeDefined();
      expect(radioField!.groupLabels?.length).toBe(2);
    });
  });
});
