import type { Profile } from '@/lib/schema';

export type ImportSource = 'resume-pdf';

export type ImportMode =
  | 'overwrite-all' // parsed value wins on every field with a parsed value
  | 'skip-conflicts' // parsed value only fills empty fields
  | 'skip-all'; // skip all parsed fields; only attach the file as a document

export interface ImportPayload {
  source: ImportSource;
  fileName: string;
  fileSize: number;
  /** Parsed fields, possibly empty. For "Skip all", these are ignored on commit. */
  fields: Partial<Profile>;
  /** Raw file bytes — caller is responsible for attaching to the preset's documents. */
  file: File;
}

export interface ImportCommitResult {
  profile: Profile;
  attachFile: boolean;
  fieldsApplied: number;
  fieldsSkipped: number;
  conflictsResolved: number;
}
