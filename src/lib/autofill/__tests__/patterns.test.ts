import { classifyField } from '../patterns';

// ── Name fields ──

describe('firstName', () => {
  it.each(['First Name', 'First name *', 'FirstName', 'first_name'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('firstName');
    },
  );
});

describe('lastName', () => {
  it.each(['Last Name', 'Last name *', 'Family Name', 'Surname'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('lastName');
    },
  );
});

describe('fullName', () => {
  it.each(['Name', 'Name *', 'Name✱', 'Full Name', 'FullName'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('fullName');
  });

  it('should not match "Name of your school"', () => {
    expect(classifyField('Name of your school')).not.toBe('fullName');
  });
});

describe('preferredName', () => {
  it.each(['Preferred Name', 'Preferred name', 'PreferredName'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('preferredName');
    },
  );
});

// ── File fields ──

describe('resume', () => {
  it.each(['Resume', 'Upload Resume', 'Resume/CV', 'CV'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('resume');
  });
});

describe('coverLetter', () => {
  it.each(['Cover Letter', 'Cover letter', 'Letter of Motivation'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('coverLetter');
    },
  );
});

// ── Contact fields ──

describe('email', () => {
  it.each(['Email', 'Email Address', 'email *'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('email');
  });
});

describe('phone', () => {
  it.each(['Phone', 'Phone Number', 'Tel', 'Telephone'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('phone');
  });
});

// ── Address fields ──

describe('address1', () => {
  it.each(['Address', 'Address Line 1', 'Street Address', 'Street'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('address1');
    },
  );
});

describe('address2', () => {
  it.each(['Address Line 2', 'Apt', 'Suite', 'Apt/Suite/Other'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('address2');
    },
  );
});

describe('city', () => {
  it.each(['City', 'city'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('city');
  });
});

describe('state', () => {
  it.each(['State', 'State/Province', 'Province'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('state');
  });
});

describe('zipCode', () => {
  it.each(['Zip Code', 'Zip', 'Postal Code', 'Postal'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('zipCode');
  });
});

describe('country', () => {
  it.each(['Country', 'Country *', 'Country of Residence'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('country');
  });

  it('should not match "country" mid-string', () => {
    expect(classifyField('Select your home country')).not.toBe('country');
  });
});

// ── "How did you hear" is __skip__ (handled by Tier 1 / answer bank) ──

describe('howDidYouHear', () => {
  it.each([
    'How did you hear about us?',
    'How did you hear about this position?',
    'How did you find this position?',
    'How did you learn about this opportunity?',
    'Where did you hear about us?',
  ])('should classify "%s" as __skip__', (label) => {
    expect(classifyField(label)).toBe('__skip__');
  });
});

// ── "Additional Information" is __skip__ ──

describe('additional information', () => {
  it.each(['Additional Information', 'Additional context'])(
    'should classify "%s" as __skip__',
    (label) => {
      expect(classifyField(label)).toBe('__skip__');
    },
  );
});

// ── Link fields ──

describe('linkedin', () => {
  it.each(['LinkedIn', 'LinkedIn URL', 'LinkedIn Profile'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('linkedin');
  });
});

describe('github', () => {
  it.each(['GitHub', 'GitHub URL', 'GitHub Profile'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('github');
  });
});

describe('twitter', () => {
  it.each(['Twitter', 'Twitter URL', 'X Profile', 'X profile'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('twitter');
  });
});

describe('portfolio', () => {
  it.each(['Portfolio', 'Portfolio URL', 'Website', 'Personal Website'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('portfolio');
    },
  );
});

describe('otherUrl', () => {
  it.each(['Other Website', 'Other URL', 'Other Link'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('otherUrl');
  });
});

// ── Work / Education ──

describe('company', () => {
  it.each(['Company', 'Current Company', 'Employer'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('company');
  });
});

describe('jobTitle', () => {
  it.each(['Current Title', 'Job Title'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('jobTitle');
  });
});

describe('school', () => {
  it.each(['School', 'University', 'College'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('school');
  });
});

describe('graduationDate', () => {
  it.each(['Graduation Date', 'Graduation Year', 'Expected Graduation', 'Grad Date'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('graduationDate');
    },
  );
});

// ── Location ──

describe('location', () => {
  it.each(['Location', 'Current Location', 'Where are you located?'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('location');
    },
  );
});

// ── isHispanic (short unambiguous labels handled by Tier 2) ──

describe('isHispanic', () => {
  it.each(['Hispanic/Latino', 'Are you Hispanic or Latino?', 'Are you Hispanic?'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('isHispanic');
    },
  );
});

// ── Categories delegated to Tier 1 (options-classify) or Tier 3 (ML) ──
// These are NOT handled by patterns.ts and should return null

describe('categories handled by Tier 1/3 (not patterns)', () => {
  it.each([
    ['Are you currently located in the US?', 'locatedInUS'],
    ['Are you legally authorized to work in the United States?', 'workAuth'],
    ['Will you now or in the future require visa sponsorship?', 'sponsorship'],
    ['Are you willing to relocate?', 'relocate'],
    ['When can you start?', 'startDate'],
    ['Are you 18 years of age or older?', 'isOver18'],
    ['What is your current age?', 'ageRange'],
    ['Have you worked at this company before?', 'workedHereBefore'],
    ['Privacy Policy', 'privacyConsent'],
    ['Can we reach you via SMS?', 'smsConsent'],
    ['Recording consent', 'recordingConsent'],
    ['Please contact me about future opportunities', 'futureConsent'],
    ['Do you require any accommodation?', 'accommodationRequest'],
    ['Gender', 'gender'],
    ['Are you transgender?', 'transgender'],
    ['Sexual Orientation', 'sexualOrientation'],
    ['Race', 'race'],
    ['Veteran Status', 'veteranStatus'],
    ['Disability Status', 'disabilityStatus'],
    ['Do you identify as LGBTQ+?', 'lgbtq'],
    ['Pronouns', 'pronouns'],
    ['Degree', 'degree'],
  ])('should return null for "%s" (handled as %s by Tier 1/3)', (label) => {
    expect(classifyField(label)).toBeNull();
  });
});

// ── Null / unmatched ──

describe('should return null for unrelated labels', () => {
  it.each([
    'Submit',
    'Next',
    'Save and Continue',
    'Apply Now',
    'Describe your background',
    'Why do you want to work here?',
    'Describe your experience',
    '',
    '   ',
  ])('should return null for "%s"', (label) => {
    expect(classifyField(label)).toBeNull();
  });
});

// ── Edge cases ──

describe('edge cases', () => {
  it('should handle leading/trailing whitespace', () => {
    expect(classifyField('  Email  ')).toBe('email');
  });

  it('should handle newlines and multi-space in labels', () => {
    expect(classifyField('First\n  Name')).toBe('firstName');
  });

  it('should handle mixed case', () => {
    expect(classifyField('FIRST NAME')).toBe('firstName');
    expect(classifyField('eMaIl AdDrEsS')).toBe('email');
  });

  it('should classify short "How did you hear" labels as __skip__', () => {
    expect(classifyField('How did you hear about us?')).toBe('__skip__');
    expect(classifyField('Where did you hear about us?')).toBe('__skip__');
  });

  it('should prefer firstName over fullName for "First Name"', () => {
    expect(classifyField('First Name')).toBe('firstName');
  });

  it('should match "Name" as fullName, not firstName', () => {
    expect(classifyField('Name')).toBe('fullName');
  });

  it('should match "Other Website" as otherUrl, not portfolio', () => {
    expect(classifyField('Other Website')).toBe('otherUrl');
  });

  it('should match job title as jobTitle category', () => {
    expect(classifyField('Current Title')).toBe('jobTitle');
    expect(classifyField('Job Title')).toBe('jobTitle');
  });

  it('should classify salary fields as __skip__', () => {
    expect(classifyField('Salary Expectations')).toBe('__skip__');
    expect(classifyField('What are your salary expectations?')).toBe('__skip__');
    expect(classifyField('Desired Compensation')).toBe('__skip__');
    expect(classifyField('Expected Pay Range')).toBe('__skip__');
  });

  it('should not match "country" when it appears mid-label', () => {
    expect(classifyField('In which country do you reside?')).not.toBe('country');
  });
});
