import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { classifyByContext, pruneWorkSectionAddresses } from '../../scanners/shared';
import type { ScanResult } from '../../types';

function scanResult(overrides: Partial<ScanResult>): ScanResult {
  return {
    widgetType: 'plain-text',
    element: overrides.element ?? document.createElement('input'),
    label: '',
    category: null,
    ats: 'generic',
    ...overrides,
  };
}

describe('pruneWorkSectionAddresses', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('scrubs address1 to __skip__ inside a work section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      category: 'address1',
      classifiedBy: 'static-map',
      sectionHeading: 'Professional Experience (1)',
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBe('__skip__');
    expect(field.classifiedBy).toBe('heuristic');
  });

  it.each(['city', 'state', 'zipCode', 'country', 'location', 'address2'])(
    'scrubs %s in a work section',
    (cat) => {
      const field = scanResult({
        category: cat,
        classifiedBy: 'static-map',
        sectionHeading: 'Work Experience (2)',
      });
      pruneWorkSectionAddresses([field]);
      expect(field.category).toBe('__skip__');
    },
  );

  it.each([
    ['Professional Experience'],
    ['Work Experience'],
    ['Employment History'],
    ['Current Employer'],
  ])('detects "%s" as a work section', (heading) => {
    const field = scanResult({
      category: 'address1',
      classifiedBy: 'static-map',
      sectionHeading: heading,
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBe('__skip__');
  });

  it('leaves non-address categories alone even inside work sections', () => {
    const field = scanResult({
      category: 'company',
      classifiedBy: 'heuristic',
      sectionHeading: 'Professional Experience',
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBe('company');
  });

  it('leaves address categories alone outside work sections', () => {
    const field = scanResult({
      category: 'city',
      classifiedBy: 'static-map',
      sectionHeading: 'Addresses (1)',
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBe('city');
  });

  it('skips fields with no section heading rather than guessing', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      category: 'address1',
      classifiedBy: 'static-map',
      sectionHeading: '',
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBe('address1');
  });

  it('skips fields without a category', () => {
    const field = scanResult({
      category: null,
      sectionHeading: 'Professional Experience',
    });
    pruneWorkSectionAddresses([field]);
    expect(field.category).toBeNull();
  });
});

describe('classifyByContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('assigns workStartDate for "Start Date" in a work section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Start Date',
      sectionHeading: 'Professional Experience (1)',
    });
    classifyByContext([field]);
    expect(field.category).toBe('workStartDate');
    expect(field.classifiedBy).toBe('heuristic');
  });

  it('assigns workEndDate for composite "End Date (Month / Day / Year)" label', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'End Date (Month / Day / Year)',
      sectionHeading: 'Professional Experience (1)',
    });
    classifyByContext([field]);
    expect(field.category).toBe('workEndDate');
  });

  it('assigns graduationDate for "Date Received / Date Expected" in education', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Date Received / Date Expected to Receive',
      sectionHeading: 'Education (1)',
    });
    classifyByContext([field]);
    expect(field.category).toBe('graduationDate');
  });

  it('assigns workLocation for "Location" in work section with a heading', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Location',
      sectionHeading: 'Work Experience',
    });
    classifyByContext([field]);
    expect(field.category).toBe('workLocation');
  });

  it('assigns workDescription for "Description" in work section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Description',
      sectionHeading: 'Professional Experience',
    });
    classifyByContext([field]);
    expect(field.category).toBe('workDescription');
  });

  it('assigns company for "Name" in work section (requires real heading)', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Name',
      sectionHeading: 'Work Experience',
    });
    classifyByContext([field]);
    expect(field.category).toBe('company');
  });

  it('assigns school for "Name" in education section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Name',
      sectionHeading: 'Education',
    });
    classifyByContext([field]);
    expect(field.category).toBe('school');
  });

  it('assigns fieldOfStudy for "Major" in education section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Major',
      sectionHeading: 'Education',
    });
    classifyByContext([field]);
    expect(field.category).toBe('fieldOfStudy');
  });

  it('assigns gpa for "GPA" in education section', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'GPA',
      sectionHeading: 'Education',
    });
    classifyByContext([field]);
    expect(field.category).toBe('gpa');
  });

  it('leaves a bare "Name" alone outside work/edu (no heading)', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Name',
      sectionHeading: '',
    });
    classifyByContext([field]);
    expect(field.category).toBeNull();
  });

  it('strips trailing required-marker asterisks before matching', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      label: 'Start Date*',
      sectionHeading: 'Professional Experience',
    });
    classifyByContext([field]);
    expect(field.category).toBe('workStartDate');
  });

  it('runs pruneWorkSectionAddresses first so static-mapped work addresses get scrubbed', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const field = scanResult({
      element: el,
      category: 'city',
      classifiedBy: 'static-map',
      sectionHeading: 'Professional Experience',
    });
    classifyByContext([field]);
    expect(field.category).toBe('__skip__');
  });
});
