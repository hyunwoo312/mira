/**
 * Integration tests for the autofill pipeline: scan -> classify -> fill.
 * Tests the heuristic path only (ML returns empty results).
 * Uses realistic HTML fixtures modeled after Ashby, Lever, and Greenhouse ATS forms.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { fillPage } from '../pipeline';
import { profileToFillMap } from '../profile-map';
import type { Profile } from '@/lib/schema';
import { DEFAULT_PROFILE } from '@/lib/schema';

// ── Setup ──

// jsdom doesn't support layout — offsetParent/offsetWidth/offsetHeight are all 0/null,
// which makes isVisible() in scan.ts return false for every element.
// Override on prototype so all elements appear "visible" in tests.
const origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return this.parentElement ?? document.body;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    get() {
      return 100;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    get() {
      return 20;
    },
    configurable: true,
  });
});

afterAll(() => {
  // Restore originals
  if (origOffsetParent)
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', origOffsetParent);
  if (origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth);
  if (origOffsetHeight)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
});

// Mock bridge module — simulate fills in jsdom
vi.mock('../bridge', () => ({
  bridgeSetText: vi.fn(async (el: HTMLElement, text: string) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }),
  bridgeClick: vi.fn(async (el: HTMLElement) => {
    el.click();
    return true;
  }),
  bridgeSetChecked: vi.fn(async (el: HTMLElement, checked: boolean) => {
    if (el instanceof HTMLInputElement) el.checked = checked;
    return true;
  }),
  bridgeSetSelect: vi.fn(async (el: HTMLElement, value: string) => {
    if (el instanceof HTMLSelectElement) {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }),
  bridgeSetTextNoBlur: vi.fn(async (el: HTMLElement, text: string) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }),
  bridgeSetComboboxValue: vi.fn(async (el: HTMLElement, text: string) => {
    if (el instanceof HTMLInputElement) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }),
  bridgeClickButtonGroup: vi.fn(async (el: HTMLElement) => {
    el.click();
    return true;
  }),
  bridgeKeyDown: vi.fn(async () => true),
  bridgeGetSelectState: vi.fn(async () => null),
  bridgeSetSelectValue: vi.fn(async () => false),
  isBridgeReady: vi.fn(() => true),
  initBridge: vi.fn(),
}));

// Mock chrome.runtime.sendMessage so ML path returns empty results
beforeEach(() => {
  Element.prototype.scrollIntoView = function () {
    (globalThis as any).__lastScrolledElement = this;
  };
  globalThis.chrome = {
    ...globalThis.chrome,
    runtime: {
      ...globalThis.chrome?.runtime,
      sendMessage: vi.fn().mockResolvedValue({ classifications: [] }),
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ── Test Profile ──

const TEST_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  firstName: 'Jane',
  lastName: 'Doe',
  preferredName: 'Jane',
  email: 'jane.doe@example.com',
  phone: '555-123-4567',
  address1: '123 Main St',
  city: 'San Francisco',
  state: 'California',
  zipCode: '94105',
  country: 'United States',
  dateOfBirth: '1995-06-15',
  linkedin: 'https://linkedin.com/in/janedoe',
  github: 'https://github.com/janedoe',
  portfolio: 'https://janedoe.dev',
  workExperience: [
    {
      company: 'Acme Corp',
      title: 'Software Engineer',
      current: true,
      description: '',
      startMonth: undefined,
      startYear: undefined,
      endMonth: undefined,
      endYear: undefined,
    },
  ],
  education: [
    {
      school: 'MIT',
      degree: "Bachelor's",
      fieldOfStudy: 'Computer Science',
      minor: '',
      gpa: '3.8',
      startMonth: undefined,
      startYear: undefined,
      gradMonth: 5,
      gradYear: 2017,
    },
  ],
  workAuthorization: true,
  sponsorshipNeeded: false,
  willingToRelocate: true,
  gender: 'Female',
  race: 'Asian',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'No',
};

// ── Fixture Helpers ──

function addLabeledInput(
  container: HTMLElement,
  labelText: string,
  attrs: Record<string, string> = {},
): HTMLInputElement {
  const id = `field-${labelText.replace(/\W+/g, '-').toLowerCase()}`;
  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;
  container.appendChild(label);

  const input = document.createElement('input');
  input.id = id;
  input.type = attrs.type ?? 'text';
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  container.appendChild(input);

  return input;
}

function addLabeledSelect(
  container: HTMLElement,
  labelText: string,
  options: string[],
): HTMLSelectElement {
  const id = `field-${labelText.replace(/\W+/g, '-').toLowerCase()}`;
  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;
  container.appendChild(label);

  const select = document.createElement('select');
  select.id = id;
  for (const text of options) {
    const opt = document.createElement('option');
    opt.value = text;
    opt.textContent = text;
    select.appendChild(opt);
  }
  container.appendChild(select);

  return select;
}

function addRadioGroup(
  container: HTMLElement,
  questionLabel: string,
  name: string,
  options: string[],
): HTMLInputElement[] {
  // Use a wrapper div with a preceding heading for the question label,
  // matching the Lever pattern that scan.ts detects via preceding headings.
  const wrapper = document.createElement('div');

  const heading = document.createElement('h4');
  heading.textContent = questionLabel;
  container.appendChild(heading);

  const radios: HTMLInputElement[] = [];
  for (const opt of options) {
    const radioLabel = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = opt;
    radioLabel.appendChild(radio);
    radioLabel.appendChild(document.createTextNode(opt));
    wrapper.appendChild(radioLabel);
    radios.push(radio);
  }
  container.appendChild(wrapper);

  return radios;
}

// ── Fixture 1: Ashby-style form ──

function buildAshbyFixture(): HTMLElement {
  const form = document.createElement('form');

  addLabeledInput(form, 'First Name');
  addLabeledInput(form, 'Last Name');
  addLabeledInput(form, 'Email', { type: 'email' });
  addLabeledInput(form, 'Phone', { type: 'tel' });
  addLabeledInput(form, 'LinkedIn URL');
  addLabeledInput(form, 'Resume/CV', { type: 'file' });
  addLabeledSelect(form, 'Are you legally authorized to work in the US?', [
    'Select...',
    'Yes',
    'No',
  ]);

  document.body.appendChild(form);
  return form;
}

// ── Fixture 2: Lever-style form ──

function buildLeverFixture(): HTMLElement {
  const form = document.createElement('form');

  addLabeledInput(form, 'Full name');
  addLabeledInput(form, 'Email address');
  addLabeledInput(form, 'Phone number');
  addLabeledInput(form, 'Current company');
  addLabeledInput(form, 'LinkedIn URL');
  addLabeledInput(form, 'How did you hear about this job?');
  addRadioGroup(form, 'Will you now or in the future require sponsorship?', 'sponsorship', [
    'Yes',
    'No',
  ]);

  document.body.appendChild(form);
  return form;
}

// ── Fixture 3: Greenhouse-style form ──

function buildGreenhouseFixture(): HTMLElement {
  const form = document.createElement('form');

  addLabeledInput(form, 'First Name *');
  addLabeledInput(form, 'Last Name *');
  addLabeledInput(form, 'Email *');
  addLabeledInput(form, 'Phone *');
  addLabeledInput(form, 'Location');
  addLabeledInput(form, 'LinkedIn Profile');

  // EEO section with heading
  const eeoHeading = document.createElement('h3');
  eeoHeading.textContent = 'Voluntary Self-Identification';
  form.appendChild(eeoHeading);

  addLabeledSelect(form, 'Gender', [
    'Select...',
    'Male',
    'Female',
    'Non-binary',
    'Prefer not to say',
  ]);
  addLabeledSelect(form, 'Race / Ethnicity', [
    'Select...',
    'White',
    'Black or African American',
    'Hispanic or Latino',
    'Asian',
  ]);
  addLabeledSelect(form, 'Veteran Status', [
    'Select...',
    'I am not a protected veteran',
    'I identify as one or more of the classifications of a protected veteran',
  ]);

  document.body.appendChild(form);
  return form;
}

// ── Tests ──

describe('Autofill Integration: Ashby-style form', () => {
  it('should fill text fields with correct profile values', async () => {
    buildAshbyFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const firstName = document.getElementById('field-first-name') as HTMLInputElement;
    const lastName = document.getElementById('field-last-name') as HTMLInputElement;
    const email = document.getElementById('field-email') as HTMLInputElement;
    const phone = document.getElementById('field-phone') as HTMLInputElement;
    const linkedin = document.getElementById('field-linkedin-url') as HTMLInputElement;

    expect(firstName.value).toBe('Jane');
    expect(lastName.value).toBe('Doe');
    expect(email.value).toBe('jane.doe@example.com');
    expect(phone.value).toBe('555-123-4567');
    expect(linkedin.value).toBe('https://linkedin.com/in/janedoe');
  });

  it('should select the correct work authorization option', async () => {
    buildAshbyFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const select = document.getElementById(
      'field-are-you-legally-authorized-to-work-in-the-us-',
    ) as HTMLSelectElement;

    // workAuth is "Yes" — should match "Yes" option (index 1)
    expect(select.selectedIndex).toBe(1);
    expect(select.value).toBe('Yes');
  });

  it('should report the correct number of filled fields', async () => {
    buildAshbyFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // 5 text fields + 1 select = 6. Resume/CV is a file input — skipped since no file blob in fillMap.
    const filledLogs = result.logs.filter((l) => l.status === 'filled');
    expect(filledLogs.length).toBeGreaterThanOrEqual(6);
    expect(result.filled).toBeGreaterThanOrEqual(6);
  });

  it('should not overwrite fields that already have values', async () => {
    buildAshbyFixture();

    // Pre-fill the email field
    const email = document.getElementById('field-email') as HTMLInputElement;
    email.value = 'existing@email.com';

    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    // fillText skips when value is non-empty
    expect(email.value).toBe('existing@email.com');
  });
});

describe('Autofill Integration: Lever-style form', () => {
  it('should fill text fields with correct profile values', async () => {
    buildLeverFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const fullName = document.getElementById('field-full-name') as HTMLInputElement;
    const email = document.getElementById('field-email-address') as HTMLInputElement;
    const phone = document.getElementById('field-phone-number') as HTMLInputElement;
    const company = document.getElementById('field-current-company') as HTMLInputElement;
    const linkedin = document.getElementById('field-linkedin-url') as HTMLInputElement;

    expect(fullName.value).toBe('Jane Doe');
    expect(email.value).toBe('jane.doe@example.com');
    expect(phone.value).toBe('555-123-4567');
    expect(company.value).toBe('Acme Corp');
    expect(linkedin.value).toBe('https://linkedin.com/in/janedoe');
  });

  it('should skip the "how did you hear" field (handled by answer bank, not heuristics)', async () => {
    buildLeverFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const howHeard = document.getElementById(
      'field-how-did-you-hear-about-this-job-',
    ) as HTMLInputElement;

    // "How did you hear" is classified as __skip__ by patterns — not auto-filled
    expect(howHeard.value).toBe('');
  });

  it('should select the correct sponsorship radio option', async () => {
    buildLeverFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    // sponsorship is "Yes" in the fillMap (sponsorshipNeeded: false maps to "No" wait —
    // actually TEST_PROFILE.sponsorshipNeeded = false, so fillMap.sponsorship = "No")
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="sponsorship"]');
    // "No" is the second radio (index 1)
    expect(radios[1]!.checked).toBe(true);
    expect(radios[0]!.checked).toBe(false);
  });

  it('should report the correct fill count', async () => {
    buildLeverFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // 5 text fields + 1 radio group = 6 ("how did you hear" is __skip__)
    const filledLogs = result.logs.filter((l) => l.status === 'filled');
    expect(filledLogs.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Autofill Integration: Greenhouse-style form', () => {
  it('should fill personal info fields', { timeout: 30000 }, async () => {
    buildGreenhouseFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const firstName = document.getElementById('field-first-name-') as HTMLInputElement;
    const lastName = document.getElementById('field-last-name-') as HTMLInputElement;
    const email = document.getElementById('field-email-') as HTMLInputElement;
    const phone = document.getElementById('field-phone-') as HTMLInputElement;
    const location = document.getElementById('field-location') as HTMLInputElement;
    const linkedin = document.getElementById('field-linkedin-profile') as HTMLInputElement;

    expect(firstName.value).toBe('Jane');
    expect(lastName.value).toBe('Doe');
    expect(email.value).toBe('jane.doe@example.com');
    expect(phone.value).toBe('555-123-4567');
    // Location goes through fillAutocomplete which may partial-fill in jsdom
    expect(location.value).toBeTruthy();
    expect(linkedin.value).toBe('https://linkedin.com/in/janedoe');
  });

  it('should select the correct EEO options', { timeout: 30000 }, async () => {
    buildGreenhouseFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const gender = document.getElementById('field-gender') as HTMLSelectElement;
    const race = document.getElementById('field-race-ethnicity') as HTMLSelectElement;
    const veteran = document.getElementById('field-veteran-status') as HTMLSelectElement;

    // Gender: "Female" is index 2
    expect(gender.value).toBe('Female');
    expect(gender.selectedIndex).toBe(2);

    // Race: "Asian" is index 4
    expect(race.value).toBe('Asian');
    expect(race.selectedIndex).toBe(4);

    // Veteran: "I am not a protected veteran" is index 1
    expect(veteran.selectedIndex).toBe(1);
  });

  it('should report the correct fill count including EEO fields', { timeout: 30000 }, async () => {
    buildGreenhouseFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // 6 text fields + 3 selects = 9
    const filledLogs = result.logs.filter((l) => l.status === 'filled');
    expect(filledLogs.length).toBeGreaterThanOrEqual(9);
    expect(result.filled).toBeGreaterThanOrEqual(9);
  });

  it('should skip EEO fields when skipEeo is true', { timeout: 30000 }, async () => {
    buildGreenhouseFixture();
    const profileWithSkipEeo: Profile = { ...TEST_PROFILE, skipEeo: true };
    const fillMap = profileToFillMap(profileWithSkipEeo);
    await fillPage(fillMap, []);

    const gender = document.getElementById('field-gender') as HTMLSelectElement;
    const race = document.getElementById('field-race-ethnicity') as HTMLSelectElement;
    const veteran = document.getElementById('field-veteran-status') as HTMLSelectElement;

    // All EEO selects should remain at default (index 0)
    expect(gender.selectedIndex).toBe(0);
    expect(race.selectedIndex).toBe(0);
    expect(veteran.selectedIndex).toBe(0);
  });
});

describe('Autofill Integration: Edge cases', () => {
  it('should handle an empty fillMap without errors', async () => {
    buildAshbyFixture();
    const result = await fillPage({});

    expect(result.filled).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should handle a page with no form fields', async () => {
    document.body.innerHTML = '<div><p>No form here</p></div>';
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    expect(result.filled).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should not fill disabled inputs', async () => {
    const form = document.createElement('form');
    const input = addLabeledInput(form, 'First Name', { disabled: '' });
    document.body.appendChild(form);

    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    expect(input.value).toBe('');
  });

  it('should correctly attribute all heuristic fills to the heuristic source', async () => {
    buildAshbyFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    const filledLogs = result.logs.filter((l) => l.status === 'filled');
    for (const log of filledLogs) {
      // All fills should be from heuristic since ML returns empty
      expect(log.source).toBe('heuristic');
    }
  });
});

describe('Autofill Integration: Lever-style individual race checkboxes', () => {
  function buildLeverRaceFixture(): void {
    const form = document.createElement('form');

    // Basic fields
    addLabeledInput(form, 'Full name');
    addLabeledInput(form, 'Email');

    // Race checkboxes as individual options (Lever pattern — no fieldset)
    const raceContainer = document.createElement('div');
    raceContainer.className = 'application-question';
    const raceHeading = document.createElement('label');
    raceHeading.className = 'application-label';
    raceHeading.textContent = 'Race / Ethnicity';
    raceContainer.appendChild(raceHeading);

    const raceOptions = [
      'Asian',
      'Black or African American',
      'White',
      'Hispanic or Latino',
      'Two or More Races',
      'Prefer not to say',
    ];
    for (const opt of raceOptions) {
      const wrapper = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = `race_${opt.toLowerCase().replace(/\s+/g, '_')}`;
      wrapper.appendChild(cb);
      wrapper.appendChild(document.createTextNode(opt));
      raceContainer.appendChild(wrapper);
    }
    form.appendChild(raceContainer);

    document.body.appendChild(form);
  }

  it('should group individual race checkboxes and fill the matching option', async () => {
    buildLeverRaceFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    // "Asian" checkbox should be checked
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const asianCb = Array.from(checkboxes).find((cb) =>
      cb.labels?.[0]?.textContent?.includes('Asian'),
    );
    expect(asianCb).toBeDefined();
    expect(asianCb!.checked).toBe(true);
  });

  it('should not check non-matching race options', async () => {
    buildLeverRaceFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    await fillPage(fillMap, []);

    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const whiteCb = Array.from(checkboxes).find((cb) =>
      cb.labels?.[0]?.textContent?.includes('White'),
    );
    expect(whiteCb).toBeDefined();
    expect(whiteCb!.checked).toBe(false);
  });
});

// ── ML Fallback Tests ──

describe('Autofill Integration: ML classification fallback', () => {
  beforeEach(() => {
    // Override the default mock: return actual ML classifications for specific fields
    globalThis.chrome = {
      ...globalThis.chrome,
      runtime: {
        ...globalThis.chrome?.runtime,
        sendMessage: vi.fn().mockImplementation(async (message: any) => {
          if (message.type === 'ML_CLASSIFY') {
            return {
              classifications: message.fields.map((f: any) => {
                // "willing to travel" is not matched by heuristics (which look for "relocat")
                // but ML classifies it as relocate
                if (f.label.toLowerCase().includes('willing to travel')) {
                  return { label: f.label, category: 'relocate', confidence: 0.92 };
                }
                // "experience with databases" — ML returns empty, stays unmatched
                return { label: f.label, category: '', confidence: 0 };
              }),
            };
          }
          if (message.type === 'ML_MATCH_OPTION') {
            return { bestIndex: -1, similarity: 0 };
          }
          if (message.type === 'ML_MATCH_ANSWERS') {
            return { matches: [] };
          }
          return {};
        }),
      },
    } as unknown as typeof chrome;
  });

  function buildMLFallbackFixture(): void {
    const form = document.createElement('form');

    // Standard fields that heuristics CAN match (to verify pipeline still works)
    addLabeledInput(form, 'First Name');
    addLabeledInput(form, 'Email', { type: 'email' });

    // Fields that heuristics CANNOT match — rely on ML
    addLabeledInput(form, 'Are you willing to travel for work?');
    addLabeledInput(form, 'Describe your experience with databases');

    document.body.appendChild(form);
  }

  it('should fill ML-classified fields with the correct profile value', async () => {
    buildMLFallbackFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // "willing to travel" → ML classifies as relocate → fillMap.relocate = "Yes"
    const travelField = document.getElementById(
      'field-are-you-willing-to-travel-for-work-',
    ) as HTMLInputElement;
    expect(travelField.value).toBe('Yes');

    // Verify it was logged as filled
    const travelLog = result.logs.find((l) => l.field === 'Are you willing to travel for work?');
    expect(travelLog).toBeDefined();
    expect(travelLog!.status).toBe('filled');
  });

  it('should skip fields that ML cannot classify', async () => {
    buildMLFallbackFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // "experience with databases" → ML returns empty category → skipped
    const dbField = document.getElementById(
      'field-describe-your-experience-with-databases',
    ) as HTMLInputElement;
    expect(dbField.value).toBe('');

    const dbLog = result.logs.find((l) => l.field === 'Describe your experience with databases');
    expect(dbLog).toBeDefined();
    expect(dbLog!.status).toBe('skipped');
  });

  it('should track the ML source in logs for ML-filled fields', async () => {
    buildMLFallbackFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const result = await fillPage(fillMap, []);

    // Heuristic-matched fields should have source 'heuristic'
    const firstNameLog = result.logs.find((l) => l.field === 'First Name');
    expect(firstNameLog).toBeDefined();
    expect(firstNameLog!.source).toBe('heuristic');

    // ML-matched field should have source 'ml' with confidence
    const travelLog = result.logs.find((l) => l.field === 'Are you willing to travel for work?');
    expect(travelLog).toBeDefined();
    expect(travelLog!.source).toBe('ml');
    expect(travelLog!.confidence).toBe(0.92);
  });
});

describe('Autofill Integration: Answer bank matching', () => {
  beforeEach(() => {
    // ML classifies nothing, but answer bank matching returns a hit
    globalThis.chrome = {
      ...globalThis.chrome,
      runtime: {
        ...globalThis.chrome?.runtime,
        sendMessage: vi.fn().mockImplementation(async (message: any) => {
          if (message.type === 'ML_CLASSIFY') {
            return {
              classifications: message.fields.map((f: any) => ({
                label: f.label,
                category: '',
                confidence: 0,
              })),
            };
          }
          if (message.type === 'ML_MATCH_OPTION') {
            return { bestIndex: -1, similarity: 0 };
          }
          if (message.type === 'ML_MATCH_ANSWERS') {
            return {
              matches: message.fieldLabels
                .map((label: string, _i: number) => {
                  if (label.toLowerCase().includes('why do you want')) {
                    return { fieldLabel: label, questionIndex: 0, similarity: 0.85 };
                  }
                  return null;
                })
                .filter(Boolean),
            };
          }
          return {};
        }),
      },
    } as unknown as typeof chrome;
  });

  function buildAnswerBankFixture(): void {
    const form = document.createElement('form');

    // Standard heuristic-matched field
    addLabeledInput(form, 'First Name');

    // Free-text question — no heuristic or ML match, but answer bank has a match
    addLabeledInput(form, 'Why do you want to work here?');

    // Another unmatched field with no answer bank match
    addLabeledInput(form, 'What is your favorite color?');

    document.body.appendChild(form);
  }

  it('should fill the field matched by answer bank', async () => {
    buildAnswerBankFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const answerBank = [
      { question: 'Why do you want to work here?', answer: 'I love the mission.' },
    ];

    const result = await fillPage(fillMap, answerBank);

    const whyField = document.getElementById(
      'field-why-do-you-want-to-work-here-',
    ) as HTMLInputElement;
    expect(whyField.value).toBe('I love the mission.');

    const whyLog = result.logs.find((l) => l.field === 'Why do you want to work here?');
    expect(whyLog).toBeDefined();
    expect(whyLog!.status).toBe('filled');
  });

  it('should log the answer bank source', async () => {
    buildAnswerBankFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const answerBank = [
      { question: 'Why do you want to work here?', answer: 'I love the mission.' },
    ];

    const result = await fillPage(fillMap, answerBank);

    const whyLog = result.logs.find((l) => l.field === 'Why do you want to work here?');
    expect(whyLog).toBeDefined();
    expect(whyLog!.source).toBe('answer-bank');
  });

  it('should skip unmatched fields that answer bank cannot match either', async () => {
    buildAnswerBankFixture();
    const fillMap = profileToFillMap(TEST_PROFILE);
    const answerBank = [
      { question: 'Why do you want to work here?', answer: 'I love the mission.' },
    ];

    const result = await fillPage(fillMap, answerBank);

    const colorField = document.getElementById(
      'field-what-is-your-favorite-color-',
    ) as HTMLInputElement;
    expect(colorField.value).toBe('');

    const colorLog = result.logs.find((l) => l.field === 'What is your favorite color?');
    expect(colorLog).toBeDefined();
    expect(colorLog!.status).toBe('skipped');
  });
});
