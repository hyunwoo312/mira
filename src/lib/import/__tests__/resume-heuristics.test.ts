import { describe, it, expect } from 'vitest';
import { parseResumeText } from '../resume-heuristics';

describe('parseResumeText — top-of-document', () => {
  it('extracts a two-word name from the first line', () => {
    const text = `Avery Chen
avery@example.com · (555) 010-0100`;
    const out = parseResumeText(text);
    expect(out.firstName).toBe('Avery');
    expect(out.lastName).toBe('Chen');
  });

  it('extracts a three-word name', () => {
    const text = `Maria del Carmen
maria@example.com`;
    const out = parseResumeText(text);
    expect(out.firstName).toBe('Maria');
    expect(out.lastName).toBe('Carmen');
  });

  it('skips lines like "RESUME"', () => {
    const text = `RESUME
Avery Chen
avery@example.com`;
    const out = parseResumeText(text);
    expect(out.firstName).toBe('Avery');
    expect(out.lastName).toBe('Chen');
  });

  it('skips lines with digits or @', () => {
    const text = `123 Main St
avery@example.com
Avery Chen`;
    const out = parseResumeText(text);
    // Name on third line — but our heuristic only checks first 3 lines, so this works
    expect(out.firstName).toBe('Avery');
  });
});

describe('parseResumeText — contact info', () => {
  it('extracts email', () => {
    const text = `Avery Chen
Software Engineer
avery.chen+work@example.co.uk`;
    expect(parseResumeText(text).email).toBe('avery.chen+work@example.co.uk');
  });

  it('extracts US-style phone number', () => {
    const text = `Avery Chen
(555) 010-0100`;
    const out = parseResumeText(text);
    expect(out.phone).toMatch(/5550100100/);
  });

  it('extracts international phone number', () => {
    const text = `Avery Chen
+44 20 7946 0958`;
    expect(parseResumeText(text).phone).toMatch(/\+/);
  });

  it('extracts phone with extra spacing around dash', () => {
    const text = `Avery Chen
Mobile : (302) 803 - 0285`;
    expect(parseResumeText(text).phone).toBe('3028030285');
  });
});

describe('parseResumeText — links', () => {
  it('extracts LinkedIn, GitHub, Twitter', () => {
    const text = `Avery Chen
linkedin.com/in/averychen
https://github.com/averychen
https://x.com/averychen`;
    const out = parseResumeText(text);
    expect(out.linkedin).toContain('linkedin.com/in/averychen');
    expect(out.github).toContain('github.com/averychen');
    expect(out.twitter).toContain('x.com/averychen');
  });

  it('detects portfolio as the non-social URL', () => {
    const text = `Avery Chen
linkedin.com/in/averychen
https://averychen.dev`;
    const out = parseResumeText(text);
    expect(out.portfolio).toContain('averychen.dev');
  });

  it('adds https:// to bare-domain links', () => {
    const text = `Avery Chen
linkedin.com/in/averychen`;
    expect(parseResumeText(text).linkedin).toMatch(/^https:\/\//);
  });
});

describe('parseResumeText — work experience', () => {
  it('parses a single experience entry with dates', () => {
    const text = `Avery Chen
avery@example.com

EXPERIENCE
Software Engineer at Stripe
Jul 2022 - Present
Built core payment infrastructure.`;
    const out = parseResumeText(text);
    expect(out.workExperience).toBeDefined();
    expect(out.workExperience!.length).toBeGreaterThanOrEqual(1);
    const first = out.workExperience![0]!;
    expect(first.title.toLowerCase()).toContain('software engineer');
    expect(first.company.toLowerCase()).toContain('stripe');
    expect(first.startYear).toBe(2022);
    expect(first.startMonth).toBe(7);
    expect(first.current).toBe(true);
  });

  it('parses MM/YYYY numeric dates', () => {
    const text = `EXPERIENCE
Software Engineer at Stripe
07/2022 - 11/2024
Built things.`;
    const out = parseResumeText(text);
    const first = out.workExperience![0]!;
    expect(first.startMonth).toBe(7);
    expect(first.startYear).toBe(2022);
    expect(first.endMonth).toBe(11);
    expect(first.endYear).toBe(2024);
  });

  it('parses YYYY-MM numeric dates', () => {
    const text = `EXPERIENCE
Software Engineer at Stripe
2022-07 - 2024-11
Did stuff.`;
    const out = parseResumeText(text);
    const first = out.workExperience![0]!;
    expect(first.startYear).toBe(2022);
    expect(first.startMonth).toBe(7);
    expect(first.endYear).toBe(2024);
    expect(first.endMonth).toBe(11);
  });

  it('detects "—" separator between title and company', () => {
    const text = `EXPERIENCE
Engineer — Anthropic
2024 - Present`;
    const out = parseResumeText(text);
    expect(out.workExperience![0]!.title.toLowerCase()).toContain('engineer');
    expect(out.workExperience![0]!.company.toLowerCase()).toContain('anthropic');
  });

  it('parses Jake-style "Company / Title+Date" entries with separate boundaries', () => {
    // Mirrors LaTeX templates where the company is one line and the title+date
    // sit on the next, with • as a column separator that normalizeLines drops.
    const text = `EXPERIENCE
Acme Corp New York, NY
•
Senior Engineer — Platform Jan 2022 - Aug 2023
◦ Built things.
Beta Inc Remote
•
Engineer May 2020 - Dec 2021
◦ Did stuff.`;
    const out = parseResumeText(text);
    expect(out.workExperience).toHaveLength(2);
    const [first, second] = out.workExperience!;
    expect(first!.company.toLowerCase()).toContain('acme');
    expect(first!.title.toLowerCase()).toContain('senior engineer');
    expect(first!.startYear).toBe(2022);
    expect(first!.endYear).toBe(2023);
    expect(second!.company.toLowerCase()).toContain('beta');
    expect(second!.title.toLowerCase()).toContain('engineer');
    expect(second!.startYear).toBe(2020);
  });

  it('keeps PDF text-wrap continuations out of entry boundaries', () => {
    // The "Framer Motion." line is a wrap-continuation of the previous bullet,
    // not a new entry header. The lookahead rule (date must be on i+1) keeps it
    // bundled with its parent entry.
    const text = `EXPERIENCE
Acme Corp Remote
Engineer Jan 2022 - Present
◦ Built a system using GSAP and
Framer Motion.
◦ Other work.`;
    const out = parseResumeText(text);
    expect(out.workExperience).toHaveLength(1);
    expect(out.workExperience![0]!.description).toContain('Framer Motion');
  });
});

describe('parseResumeText — education', () => {
  it('parses university + degree + dates', () => {
    const text = `EDUCATION
Stanford University
B.S. in Computer Science
2018 - 2022
GPA: 3.85`;
    const out = parseResumeText(text);
    expect(out.education).toBeDefined();
    const e = out.education![0]!;
    expect(e.school.toLowerCase()).toContain('stanford');
    expect(e.degree.toLowerCase()).toMatch(/b\.?s\.?/);
    expect(e.fieldOfStudy.toLowerCase()).toContain('computer science');
    expect(e.startYear).toBe(2018);
    expect(e.gradYear).toBe(2022);
    expect(e.gpa).toBe('3.85');
  });
});

describe('parseResumeText — skills/certifications/languages', () => {
  it('parses skills section as comma/bullet-separated list', () => {
    const text = `SKILLS
React · TypeScript · Go · Postgres · Kubernetes`;
    const out = parseResumeText(text);
    expect(out.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Go', 'Postgres', 'Kubernetes']),
    );
  });

  it('recognizes "Programming Skills" header', () => {
    const text = `Programming Skills
Python, TypeScript, Go`;
    const out = parseResumeText(text);
    expect(out.skills).toEqual(expect.arrayContaining(['Python', 'TypeScript', 'Go']));
  });

  it('parses certifications', () => {
    const text = `CERTIFICATIONS
AWS Solutions Architect, Kubernetes CKA`;
    const out = parseResumeText(text);
    expect(out.certifications).toEqual(
      expect.arrayContaining(['AWS Solutions Architect', 'Kubernetes CKA']),
    );
  });

  it('parses languages with proficiency in parens', () => {
    const text = `LANGUAGES
English (Native), Spanish (Conversational)`;
    const out = parseResumeText(text);
    expect(out.languages).toBeDefined();
    expect(out.languages!.find((l) => l.language === 'English')?.proficiency).toBe('Native');
  });

  it('parses languages without proficiency', () => {
    const text = `LANGUAGES
English, Polish`;
    const out = parseResumeText(text);
    expect(out.languages).toEqual([
      { language: 'English', proficiency: '' },
      { language: 'Polish', proficiency: '' },
    ]);
  });
});

describe('parseResumeText — empty/invalid input', () => {
  it('returns empty object for empty text', () => {
    expect(parseResumeText('')).toEqual({});
  });

  it('returns empty object for whitespace-only text', () => {
    expect(parseResumeText('   \n  \n\t')).toEqual({});
  });

  it('returns name-only when only name line exists', () => {
    expect(parseResumeText('Avery Chen')).toMatchObject({
      firstName: 'Avery',
      lastName: 'Chen',
    });
  });
});
