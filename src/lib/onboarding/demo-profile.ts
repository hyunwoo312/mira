import { profileSchema, type Profile } from '@/lib/schema';

// Indices match field-options.ts ordering (a stable contract enforced by
// storage migrations).
const DEMO_PROFILE_INPUT = {
  firstName: 'Mira',
  lastName: 'Lewandowski',
  preferredName: '',
  pronouns: 'She/her',
  email: 'mira.lewandowski@example.com',
  phone: '+1 (415) 555-0142',
  address1: '1 Market St',
  address2: '',
  city: 'San Francisco',
  state: 'California',
  zipCode: '94105',
  country: 'United States',
  dateOfBirth: '1999-06-15',

  linkedin: 'https://linkedin.com/in/mira-lewandowski',
  github: 'https://github.com/mira-lewandowski',
  portfolio: 'https://miralew.dev',
  twitter: '',
  additionalUrl: '',
  additionalLinks: [],

  workExperience: [
    {
      company: 'Stripe',
      title: 'Software Engineer',
      location: 'San Francisco, CA',
      startMonth: 7,
      startYear: 2022,
      current: true,
      description:
        'Building developer tooling on the API platform team. Led the rollout of two latency-improving primitives now used across 40+ services.',
    },
    {
      company: 'Microsoft',
      title: 'Software Engineering Intern',
      location: 'Redmond, WA',
      startMonth: 6,
      startYear: 2021,
      endMonth: 8,
      endYear: 2021,
      current: false,
      description:
        'Azure App Service team. Shipped a config-validation tool that caught misconfigurations across customer deployments.',
    },
  ],

  education: [
    {
      school: 'Stanford University',
      degree: "Bachelor's Degree",
      fieldOfStudy: 'Computer Science',
      minor: 'Mathematics',
      startMonth: 9,
      startYear: 2018,
      gradMonth: 6,
      gradYear: 2022,
      gpa: '3.8',
    },
  ],

  skills: ['Python', 'TypeScript', 'React', 'PostgreSQL', 'AWS', 'Docker', 'Go'],
  certifications: [],
  languages: [
    { language: 'English', proficiency: 'Native' },
    { language: 'Polish', proficiency: 'Native' },
  ],

  salaryMin: '160000',
  salaryMax: '200000',
  workAuthorization: true,
  sponsorshipNeeded: false,
  willingToRelocate: true,
  needsRelocationAssistance: false,
  willingToTravel: true,
  workArrangement: ['Hybrid', 'On-site'],
  noticePeriod: 1, // "2 weeks"
  visaType: 0, // "US Citizen"
  securityClearance: 0, // "None"
  smsConsent: true,

  answerBank: [
    {
      question: 'Why are you interested in this role?',
      answer:
        "I'm drawn to teams that ship products with strong engineering taste — small surface area, clear contracts, and real users. The work you're describing fits how I want to spend the next few years.",
    },
    {
      question: 'Tell us about a recent project.',
      answer:
        'Most recently I led a migration off a homegrown rate limiter onto a token-bucket service. The wins were measured in bps not 9s, but it removed an entire class of incidents and let the platform team stop being on-call for it.',
    },
  ],

  skipEeo: false,
  gender: 1, // "Female"
  transgender: 1, // "No"
  sexualOrientation: 0, // "Heterosexual / Straight"
  race: 5, // "White"
  veteranStatus: 0, // "I am not a protected veteran"
  disabilityStatus: 1, // "No, I do not have a disability"
} as const;

export const DEMO_PROFILE: Profile = profileSchema.parse(DEMO_PROFILE_INPUT);
