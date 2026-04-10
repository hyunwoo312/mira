import { describe, it, expect, beforeEach } from 'vitest';
import { detectATS } from '../../scanners/index';

describe('detectATS', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should detect greenhouse by DOM fingerprint', () => {
    document.body.innerHTML = '<div id="app_body"></div>';
    const ats = detectATS();
    expect(ats).toBe('greenhouse');
  });

  it('should detect ashby by DOM fingerprint', () => {
    document.body.innerHTML = '<div class="fieldEntry"></div>';
    const ats = detectATS();
    expect(ats).toBe('ashby');
  });

  it('should detect lever by DOM fingerprint', () => {
    document.body.innerHTML = '<div class="application-question"></div>';
    const ats = detectATS();
    expect(ats).toBe('lever');
  });

  it('should detect workday by DOM fingerprint', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowMyInfoPage"></div>';
    const ats = detectATS();
    expect(ats).toBe('workday');
  });

  it('should return generic for unknown sites', () => {
    document.body.innerHTML = '<form><input type="text" /></form>';
    const ats = detectATS();
    expect(ats).toBe('generic');
  });
});
