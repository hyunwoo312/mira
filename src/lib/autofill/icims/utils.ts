// iCIMS field IDs follow a stable "<prefix>_<suffix>" pattern where the suffix
// comes from PersonProfileFields.* or CandProfileFields.* Tenant-specific
// questions use opaque rcf<number> IDs — those fall through to label-based
// classification.

const SUFFIX_MAP: Record<string, string> = {
  // Personal
  FirstName: 'firstName',
  LastName: 'lastName',
  MiddleName: '__skip__',
  Email: 'email',
  EmailAddress: 'email',
  'Email Address': 'email',
  HomePhone: 'phone',
  MobilePhone: 'phone',
  PhoneNumber: 'phone',
  PhoneType: 'phoneDeviceType',
  Login: '__skip__',

  // Address
  AddressStreet1: 'address1',
  AddressStreet2: 'address2',
  AddressCity: 'city',
  AddressState: 'state',
  AddressZip: 'zipCode',
  AddressCountry: 'country',
  AddressCounty: '__skip__',
  AddressType: 'addressType',
  'Address.street1': 'address1',
  'Address.street2': 'address2',
  'Address.city': 'city',
  'Address.state': 'state',
  'Address.zip': 'zipCode',
  'Address.country': 'country',

  // Links
  LinkedInURL: 'linkedin',
  LinkedInProfile: 'linkedin',
  GitHubURL: 'github',
  PortfolioURL: 'portfolio',
  WebsiteURL: 'portfolio',
  PersonalWebsite: 'portfolio',

  // Work
  Employer: 'company',
  Company: 'company',
  JobTitle: 'jobTitle',
  Title: 'jobTitle',

  // Education
  School: 'school',
  SchoolName: 'school',
  OtherSchool: '__skip__',
  Degree: 'degree',
  DegreeName: 'degree',
  FieldOfStudy: 'fieldOfStudy',
  Major: 'fieldOfStudy',
  GPA: 'gpa',
  IsGraduated: 'graduationStatus',
  GraduationDate: 'graduationDate',

  // EEO
  Gender: 'gender',
  Ethnicity: 'race',
  Race: 'race',
  Veteran: 'veteranStatus',
  VeteranStatus: 'veteranStatus',
  Disability: 'disabilityStatus',
  DisabilityStatus: 'disabilityStatus',

  // Files — iCIMS treats the Resume/CV section as a profile pre-fill convenience
  // (the info message literally says "Existing data in the form will be
  // replaced"). Selecting a file auto-submits the form, which nukes any
  // fields we already filled. Skip the auto-upload entirely; real required
  // resume uploads on later steps of the application flow are different
  // fields and we'll handle those when we see them.
  Resume: '__skip__',
  Resume_File: '__skip__',
  CoverLetter: 'coverLetter',
};

/**
 * Extract the suffix portion of an iCIMS field id. iCIMS IDs look like
 * "1810158_CandProfileFields.School", "-1_PersonProfileFields.AddressStreet1",
 * or "PortalProfileFields.Resume_File". Returns the canonical suffix for
 * static-map lookup, or null if not an iCIMS profile-fields ID.
 */
export function extractIcimsSuffix(id: string): string | null {
  const match = id.match(
    /(?:PersonProfileFields|CandProfileFields|PortalProfileFields|Fields)\.([A-Za-z][A-Za-z0-9_.]*?)(?:_rcf\d+)?$/,
  );
  return match ? match[1]! : null;
}

export function lookupIcimsCategory(id: string): string | null {
  const suffix = extractIcimsSuffix(id);
  if (!suffix) return null;
  return SUFFIX_MAP[suffix] ?? null;
}

/** Detects whether a field container hosts an iCIMS typeahead dropdown. */
export function isIcimsTypeaheadContainer(container: HTMLElement): boolean {
  return !!container.querySelector('a[id*="_icimsDropdown"]');
}

/** Detects whether a field container hosts an iCIMS triple-input date.
 *  iCIMS uses two suffix styles: full `_Month/_Date/_Year` on some tenants and
 *  truncated `_Mon/_Dat/_Yea` on others. Either Month/Mon is required; Year/Yea
 *  field can be either <input> or <select>.
 */
export function isIcimsDateContainer(container: HTMLElement): boolean {
  const hasMonth = !!container.querySelector('[id$="_Month"], [id$="_Mon"]');
  const hasYear = !!container.querySelector('[id$="_Year"], [id$="_Yea"]');
  return hasMonth && hasYear;
}

export type IcimsWidgetHint = 'icims-typeahead' | 'icims-date';

export function detectIcimsWidget(container: HTMLElement): IcimsWidgetHint | null {
  if (isIcimsTypeaheadContainer(container)) return 'icims-typeahead';
  if (isIcimsDateContainer(container)) return 'icims-date';
  return null;
}
