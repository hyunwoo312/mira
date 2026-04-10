import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { ashby } from '../../scanners/ashby';

describe('ashby scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('should detect by fieldEntry class', () => {
      document.body.innerHTML = '<div class="fieldEntry"></div>';
      expect(ashby.detect()).toBe(true);
    });

    it('should not detect on generic page', () => {
      document.body.innerHTML = '<form></form>';
      expect(ashby.detect()).toBe(false);
    });
  });

  describe('scan', () => {
    it('should scan text inputs inside fieldEntry containers', () => {
      document.body.innerHTML = `
        <div class="fieldEntry">
          <label>Email Address</label>
          <input type="text" id="email" />
        </div>
      `;
      const results = ashby.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.label).toBe('Email Address');
      expect(results[0]!.ats).toBe('ashby');
    });

    it('should scan button groups in fieldEntry', () => {
      document.body.innerHTML = `
        <div class="fieldEntry">
          <label>Willing to relocate?</label>
          <button>Yes</button>
          <button>No</button>
        </div>
      `;
      const results = ashby.scan();
      const buttonGroup = results.find((r) => r.widgetType === 'button-group');
      expect(buttonGroup).toBeDefined();
      expect(buttonGroup!.label).toBe('Willing to relocate?');
      expect(buttonGroup!.groupLabels).toEqual(['Yes', 'No']);
    });

    it('should scan fieldset radio groups', () => {
      document.body.innerHTML = `
        <fieldset>
          <legend>Gender</legend>
          <label><input type="radio" name="gender" value="m" /> Male</label>
          <label><input type="radio" name="gender" value="f" /> Female</label>
          <label><input type="radio" name="gender" value="nb" /> Non-binary</label>
        </fieldset>
      `;
      const results = ashby.scan();
      const radioField = results.find((r) => r.widgetType === 'radio-group');
      expect(radioField).toBeDefined();
      expect(radioField!.label).toBe('Gender');
      expect(radioField!.groupLabels?.length).toBe(3);
    });

    it('should scan single checkboxes in fieldEntry as consent fields', () => {
      document.body.innerHTML = `
        <div class="fieldEntry">
          <label>I agree to the privacy policy</label>
          <input type="checkbox" id="consent" />
        </div>
      `;
      const results = ashby.scan();
      const checkbox = results.find((r) => r.widgetType === 'checkbox');
      expect(checkbox).toBeDefined();
      expect(checkbox!.label).toBe('I agree to the privacy policy');
    });
  });
});
