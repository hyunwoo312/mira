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

    it('should classify indexed work-experience fields by ID', () => {
      // Embedded Greenhouse forms label these as "Title", "Start date month*",
      // etc. without a section heading. The ID suffix `-0` is the reliable signal.
      document.body.innerHTML = `
        <div id="app_body">
          <label for="title-0">Title</label>
          <input type="text" id="title-0" />
          <label for="company-name-0">Company name</label>
          <input type="text" id="company-name-0" />
          <label for="start-date-month-0">Start date month*</label>
          <input type="text" id="start-date-month-0" />
          <label for="start-date-year-0">Start date year</label>
          <input type="text" id="start-date-year-0" />
          <label for="end-date-month-0">End date month*</label>
          <input type="text" id="end-date-month-0" />
          <label for="end-date-year-0">End date year</label>
          <input type="text" id="end-date-year-0" />
          <label for="school--0">School</label>
          <input type="text" id="school--0" />
          <label for="degree--0">Degree</label>
          <input type="text" id="degree--0" />
          <label for="discipline--0">Discipline</label>
          <input type="text" id="discipline--0" />
        </div>
      `;
      const byId = new Map(greenhouse.scan().map((r) => [r.element.id, r]));
      expect(byId.get('title-0')!.category).toBe('jobTitle');
      expect(byId.get('company-name-0')!.category).toBe('company');
      expect(byId.get('start-date-month-0')!.category).toBe('workStartMonth');
      expect(byId.get('start-date-year-0')!.category).toBe('workStartYear');
      expect(byId.get('end-date-month-0')!.category).toBe('workEndMonth');
      expect(byId.get('end-date-year-0')!.category).toBe('workEndYear');
      expect(byId.get('school--0')!.category).toBe('school');
      expect(byId.get('degree--0')!.category).toBe('degree');
      expect(byId.get('discipline--0')!.category).toBe('fieldOfStudy');
      for (const r of byId.values()) expect(r.classifiedBy).toBe('heuristic');
    });

    it('should classify current-role checkbox by ID (with or without _n suffix)', () => {
      document.body.innerHTML = `
        <div id="app_body">
          <label for="current-role-0">Current role</label>
          <input type="checkbox" id="current-role-0" />
          <label for="current-role-1_1">I currently work here</label>
          <input type="checkbox" id="current-role-1_1" />
        </div>
      `;
      const byId = new Map(greenhouse.scan().map((r) => [r.element.id, r]));
      expect(byId.get('current-role-0')!.category).toBe('currentRole');
      expect(byId.get('current-role-1_1')!.category).toBe('currentRole');
    });
  });
});
