//  Page Detection

export type WorkdayPage =
  | 'myInfo'
  | 'myExperience'
  | 'appQuestions'
  | 'voluntary'
  | 'selfIdentify'
  | null;

const PAGE_SELECTORS: [string, WorkdayPage][] = [
  ['[data-automation-id="applyFlowMyInfoPage"]', 'myInfo'],
  ['[data-automation-id="applyFlowMyExpPage"]', 'myExperience'],
  ['[data-automation-id="applyFlowPrimaryQuestionsPage"]', 'appQuestions'],
  ['[data-automation-id="applyFlowVoluntaryDisclosuresPage"]', 'voluntary'],
  ['[data-automation-id="applyFlowSelfIdentifyPage"]', 'selfIdentify'],
];

export function detectWorkdayPage(): WorkdayPage {
  for (const [selector, page] of PAGE_SELECTORS) {
    if (document.querySelector(selector)) return page;
  }
  return null;
}

//  Static Field Map

const FIELD_MAP: Record<string, string> = {
  // ── My Information ──
  source: '__skip__',
  candidateIsPreviousWorker: 'workedHereBefore',
  country: 'country',
  'legalName--firstName': 'firstName',
  'legalName--middleName': '__skip__',
  'legalName--lastName': 'lastName',
  preferredCheck: '__skip__',
  addressLine1: 'address1',
  city: 'city',
  countryRegion: 'state',
  postalCode: 'zipCode',
  county: '__skip__',
  phoneType: 'phoneDeviceType',
  countryPhoneCode: 'phoneCountryCode',
  phoneNumber: 'phoneDigits',
  extension: '__skip__',
  acceptTermsAndAgreements: 'consent',
  // ── My Experience: Work ──
  jobTitle: 'jobTitle',
  companyName: 'company',
  location: 'workLocation',
  currentlyWorkHere: 'currentlyWorkHere',
  startDate: 'workStartDate',
  endDate: 'workEndDate',
  roleDescription: 'workDescription',
  // ── My Experience: Education ──
  schoolName: 'school',
  degree: 'degree',
  fieldOfStudy: '__skip__',
  gradeAverage: 'gpa',
  firstYearAttended: 'eduStartYear',
  lastYearAttended: 'eduGradYear',
  // ── My Experience: Websites ──
  url: 'websiteUrl',
  // ── Voluntary Disclosures ──
  ethnicity: 'race',
  ethnicityMulti: 'race',
  gender: 'gender',
  veteranStatus: 'veteranStatus',
  // ── Self Identify ──
  disabilityForm: '__skip__',
  disabilityStatus: 'disabilityStatus',
  name: 'fullName',
  employeeId: '__skip__',
  dateSignedOn: 'todayDate',
};

function extractFieldName(automationId: string): string | null {
  if (!automationId.startsWith('formField-')) return null;
  return automationId.slice('formField-'.length);
}

export function lookupCategory(automationId: string): string | null {
  const fieldName = extractFieldName(automationId);
  if (!fieldName) return null;
  return FIELD_MAP[fieldName] ?? null;
}

//  Widget Detection

export type WorkdayWidgetHint =
  | 'workday-dropdown'
  | 'workday-multiselect'
  | 'workday-date'
  | 'workday-virtualized-checkbox';

export function detectWorkdayWidget(container: HTMLElement): WorkdayWidgetHint | null {
  if (container.querySelector('button[aria-haspopup="listbox"]')) return 'workday-dropdown';
  if (container.querySelector('[data-uxi-widget-type="multiselect"]')) return 'workday-multiselect';
  if (container.querySelector('[data-automation-id="dateInputWrapper"]')) return 'workday-date';
  if (container.querySelector('.ReactVirtualized__List')) return 'workday-virtualized-checkbox';
  return null;
}

//  Dropdown & Date Helpers

export function waitForWorkdayListbox(timeout: number): Promise<HTMLElement | null> {
  const findActive = (): HTMLElement | null => {
    const activePopup = document.querySelector<HTMLElement>(
      '[data-automation-activepopup] [role="listbox"], [data-automation-activepopup="true"] [role="listbox"]',
    );
    if (activePopup) return activePopup;
    const openedListbox = document.querySelector<HTMLElement>(
      '[visibility="opened"] [role="listbox"]',
    );
    if (openedListbox) return openedListbox;
    const popperListbox = document.querySelector<HTMLElement>(
      '[data-popper-placement] [role="listbox"]',
    );
    if (popperListbox) return popperListbox;
    const allListboxes = document.querySelectorAll<HTMLElement>('[role="listbox"]');
    for (const lb of allListboxes) {
      const parent = lb.closest<HTMLElement>('[style*="z-index"]');
      if (parent) return lb;
    }
    return null;
  };

  return new Promise((resolve) => {
    const existing = findActive();
    if (existing) {
      resolve(existing);
      return;
    }
    const obs = new MutationObserver(() => {
      const el = findActive();
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      resolve(findActive());
    }, timeout);
  });
}

export function getDropdownSynonyms(value: string, category?: string): string[] {
  const results = [value];

  // `workedHereBefore` fillMap value is "I have not" (optimized for react-selects
  // with verbose options like "I have not worked at X"). Workday dropdowns have
  // shorter/differently-phrased negatives — expose common ones as synonyms.
  if (category === 'workedHereBefore' && /^i have not$/i.test(value.trim())) {
    results.push('No', 'Never', 'I have never', 'No, never', 'No, I have not');
  }

  if (category !== 'degree') return results;

  const v = value.toLowerCase().trim();
  const DEGREE_GROUPS: string[][] = [
    [
      'b.s.',
      'bs',
      'bsc',
      'b.sc',
      'b.s',
      "bachelor's degree",
      "bachelor's",
      'bachelor of science',
      'bachelor',
    ],
    ['b.a.', 'ba', 'b.a', "bachelor's degree", "bachelor's", 'bachelor of arts', 'bachelor'],
    ['b.eng.', 'beng', 'bachelor of engineering', "bachelor's degree"],
    ['b.b.a.', 'bba', 'bachelor of business administration', "bachelor's degree"],
    [
      'm.s.',
      'ms',
      'msc',
      'm.sc',
      'm.s',
      "master's degree",
      "master's",
      'master of science',
      'master',
    ],
    ['m.a.', 'ma', 'm.a', "master's degree", "master's", 'master of arts', 'master'],
    ['mba', 'm.b.a.', 'm.b.a', "master's degree", "master's", 'master of business administration'],
    ['phd', 'ph.d.', 'ph.d', 'doctorate', 'doctor of philosophy'],
    ['jd', 'j.d.', 'j.d', 'juris doctor', 'doctorate'],
    ['md', 'm.d.', 'm.d', 'doctor of medicine', 'doctorate'],
    ['a.a.', 'aa', "associate's degree", 'associate of arts', 'associate'],
    ['a.s.', 'as', "associate's degree", 'associate of science', 'associate'],
    [
      'hs',
      'high school',
      'high school diploma',
      'high school or equivalent',
      'high school diploma or ged',
    ],
    ['ged', 'high school or equivalent', 'high school diploma or ged'],
  ];

  for (const group of DEGREE_GROUPS) {
    if (group.some((alias) => alias === v)) {
      for (const alias of group) {
        if (!results.some((r) => r.toLowerCase() === alias)) results.push(alias);
      }
      break;
    }
  }
  return results;
}

export function parseDateValue(value: string): { month: string; day: string; year: string } {
  let month = '';
  let day = '';
  let year = '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    year = y!;
    month = String(Number(m));
    day = String(Number(d));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split('/');
    month = String(Number(m));
    day = String(Number(d));
    year = y!;
  } else if (/^\d{1,2}\/\d{4}$/.test(value)) {
    const [m, y] = value.split('/');
    month = String(Number(m));
    year = y!;
  } else if (/^\d{4}$/.test(value)) {
    year = value;
  } else if (/^immediately$/i.test(value) || /^asap$/i.test(value)) {
    const now = new Date();
    month = String(now.getMonth() + 1);
    day = String(now.getDate());
    year = String(now.getFullYear());
  } else {
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    const lower = value.toLowerCase();
    for (let i = 0; i < monthNames.length; i++) {
      if (lower.includes(monthNames[i]!)) {
        month = String(i + 1);
        break;
      }
    }
    const yearMatch = value.match(/\d{4}/);
    if (yearMatch) year = yearMatch[0];
  }

  return { month, day, year };
}
