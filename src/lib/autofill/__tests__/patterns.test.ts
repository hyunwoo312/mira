import { classifyField } from '../classify/patterns';

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
  it.each([
    'Name',
    'Name *',
    'Name✱',
    'Full Name',
    'FullName',
    'First Name and Last Name',
    'First name & Last name',
  ])('should classify "%s"', (label) => {
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

// ── Referral ──

describe('referral', () => {
  it.each([
    'Were you referred by a current Tarro/Wonders employee?',
    'Were you referred by anyone at our company?',
    'Referral from a current employee',
    'Who referred you?',
  ])('should classify "%s" as referral', (label) => {
    expect(classifyField(label)).toBe('referral');
  });
});

// ── "How did you hear" is __skip__ ──

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

// ── Follow-up / conditional fields are __skip__ ──

describe('follow-up fields', () => {
  it.each([
    'If you selected "Other", please let us know how you heard about Zip.',
    'If you selected other, please specify',
    'If yes who were you referred by (Current Employee Name)',
    'If no, please explain',
    'If so, please provide details',
    'Please specify your answer above',
    'Please describe your disability',
    'Please elaborate on your response',
  ])('should classify "%s" as __skip__', (label) => {
    expect(classifyField(label)).toBe('__skip__');
  });
});

describe('referral follow-up fields', () => {
  it.each([
    'How do you know them? (This will not affect your candidacy)',
    'How do you know them?',
    'How did you know each other?',
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

describe('degree', () => {
  it.each(['Degree', 'Degree Type', 'Level of Education'])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('degree');
  });
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

// ── isHispanic ──

describe('isHispanic', () => {
  it.each(['Hispanic/Latino', 'Are you Hispanic or Latino?', 'Are you Hispanic?'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('isHispanic');
    },
  );
});

// ── Categories handled by heuristic patterns ──

describe('heuristic-only categories', () => {
  it.each([
    ['Are you currently located in the US?', 'locatedInUS'],
    ['Have you worked at this company before?', 'workedHereBefore'],
    ['Pronouns', 'pronouns'],
    ['Are you currently enrolled in a university?', 'currentlyEnrolled'],
    ['Are you interested in a full-time offer?', 'fullTimeInterest'],
    ['Does this position require ITAR compliance?', 'exportControl'],
  ])('should classify "%s" as %s', (label, expected) => {
    expect(classifyField(label)).toBe(expected);
  });
});

// ── Categories delegated to ML (Tier 3) — heuristic returns null ──
// These are intentionally NOT handled by patterns.ts anymore.
// They are classified by the ML model which handles phrasing variants better.

describe('categories delegated to ML (should return null from patterns)', () => {
  it.each([
    'Will you now or in the future require visa sponsorship?',
    'Are you willing to relocate?',
    'Are you 18 years of age or older?',
    'What is your current age?',
    'Can we reach you via SMS?',
    'Do you require any accommodation?',
    'Gender',
    'Are you transgender?',
    'Sexual Orientation',
    'Race',
    'Veteran Status',
    'Disability Status',
    'Do you identify as LGBTQ+?',
    'Graduation Date',
    'Graduation Year',
    'Expected Graduation',
    'Grad Date',
    'Recording consent',
    'Please contact me about future opportunities',
    'Acknowledge/Confirm',
    'Acknowledge',
    'Expected Pay Range',
  ])('should return null for "%s"', (label) => {
    expect(classifyField(label)).toBeNull();
  });

  // These were previously ML-delegated but are now caught by heuristics
  it.each([
    ['Are you legally authorized to work in the United States?', 'workAuth'],
    ['When can you start?', 'startDate'],
    ['Privacy Policy', 'consent'],
    ['Salary Expectations', 'salaryRange'],
    ['What are your salary expectations?', 'salaryRange'],
    ['Desired Compensation', 'salaryRange'],
  ])('should classify "%s" as %s (heuristic)', (label, expected) => {
    expect(classifyField(label)).toBe(expected);
  });
});

// ── Workday application questions — heuristic subset ──

describe('Workday application questions (heuristic-matched)', () => {
  it.each([
    ['Do you have relatives currently employed by Clearwater Analytics?', 'referral'],
    ['Were you referred by a Clearwater Analytics employee?', 'referral'],
    ['How did you hear about this position?', '__skip__'],
  ])('should classify "%s" as %s', (label, expected) => {
    expect(classifyField(label)).toBe(expected);
  });
});

describe('Workday application questions (ML-delegated)', () => {
  it.each([
    'Will you now or in the future require sponsorship?',
    'Are you open to relocation to the primary posting location?',
  ])('should return null for "%s"', (label) => {
    expect(classifyField(label)).toBeNull();
  });

  // These were previously ML-delegated but are now caught by heuristics
  it.each([
    ['Are you legally permitted to work in the country where this job is located?', 'workAuth'],
    ['If hired, can you provide proof of eligibility?', 'canProvideDoc'],
    ['What is your desired start date?', 'startDate'],
  ])('should classify "%s" as %s (heuristic)', (label, expected) => {
    expect(classifyField(label)).toBe(expected);
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

  it('should not match "country" when it appears mid-label', () => {
    expect(classifyField('In which country do you reside?')).not.toBe('country');
  });

  it('should guard against very long labels', () => {
    const longLabel = 'A'.repeat(600);
    expect(classifyField(longLabel)).toBeNull();
  });

  it('should not match broad categories on long question-style labels', () => {
    expect(
      classifyField(
        'What email address should we use to contact you about your application status and next steps?',
      ),
    ).toBeNull();
  });
});
