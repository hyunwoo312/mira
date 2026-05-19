import { classifyField, detectMultiLinkPrompt } from '../classify/patterns';

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

  // Bare `street` substring used to fire on long-prose labels.
  it('should NOT classify "Walk us through the impact of Wall Street on the global economy" as address1', () => {
    expect(
      classifyField('Walk us through the impact of Wall Street on the global economy'),
    ).not.toBe('address1');
  });
});

describe('address2', () => {
  it.each(['Address Line 2', 'Apt', 'Suite', 'Apt/Suite/Other'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('address2');
    },
  );

  it('should NOT match "business unit" inside a long question label', () => {
    const longQuestion =
      'Have you been employed by Lyft, or any subsidiary, affiliate, or business unit of Lyft, in the past?';
    expect(classifyField(longQuestion)).not.toBe('address2');
  });
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
  it.each(['Zip Code', 'Zip', 'Postal Code', 'Postal', 'ZIP', 'Zipcode', 'Postcode'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('zipCode');
    },
  );

  // Zip ATS embeds "Zip" as the company name inside long Q labels — bare
  // substring matching used to stuff "77382" into the textarea answer.
  it.each([
    "What's got you looking for a new role right now and why are you interested in Zip specifically?",
    'Why do you want to join Zip?',
    "What excites you about Zip's mission?",
    'Tell us about your experience with zip files',
  ])('should NOT classify long-prompt mentioning Zip "%s" as zipCode', (label) => {
    expect(classifyField(label)).not.toBe('zipCode');
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

// ── "How did you hear" defaults to LinkedIn ──

describe('howDidYouHear', () => {
  it.each([
    'How did you hear about us?',
    'How did you hear about this position?',
    'How did you find this position?',
    'How did you learn about this opportunity?',
    'Where did you hear about us?',
  ])('should classify "%s" as hearAbout', (label) => {
    expect(classifyField(label)).toBe('hearAbout');
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

// ── Background-check questions skip to prevent silent wrong-fill ──
//
// Without this, ML observed routing them to `relocate` (~73%), which would
// emit a willingToRelocate-driven "No" for users with that flag false — a
// wrong answer to a background-check question. See temp-fillside-notes.md.
describe('background-check Yes/No questions', () => {
  it.each([
    'Are you willing to undergo a background check as part of our recruitment process, if required?',
    'Are you willing to undergo a background check?',
    'Background check authorization',
    'Will you consent to a background check?',
  ])('should classify "%s" as __skip__', (label) => {
    expect(classifyField(label)).toBe('__skip__');
  });
});

// ── relocationAssistance vs relocate disambiguation ──
//
// ML observed routing "Will you need relocation assistance..." to `relocate`
// (~0.95-0.97) even after retrain because of class imbalance + shared
// "relocation" lexeme. The heuristic fast-path makes this deterministic.
describe('relocationAssistance', () => {
  it.each([
    "Will you need relocation assistance to work at this role's specified location?",
    'Do you need relocation assistance?',
    'Will you require relocation support?',
    'Do you need a relocation package?',
    'Relocation stipend',
    'Are you requesting relocation reimbursement?',
    'Need relocation allowance?',
  ])('should classify "%s" as relocationAssistance', (label) => {
    expect(classifyField(label)).toBe('relocationAssistance');
  });
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

  it.each([
    'Do you have a Github/Gitlab profile to share with our hiring team?',
    'If yes, please provide your Github/Gitlab profile.',
  ])('should classify "%s"', (label) => {
    expect(classifyField(label)).toBe('github');
  });
});

// CommerceIQ shipped "Do you have a Bachelor's in Computer Science?" as
// Yes/No → ML routed to customQuestion → no-value skip. The heuristic
// captures the structural pattern; the dynamic resolver in profile-map
// derives Yes/No from profile.education.
describe('hasDegreeIn (degree-eligibility Yes/No questions)', () => {
  it.each([
    "Do you have a Bachelor's in Computer Science?",
    'Do you have a Bachelor in Computer Science?',
    "Do you have a Master's in Mechanical Engineering?",
    'Do you have a PhD in Physics?',
    'Do you hold a Bachelor of Science in Mathematics?',
    'Have you completed a Bachelor in Computer Science?',
    'Do you have a degree in Computer Science?',
    "Do you have a Bachelor's degree in Computer Science or related field?",
    'Do you have an MBA in Finance?',
  ])('should classify "%s" as hasDegreeIn', (label) => {
    expect(classifyField(label)).toBe('hasDegreeIn');
  });

  // Don't catch "experience" / "skill" Yes/No — those route via existing flow.
  it.each([
    'Do you have experience in Computer Science?',
    'Are you skilled in Computer Science?',
    'Do you have any background in Computer Science?',
  ])('should NOT classify experience-style "%s" as hasDegreeIn', (label) => {
    expect(classifyField(label)).not.toBe('hasDegreeIn');
  });
});

describe('profileLinks (multi-link enumeration)', () => {
  // CommerceIQ shipped a textarea asking for "Github, Stackoverflow, or
  // other technical profile" — single-link heuristics stuffed only one URL.
  // Multi-link detection is now exposed via `detectMultiLinkPrompt` and
  // applied in `classify/index.ts` only on textareas — Gallatin AI's
  // single-line "Portfolio URL or GitHub URL" silent wrong-fill is the
  // reason for the textarea-only gate. classifyField itself never returns
  // profileLinks; the fallthrough to per-link heuristics (github wins
  // first in pattern order) keeps single-line inputs with one valid URL.
  it.each([
    'Please provide your Github, Stackoverflow, or other technical profile.',
    'Github / Stackoverflow / Portfolio',
    'LinkedIn, GitHub, and Portfolio links',
    'GitHub or Stackoverflow link',
    'Stack Overflow / GitLab / Dribbble',
    'Portfolio URL or GitHub URL',
  ])('detectMultiLinkPrompt returns true for "%s"', (label) => {
    expect(detectMultiLinkPrompt(label)).toBe(true);
  });

  it.each([
    'GitHub',
    'LinkedIn URL',
    'Twitter',
    'Portfolio website',
    'Your GitHub or another GitHub', // repeated same platform
    'Stack Overflow',
  ])('detectMultiLinkPrompt returns false for "%s"', (label) => {
    expect(detectMultiLinkPrompt(label)).toBe(false);
  });

  // classifyField itself never returns profileLinks — that's the textarea-
  // gated path in classify/index.ts.
  it('classifyField never returns profileLinks (textarea gate is in index.ts)', () => {
    expect(classifyField('Github / Stackoverflow / Portfolio')).not.toBe('profileLinks');
  });

  // Single-link labels still route to their specific category.
  it.each([
    ['GitHub', 'github'],
    ['LinkedIn URL', 'linkedin'],
    ['Twitter', 'twitter'],
    ['Portfolio website', 'portfolio'],
  ])('classifyField routes single-link "%s" to %s', (label, expected) => {
    expect(classifyField(label)).toBe(expected);
  });

  // For multi-link prompts on single-line inputs (e.g. "Portfolio URL or
  // GitHub URL"), the per-link heuristic order picks one URL —
  // github wins because it appears earlier in the pattern list.
  it('routes "Portfolio URL or GitHub URL" to github via pattern order (single-line fallback)', () => {
    expect(classifyField('Portfolio URL or GitHub URL')).toBe('github');
  });

  it('returns null for bare "Stack Overflow" (no profile field)', () => {
    expect(classifyField('Stack Overflow')).toBeNull();
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
  it.each(['Company', 'Current Company', 'Employer', 'Most recent employer'])(
    'should classify "%s"',
    (label) => {
      expect(classifyField(label)).toBe('company');
    },
  );

  // Hadrian Ashby shipped "Curent Company" (one-r typo). ML routed to
  // customQuestion → skip no-value. Heuristic should tolerate the common
  // single-edit variants for "current" and "employer".
  it.each([
    'Curent Company',
    'Currrent Company',
    'Curent Employer',
    'Most Recent Employeer',
    'Previous Employeer',
  ])('should classify typo variant "%s" as company', (label) => {
    expect(classifyField(label)).toBe('company');
  });

  it.each(['May we contact your current employer?', 'Do you work for a competing employer?'])(
    'should NOT classify question "%s" as company',
    (label) => {
      expect(classifyField(label)).not.toBe('company');
    },
  );
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

  // Bare `university|college` substring used to fire on long-prose labels.
  it.each([
    'Did you attend a university? If so, please describe your overall experience there.',
    'Tell us how college shaped your career path so far in the long run.',
  ])('should NOT classify long-prose mention "%s" as school', (label) => {
    expect(classifyField(label)).not.toBe('school');
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

  // Sesame Ashby shipped "Are you willing to work from the required location?"
  // with Yes/No options. Bare-word `location` heuristic used to match and the
  // filler stuffed the user's city into the Yes/No widget → loud
  // no-option-match. These willingness/ability framings should fall through
  // to ML (canWorkFromLocation).
  it.each([
    'Are you willing to work from the required location?',
    'Are you able to work from this location?',
    'Are you open to working from the stated location?',
    'Open to working at our specified office location',
  ])('should NOT classify willingness question "%s" as location', (label) => {
    expect(classifyField(label)).not.toBe('location');
  });

  it('still classifies "Where are you located right now?" as location', () => {
    expect(classifyField('Where are you located right now?')).toBe('location');
  });
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

describe('pronouns vs pronunciation', () => {
  // Palantir Lever shipped a "Name Pronunciation | How do you pronounce
  // your name?" plain-text input. The substring regex /pronoun/i used to
  // match "pronounce" / "pronunciation" and stuff "He/Him" into the field.
  // The word-boundary fix means this label falls through to ML / no-value.
  it('does not classify "Pronunciation" as pronouns', () => {
    expect(classifyField('Name Pronunciation | How do you pronounce your name?')).not.toBe(
      'pronouns',
    );
  });
  it('still classifies "Pronouns" as pronouns', () => {
    expect(classifyField('Pronouns')).toBe('pronouns');
  });
});

// ── Categories handled by heuristic patterns ──

describe('heuristic-only categories', () => {
  it.each([
    ['Are you currently located in the US?', 'locatedInUS'],
    ['Have you worked at this company before?', 'workedHereBefore'],
    ['Pronouns', 'pronouns'],
    ['What are your preferred pronouns?', 'pronouns'],
    ['Are you currently enrolled in a university?', 'currentlyEnrolled'],
    ['Are you interested in a full-time offer?', 'fullTimeInterest'],
    ['Does this position require ITAR compliance?', 'exportControl'],
    [
      'Have you worked as a full-time software engineer in a professional setting (excluding internships)?',
      'hasExperience',
    ],
    [
      'Have you built and maintained user-facing web applications in a professional setting?',
      'hasExperience',
    ],
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
    // Relocation-assistance variants moved to the relocationAssistance heuristic
    // block (ML routing was unreliable, silent wrong-fill risk).
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
    ['How did you hear about this position?', 'hearAbout'],
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

  it('should classify short "How did you hear" labels as hearAbout', () => {
    expect(classifyField('How did you hear about us?')).toBe('hearAbout');
    expect(classifyField('Where did you hear about us?')).toBe('hearAbout');
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
