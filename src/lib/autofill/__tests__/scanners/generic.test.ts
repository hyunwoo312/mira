import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { generic } from '../../scanners/generic';

describe('generic scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('should always return true (fallback)', () => {
      expect(generic.detect()).toBe(true);
    });
  });

  describe('scan', () => {
    it('should scan standard text inputs with labels', () => {
      document.body.innerHTML = `
        <form>
          <label for="name">Full Name</label>
          <input type="text" id="name" />
        </form>
      `;
      const results = generic.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.label).toBe('Full Name');
      expect(results[0]!.widgetType).toBe('plain-text');
      expect(results[0]!.ats).toBe('generic');
    });

    it('should scan textarea fields', () => {
      document.body.innerHTML = `
        <label for="cover">Cover Letter</label>
        <textarea id="cover"></textarea>
      `;
      const results = generic.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.widgetType).toBe('plain-text');
    });

    it('should scan file inputs', () => {
      document.body.innerHTML = `
        <label for="resume">Resume</label>
        <input type="file" id="resume" />
      `;
      const results = generic.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.widgetType).toBe('file-upload');
    });

    it('should skip hidden inputs', () => {
      document.body.innerHTML = `
        <input type="hidden" name="csrf" value="abc" />
        <input type="submit" value="Submit" />
      `;
      const results = generic.scan();
      expect(results.length).toBe(0);
    });

    it('should skip disabled inputs', () => {
      document.body.innerHTML = `
        <label for="disabled_field">Disabled</label>
        <input type="text" id="disabled_field" disabled />
      `;
      const results = generic.scan();
      expect(results.length).toBe(0);
    });

    it('should run all grouping phases', () => {
      document.body.innerHTML = `
        <fieldset>
          <legend>Veteran Status</legend>
          <label><input type="radio" name="vet" value="yes" /> Yes</label>
          <label><input type="radio" name="vet" value="no" /> No</label>
        </fieldset>
        <label for="email">Email</label>
        <input type="text" id="email" />
      `;
      const results = generic.scan();
      expect(results.length).toBe(2);
      const radio = results.find((r) => r.widgetType === 'radio-group');
      const text = results.find((r) => r.widgetType === 'plain-text');
      expect(radio).toBeDefined();
      expect(text).toBeDefined();
    });
  });
});
