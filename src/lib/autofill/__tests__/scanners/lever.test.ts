import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { lever } from '../../scanners/lever';

describe('lever scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detect', () => {
    it('should detect by .application-question', () => {
      document.body.innerHTML = '<div class="application-question"></div>';
      expect(lever.detect()).toBe(true);
    });

    it('should not detect on generic page', () => {
      document.body.innerHTML = '<form></form>';
      expect(lever.detect()).toBe(false);
    });
  });

  describe('scan', () => {
    it('should scan text inputs inside application-question containers', () => {
      document.body.innerHTML = `
        <div class="application-question">
          <div class="application-label"><span class="text">First Name</span></div>
          <input type="text" id="first_name" />
        </div>
      `;
      const results = lever.scan();
      expect(results.length).toBe(1);
      expect(results[0]!.label).toBe('First Name');
      expect(results[0]!.ats).toBe('lever');
    });

    it('should scan Lever multiple-choice radio groups', () => {
      document.body.innerHTML = `
        <div class="application-question">
          <div class="application-label"><span class="text">Are you authorized to work?</span></div>
          <ul data-qa="multiple-choice">
            <label><input type="radio" name="q1" value="yes" /><span class="application-answer-alternative">Yes</span></label>
            <label><input type="radio" name="q1" value="no" /><span class="application-answer-alternative">No</span></label>
          </ul>
        </div>
      `;
      const results = lever.scan();
      const radioField = results.find((r) => r.widgetType === 'radio-group');
      expect(radioField).toBeDefined();
      expect(radioField!.label).toBe('Are you authorized to work?');
      expect(radioField!.groupLabels).toEqual(['Yes', 'No']);
    });
  });
});
