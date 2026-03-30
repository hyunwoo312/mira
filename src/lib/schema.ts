import { z } from 'zod';

const workEntrySchema = z.object({
  company: z.string().max(200).default(''),
  title: z.string().max(200).default(''),
  startMonth: z.number().min(1).max(12).optional(),
  startYear: z.number().min(1950).max(2100).optional(),
  endMonth: z.number().min(1).max(12).optional(),
  endYear: z.number().min(1950).max(2100).optional(),
  current: z.boolean().default(false),
  description: z.string().max(2000).default(''),
});

const educationEntrySchema = z.object({
  school: z.string().max(200).default(''),
  degree: z.string().max(100).default(''),
  fieldOfStudy: z.string().max(100).default(''),
  minor: z.string().max(100).default(''),
  startMonth: z.number().min(1).max(12).optional(),
  startYear: z.number().min(1950).max(2100).optional(),
  gradMonth: z.number().min(1).max(12).optional(),
  gradYear: z.number().min(1950).max(2100).optional(),
  gpa: z.string().max(10).default(''),
});

const languageEntrySchema = z.object({
  language: z.string().max(50).default(''),
  proficiency: z.string().max(50).default(''),
});

const linkEntrySchema = z.object({
  label: z.string().max(50).default(''),
  url: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
});

const answerEntrySchema = z.object({
  question: z.string().max(500).default(''),
  answer: z.string().max(2000).default(''),
});

export const profileSchema = z.object({
  // Personal
  firstName: z.string().max(100).default(''),
  lastName: z.string().max(100).default(''),
  preferredName: z.string().max(100).default(''),
  pronouns: z.string().max(50).default(''),
  email: z.string().email('Invalid email').max(255).or(z.literal('')).default(''),
  phone: z.string().max(20).default(''),
  address1: z.string().max(200).default(''),
  address2: z.string().max(200).default(''),
  city: z.string().max(100).default(''),
  state: z.string().max(100).default(''),
  zipCode: z.string().max(20).default(''),
  country: z.string().max(100).default(''),
  dateOfBirth: z.string().max(10).default(''), // YYYY-MM-DD format

  // Links
  linkedin: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
  github: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
  portfolio: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
  twitter: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
  additionalUrlLabel: z.string().max(50).default(''),
  additionalUrl: z.string().url('Invalid URL').max(500).or(z.literal('')).default(''),
  additionalLinks: z.array(linkEntrySchema).default([]),

  // Work Experience
  workExperience: z.array(workEntrySchema).default([]),

  // Education
  education: z.array(educationEntrySchema).default([]),

  // Skills & Languages
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(languageEntrySchema).default([]),

  // Work Preferences
  salaryMin: z.string().max(20).default(''),
  salaryMax: z.string().max(20).default(''),
  workAuthorization: z.boolean().default(true),
  sponsorshipNeeded: z.boolean().default(false),
  willingToRelocate: z.boolean().default(false),
  willingToTravel: z.boolean().default(false),
  workArrangement: z.array(z.string()).default([]),
  earliestStartMonth: z.number().min(1).max(12).optional(),
  earliestStartYear: z.number().min(1950).max(2100).optional(),
  noticePeriod: z.string().max(50).default(''),
  visaType: z.string().max(50).default(''), // US Citizen, Green Card, H1B, OPT, etc.
  securityClearance: z.string().max(50).default(''), // None, Confidential, Secret, Top Secret, TS-SCI
  smsConsent: z.boolean().default(false),

  // Answer Bank
  answerBank: z.array(answerEntrySchema).default([]),

  // EEO
  skipEeo: z.boolean().default(false),
  gender: z.string().max(50).default(''),
  transgender: z.string().max(50).default(''),
  sexualOrientation: z.string().max(50).default(''),
  race: z.string().max(100).default(''),
  veteranStatus: z.string().max(50).default(''),
  disabilityStatus: z.string().max(50).default(''),
  lgbtq: z.string().max(50).default(''),
});

export type Profile = z.infer<typeof profileSchema>;
export type WorkEntry = z.infer<typeof workEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type LinkEntry = z.infer<typeof linkEntrySchema>;
export type LanguageEntry = z.infer<typeof languageEntrySchema>;
export type AnswerEntry = z.infer<typeof answerEntrySchema>;

export const DEFAULT_PROFILE: Profile = profileSchema.parse({});

/**
 * Schema version — increment when adding/removing/renaming profile fields.
 * Each version bump should have a corresponding migration in storage.ts.
 *
 * Version history:
 *   1 — Initial schema (personal, links, work, education, skills, preferences, EEO)
 *   2 — Added twitter, willingToTravel, smsConsent, visaType, securityClearance
 *   3 — Added additionalLinks array
 */
export const SCHEMA_VERSION = 3;
