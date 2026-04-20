import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { workday } from '../../scanners/workday';

describe('workday scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('detects by applyFlow data-automation-id', () => {
      document.body.innerHTML = '<div data-automation-id="applyFlowMyInfoPage"></div>';
      expect(workday.detect()).toBe(true);
    });

    it('does not detect on generic pages', () => {
      document.body.innerHTML = '<form><input /></form>';
      expect(workday.detect()).toBe(false);
    });
  });

  describe('scan — formField containers', () => {
    it('resolves a simple text field via direct label', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-legalName--firstName">
          <label for="firstName-input">Legal First Name</label>
          <input id="firstName-input" type="text" />
        </div>
      `;
      const results = workday.scan();
      const field = results.find((r) => r.category === 'firstName');
      expect(field).toBeDefined();
      expect(field!.label).toBe('Legal First Name');
      expect(field!.widgetType).toBe('plain-text');
      expect(field!.ats).toBe('workday');
      expect(field!.classifiedBy).toBe('static-map');
    });

    it('maps known automation IDs via the static category map', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-city">
          <label>City</label>
          <input type="text" />
        </div>
        <div data-automation-id="formField-phoneNumber">
          <label>Phone Number</label>
          <input type="text" />
        </div>
      `;
      const results = workday.scan();
      const cityField = results.find((r) => r.label === 'City');
      const phoneField = results.find((r) => r.label === 'Phone Number');
      expect(cityField?.category).toBe('city');
      expect(phoneField?.category).toBe('phoneDigits');
    });

    it('leaves category null for unknown automation IDs (hash-based)', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-aa0c73260bcb100201f0d5194ce50000">
          <label>Custom Question</label>
          <input type="text" />
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.category).toBeNull();
    });

    it('skips formField- with no suffix (scaffolding placeholder)', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-">
          <label>Should not be scanned</label>
          <input type="text" />
        </div>
      `;
      const results = workday.scan();
      expect(results.find((r) => r.label === 'Should not be scanned')).toBeUndefined();
    });
  });

  describe('scan — fieldset + legend labels', () => {
    it('resolves label from fieldset/legend when no direct label exists', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-race">
          <fieldset>
            <legend>Ethnicity</legend>
            <input type="text" />
          </fieldset>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.label).toBe('Ethnicity');
    });

    it('extracts a concise heading from rich-text legend (not the entire privacy blurb)', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-consent">
          <fieldset>
            <legend>
              <div data-automation-id="richText">
                <b>GDPR Notice</b>
                <p>Long privacy policy text that shouldn't appear in the label...</p>
              </div>
            </legend>
            <input type="checkbox" />
          </fieldset>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.label).toBe('GDPR Notice');
    });

    it('combines first+last bold when rich-text has two headings', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-consent2">
          <fieldset>
            <legend>
              <div data-automation-id="richText">
                <b>Privacy Notice</b>
                <p>Paragraph in the middle...</p>
                <b>I have read and agree to the terms*</b>
              </div>
            </legend>
            <input type="checkbox" />
          </fieldset>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.label).toContain('Privacy Notice');
      expect(results[0]?.label).toContain('I have read and agree to the terms');
    });
  });

  describe('scan — Workday widgets', () => {
    it('detects a dropdown button (aria-haspopup="listbox") and resolves label', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-country">
          <button aria-haspopup="listbox" aria-label="Country Select One Required">
            Select One
          </button>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.widgetType).toBe('workday-dropdown');
      expect(results[0]?.label).toBe('Country');
      // BUTTON element so the filler gets a real click target
      expect(results[0]?.element.tagName).toBe('BUTTON');
    });

    it('detects date-input wrapper as workday-date widget', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-someDate">
          <label>Start Date</label>
          <div data-automation-id="dateInputWrapper">
            <input type="text" />
          </div>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.widgetType).toBe('workday-date');
    });

    it('detects multiselect (data-uxi-widget-type) as workday-multiselect', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-schoolName">
          <label>School</label>
          <div data-uxi-widget-type="multiselect">
            <input type="text" />
          </div>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.widgetType).toBe('workday-multiselect');
      expect(results[0]?.category).toBe('school');
    });

    it('detects virtualized checkbox group (ReactVirtualized__List)', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-languages">
          <fieldset>
            <legend>Languages</legend>
            <div class="ReactVirtualized__List">
              <input type="checkbox" id="lang1" />
              <label for="lang1">English</label>
              <input type="checkbox" id="lang2" />
              <label for="lang2">Spanish</label>
            </div>
          </fieldset>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.widgetType).toBe('workday-virtualized-checkbox');
      expect(results[0]?.groupLabels).toEqual(expect.arrayContaining(['English', 'Spanish']));
    });

    it('collects radio group elements + labels for radio-backed fields', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-smsOptIn">
          <fieldset>
            <legend>SMS Opt-In</legend>
            <input type="radio" name="sms" id="sms-yes" />
            <label for="sms-yes">Yes</label>
            <input type="radio" name="sms" id="sms-no" />
            <label for="sms-no">No</label>
          </fieldset>
        </div>
      `;
      const results = workday.scan();
      expect(results[0]?.widgetType).toBe('radio-group');
      expect(results[0]?.groupElements?.length).toBe(2);
      expect(results[0]?.groupLabels).toEqual(['Yes', 'No']);
    });

    it('skips disabled input elements', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-disabled">
          <label>Disabled Field</label>
          <input type="text" disabled />
        </div>
      `;
      const results = workday.scan();
      expect(results.find((r) => r.label === 'Disabled Field')).toBeUndefined();
    });
  });

  describe('scan — extras', () => {
    it('emits the SMS opt-in checkbox (phone-sms-opt-in automation id)', () => {
      document.body.innerHTML = `
        <input type="checkbox" data-automation-id="phone-sms-opt-in" />
      `;
      const results = workday.scan();
      const sms = results.find((r) => r.category === 'smsConsent');
      expect(sms).toBeDefined();
      expect(sms!.widgetType).toBe('checkbox');
    });

    it('emits a Resume/CV file upload when section indicates resume', () => {
      document.body.innerHTML = `
        <div role="group">
          <h4>Resume/CV</h4>
          <div data-automation-id="attachments-FileUpload">
            <input type="file" data-automation-id="file-upload-input-ref" />
          </div>
        </div>
      `;
      const results = workday.scan();
      const resume = results.find((r) => r.category === 'resume');
      expect(resume).toBeDefined();
      expect(resume!.widgetType).toBe('file-upload');
    });

    it('skips an already-uploaded Resume/CV file input', () => {
      document.body.innerHTML = `
        <div role="group">
          <h4>Resume/CV</h4>
          <div data-automation-id="attachments-FileUpload">
            <input type="file" data-automation-id="file-upload-input-ref" />
            <div data-automation-id="file-upload-successful"></div>
          </div>
        </div>
      `;
      const results = workday.scan();
      expect(results.find((r) => r.category === 'resume')).toBeUndefined();
    });
  });
});
