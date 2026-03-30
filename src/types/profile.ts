export const PROFILE_SECTIONS = [
  { id: 'personal', label: 'Personal', icon: 'User' },
  { id: 'links', label: 'Links', icon: 'Link' },
  { id: 'work', label: 'Work Experience', icon: 'Briefcase' },
  { id: 'education', label: 'Education', icon: 'GraduationCap' },
  { id: 'skills', label: 'Skills & Languages', icon: 'Star' },
  { id: 'preferences', label: 'Work Preferences', icon: 'Settings' },
  { id: 'eeo', label: 'EEO', icon: 'Shield' },
  { id: 'documents', label: 'Documents', icon: 'FileText' },
  { id: 'answers', label: 'Answer Bank', icon: 'MessageSquare' },
] as const;

export type SectionId = (typeof PROFILE_SECTIONS)[number]['id'];
