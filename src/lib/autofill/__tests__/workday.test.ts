import { lookupCategory, detectWorkdayPage } from '../workday/utils';

describe('lookupCategory', () => {
  describe('My Information fields', () => {
    it.each([
      ['formField-legalName--firstName', 'firstName'],
      ['formField-legalName--lastName', 'lastName'],
      ['formField-legalName--middleName', '__skip__'],
      ['formField-country', 'country'],
      ['formField-addressLine1', 'address1'],
      ['formField-city', 'city'],
      ['formField-countryRegion', 'state'],
      ['formField-postalCode', 'zipCode'],
      ['formField-phoneNumber', 'phoneDigits'],
      ['formField-phoneType', 'phoneDeviceType'],
      ['formField-countryPhoneCode', 'phoneCountryCode'],
      ['formField-extension', '__skip__'],
      ['formField-county', '__skip__'],
      ['formField-source', '__skip__'],
      ['formField-candidateIsPreviousWorker', 'workedHereBefore'],
      ['formField-preferredCheck', '__skip__'],
      ['formField-acceptTermsAndAgreements', 'consent'],
    ])('should map %s → %s', (automationId, expected) => {
      expect(lookupCategory(automationId)).toBe(expected);
    });
  });

  describe('My Experience fields', () => {
    it.each([
      ['formField-jobTitle', 'jobTitle'],
      ['formField-companyName', 'company'],
      ['formField-location', 'workLocation'],
      ['formField-currentlyWorkHere', 'currentlyWorkHere'],
      ['formField-startDate', 'workStartDate'],
      ['formField-endDate', 'workEndDate'],
      ['formField-roleDescription', 'workDescription'],
      ['formField-schoolName', 'school'],
      ['formField-degree', 'degree'],
      ['formField-fieldOfStudy', '__skip__'],
      ['formField-gradeAverage', 'gpa'],
      ['formField-firstYearAttended', 'eduStartYear'],
      ['formField-lastYearAttended', 'eduGradYear'],
      ['formField-url', 'websiteUrl'],
    ])('should map %s → %s', (automationId, expected) => {
      expect(lookupCategory(automationId)).toBe(expected);
    });
  });

  describe('Voluntary Disclosures fields', () => {
    it.each([
      ['formField-ethnicityMulti', 'race'],
      ['formField-gender', 'gender'],
      ['formField-veteranStatus', 'veteranStatus'],
    ])('should map %s → %s', (automationId, expected) => {
      expect(lookupCategory(automationId)).toBe(expected);
    });
  });

  describe('Self Identify fields', () => {
    it.each([
      ['formField-disabilityStatus', 'disabilityStatus'],
      ['formField-name', 'fullName'],
      ['formField-dateSignedOn', 'todayDate'],
      ['formField-disabilityForm', '__skip__'],
      ['formField-employeeId', '__skip__'],
    ])('should map %s → %s', (automationId, expected) => {
      expect(lookupCategory(automationId)).toBe(expected);
    });
  });

  describe('hash-based IDs (Application Questions)', () => {
    it('should return null for hash-based automation IDs', () => {
      expect(lookupCategory('formField-aa0c73260bcb100201f0d5194ce50000')).toBeNull();
      expect(lookupCategory('formField-59050d7b4d6e1001aeae01aba3990000')).toBeNull();
    });
  });

  describe('invalid inputs', () => {
    it('should return null for non-formField IDs', () => {
      expect(lookupCategory('add-button')).toBeNull();
      expect(lookupCategory('multiSelectContainer')).toBeNull();
      expect(lookupCategory('')).toBeNull();
    });
  });
});

describe('detectWorkdayPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should detect My Information page', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowMyInfoPage"></div>';
    expect(detectWorkdayPage()).toBe('myInfo');
  });

  it('should detect My Experience page', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowMyExpPage"></div>';
    expect(detectWorkdayPage()).toBe('myExperience');
  });

  it('should detect Application Questions page', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowPrimaryQuestionsPage"></div>';
    expect(detectWorkdayPage()).toBe('appQuestions');
  });

  it('should detect Voluntary Disclosures page', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowVoluntaryDisclosuresPage"></div>';
    expect(detectWorkdayPage()).toBe('voluntary');
  });

  it('should detect Self Identify page', () => {
    document.body.innerHTML = '<div data-automation-id="applyFlowSelfIdentifyPage"></div>';
    expect(detectWorkdayPage()).toBe('selfIdentify');
  });

  it('should return null for unknown pages', () => {
    document.body.innerHTML = '<div>Some other page</div>';
    expect(detectWorkdayPage()).toBeNull();
  });
});
