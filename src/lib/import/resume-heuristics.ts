import type { Profile, WorkEntry, EducationEntry } from '@/lib/schema';

const EMAIL_RE = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]{0,3})?(?:\(\d{2,4}\)|\d{2,4})[\s.-]{0,3}\d{3,4}[\s.-]{0,3}\d{3,4}/;
const BULLET_CHARS = '•*·\\-◦‣▪▫▸';
const BULLET_LEAD_RE = new RegExp(`^[${BULLET_CHARS}]\\s*`);
const BULLET_ONLY_RE = new RegExp(`^[${BULLET_CHARS}]\\s*$`);
const URL_RE = /https?:\/\/[^\s,;()<>]+|(?:www\.)[^\s,;()<>]+/gi;

const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w/-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w/-]+/i;
const TWITTER_RE = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[\w/-]+/i;

const SECTION_HEADERS = {
  experience: /^(?:work\s+experience|professional\s+experience|experience|employment)\b/i,
  education: /^(?:education|academic\s+background|qualifications)\b/i,
  skills: /^(?:skills|technical\s+skills|programming\s+skills|core\s+competencies)\b/i,
  certifications: /^(?:certifications|certificates|licenses)\b/i,
  languages: /^(?:languages?)\b/i,
  // Common ones we explicitly identify as "not the above" so they break a section.
  other: /^(?:projects|publications|awards|volunteer|references|summary|objective|profile)\b/i,
} as const;

type SectionId = keyof typeof SECTION_HEADERS;

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
] as const;

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Parse already-extracted resume text into a partial profile payload.
 * Pure function — no I/O, fully testable without pdfjs.
 */
export function parseResumeText(text: string): Partial<Profile> {
  const lines = normalizeLines(text);
  if (lines.length === 0) return {};

  const fields: Partial<Profile> = {};
  Object.assign(fields, extractName(lines));
  Object.assign(fields, extractContact(text));
  Object.assign(fields, extractLinks(text));

  const sections = splitIntoSections(lines);
  if (sections.experience) {
    const work = parseExperienceSection(sections.experience);
    if (work.length > 0) fields.workExperience = work;
  }
  if (sections.education) {
    const edu = parseEducationSection(sections.education);
    if (edu.length > 0) fields.education = edu;
  }
  if (sections.skills) {
    const skills = parseListSection(sections.skills);
    if (skills.length > 0) fields.skills = skills;
  }
  if (sections.certifications) {
    const certs = parseListSection(sections.certifications);
    if (certs.length > 0) fields.certifications = certs;
  }
  if (sections.languages) {
    const langs = parseLanguagesSection(sections.languages);
    if (langs.length > 0) fields.languages = langs;
  }

  return fields;
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !BULLET_ONLY_RE.test(l));
}

function extractName(lines: string[]): Partial<Profile> {
  // Heuristic: name lives in the first 3 lines. 2-4 words, no digits/@.
  // First and last words must start uppercase; middle words can be lowercase
  // particles (de, del, von, van, etc.).
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]!;
    if (/^(resume|curriculum\s+vitae|cv)$/i.test(line)) continue;
    if (/[@\d]/.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    const first = words[0]!;
    const last = words[words.length - 1]!;
    if (!/^[A-Z][\p{L}.'-]+$/u.test(first)) continue;
    if (!/^[A-Z][\p{L}.'-]+$/u.test(last)) continue;
    const middlesOk = words.slice(1, -1).every((w) => /^[\p{L}.'-]+$/u.test(w));
    if (!middlesOk) continue;
    return { firstName: first, lastName: last };
  }
  return {};
}

function extractContact(text: string): Partial<Profile> {
  const out: Partial<Profile> = {};
  const email = text.match(EMAIL_RE);
  if (email) out.email = email[0];
  const phone = text.match(PHONE_RE);
  if (phone) out.phone = normalizePhone(phone[0]);
  return out;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.length >= 7 ? digits : '';
}

function extractLinks(text: string): Partial<Profile> {
  const out: Partial<Profile> = {};
  const linkedin = text.match(LINKEDIN_RE);
  if (linkedin) out.linkedin = ensureProtocol(linkedin[0]);
  const github = text.match(GITHUB_RE);
  if (github) out.github = ensureProtocol(github[0]);
  const twitter = text.match(TWITTER_RE);
  if (twitter) out.twitter = ensureProtocol(twitter[0]);

  // Portfolio: any URL that isn't one of the social ones, prefer ones with personal-domain shape.
  const allUrls = Array.from(text.matchAll(URL_RE)).map((m) => m[0]);
  const portfolio = allUrls.find(
    (u) =>
      !LINKEDIN_RE.test(u) && !GITHUB_RE.test(u) && !TWITTER_RE.test(u) && !/mailto:|tel:/i.test(u),
  );
  if (portfolio) out.portfolio = ensureProtocol(portfolio);

  return out;
}

function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

function splitIntoSections(lines: string[]): Partial<Record<SectionId, string[]>> {
  const sections: Partial<Record<SectionId, string[]>> = {};
  let current: SectionId | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current && buffer.length > 0) {
      sections[current] = (sections[current] ?? []).concat(buffer);
    }
    buffer = [];
  };

  for (const line of lines) {
    const id = detectSectionHeader(line);
    if (id !== null) {
      flush();
      current = id === 'other' ? null : id;
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
  return sections;
}

function detectSectionHeader(line: string): SectionId | null {
  // Section headers are typically short (<=4 words), often UPPERCASE.
  if (line.length > 60) return null;
  for (const [id, re] of Object.entries(SECTION_HEADERS) as [SectionId, RegExp][]) {
    if (re.test(line)) return id;
  }
  return null;
}

function parseExperienceSection(lines: string[]): WorkEntry[] {
  const entries: WorkEntry[] = [];
  // An entry's boundary is a Capitalized non-bullet, non-date line whose next
  // 1-2 lines contain a date. The lookahead avoids false positives from PDF
  // text-wrapping — fragments like "Framer Motion." or "Extensions API" look
  // like headers but aren't followed by a date and so stay in the prior entry.
  let entryLines: string[] = [];
  let entryHasDateOrBullet = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isBullet = BULLET_LEAD_RE.test(line);
    const looksLikeHeader =
      !isBullet &&
      !hasDateRange(line) &&
      /^[A-Z][^a-z]{0,40}$|^[A-Z][\p{L}\s.,&'-]{0,80}$/u.test(line);
    const dateNearby = hasDateRange(lines[i + 1] ?? '');
    const startsNewEntry =
      entryLines.length > 0 && looksLikeHeader && entryHasDateOrBullet && dateNearby;
    if (startsNewEntry) {
      const entry = parseSingleExperience(entryLines);
      if (entry) entries.push(entry);
      entryLines = [];
      entryHasDateOrBullet = false;
    }
    entryLines.push(line);
    if (isBullet || hasDateRange(line)) entryHasDateOrBullet = true;
  }
  if (entryLines.length > 0) {
    const entry = parseSingleExperience(entryLines);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseSingleExperience(entryLines: string[]): WorkEntry | null {
  if (entryLines.length === 0) return null;
  const dateLine = entryLines.find((l) => hasDateRange(l));
  const dates = dateLine ? parseDateRange(dateLine) : null;

  // If the date line carries title text alongside the date (e.g., "Software
  // Engineer — Acme  Jul 2022 - Aug 2023"), treat the non-date prefix as the
  // title and the other non-date, non-bullet line as the company.
  const dateLineTitle = dateLine ? stripDateFromLine(dateLine) : '';
  const nonDateHeaderLines = entryLines.filter((l) => l !== dateLine && !BULLET_LEAD_RE.test(l));

  let title = '';
  let company = '';
  if (dateLineTitle && /[\p{L}]/u.test(dateLineTitle)) {
    title = dateLineTitle;
    if (nonDateHeaderLines.length >= 1) company = nonDateHeaderLines[0]!.trim();
  } else if (nonDateHeaderLines.length >= 1) {
    const first = nonDateHeaderLines[0]!;
    const splitMatch = first.match(/^(.+?)\s*(?:at|@|—|–|-|\|)\s*(.+)$/i);
    if (splitMatch) {
      [title, company] = [splitMatch[1]!.trim(), splitMatch[2]!.trim()];
    } else {
      title = first.trim();
      if (nonDateHeaderLines.length >= 2) company = nonDateHeaderLines[1]!.trim();
    }
  }

  // Inner em-dash separator splits subteam-style titles ("Engineer — Connect")
  // into a title/company pair only when company hasn't been resolved yet.
  if (title && !company) {
    const innerSplit = title.match(/^(.+?)\s*(?:[—–|]|\sat\s|\s@\s)\s*(.+)$/i);
    if (innerSplit) {
      title = innerSplit[1]!.trim();
      company = innerSplit[2]!.trim();
    }
  }

  const usedHeaders = new Set<string>();
  if (dateLine) usedHeaders.add(dateLine);
  for (const l of nonDateHeaderLines.slice(0, dateLineTitle ? 1 : 2)) usedHeaders.add(l);

  const description = entryLines
    .filter((l) => !usedHeaders.has(l))
    .join(' ')
    .replace(BULLET_LEAD_RE, '')
    .trim()
    .slice(0, 2000);

  if (!title && !company) return null;
  return {
    title,
    company,
    location: '',
    startMonth: dates?.startMonth,
    startYear: dates?.startYear,
    endMonth: dates?.endMonth,
    endYear: dates?.endYear,
    current: dates?.current ?? false,
    description,
  };
}

function hasDateRange(line: string): boolean {
  if (/\b(?:19|20)\d{2}\b/.test(line)) return true;
  if (/\bpresent\b/i.test(line)) return true;
  return false;
}

/**
 * Return the non-date prefix of a line. Picks the leftmost date marker
 * (month-name or 4-digit year) and trims everything from that point — the
 * common shape "Title — Company  Mon YYYY - Mon YYYY" yields "Title — Company".
 */
function stripDateFromLine(line: string): string {
  // Full month names first so "June" matches as a whole word, not as "Jun" + "e".
  const monthRe =
    /\b(?:january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)\.?\b/i;
  const monthMatch = line.match(monthRe);
  const yearMatch = line.match(/\b(?:19|20)\d{2}\b/);
  const presentMatch = line.match(/\b(?:present|current(?:ly)?)\b/i);
  const candidates = [monthMatch?.index, yearMatch?.index, presentMatch?.index].filter(
    (i): i is number => typeof i === 'number',
  );
  if (candidates.length === 0) return '';
  const cut = Math.min(...candidates);
  return line
    .slice(0, cut)
    .replace(/[\s,–—\-|]+$/, '')
    .trim();
}

interface MonthYear {
  month?: number;
  year: number;
}

/**
 * Pull all (month?, year) pairs from a line, preserving order. Recognizes
 * "Jul 2022", "07/2022", "7-2022", "2022-07", and bare "2022".
 */
function extractMonthYears(line: string): MonthYear[] {
  type Match = { idx: number; my: MonthYear };
  const matches: Match[] = [];

  const monthName = `(${MONTHS.join('|')})`;
  const monthYearRe = new RegExp(`${monthName}\\.?\\s*((?:19|20)\\d{2})`, 'gi');
  for (const m of line.matchAll(monthYearRe)) {
    matches.push({
      idx: m.index ?? 0,
      my: { month: MONTH_INDEX[m[1]!.toLowerCase()], year: Number(m[2]) },
    });
  }

  const numericMmYyyyRe =
    /\b(\d{1,2})[/\-.](\d{1,2})[/\-.]((?:19|20)\d{2})\b|\b(\d{1,2})[/\-.]((?:19|20)\d{2})\b/g;
  for (const m of line.matchAll(numericMmYyyyRe)) {
    const mm = Number(m[1] ?? m[4]);
    const yyyy = Number(m[3] ?? m[5]);
    if (mm >= 1 && mm <= 12) {
      matches.push({ idx: m.index ?? 0, my: { month: mm, year: yyyy } });
    }
  }

  const yyyyMmRe = /\b((?:19|20)\d{2})[-/](\d{1,2})\b/g;
  for (const m of line.matchAll(yyyyMmRe)) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    if (mm >= 1 && mm <= 12) {
      matches.push({ idx: m.index ?? 0, my: { month: mm, year: yyyy } });
    }
  }

  // Bare years not already captured by a fuller pattern. Threshold 5 covers
  // the offset of the year inside "07/2022" (idx 3) and "Jul 2022" (idx 4)
  // without swallowing two bare years separated by " - ".
  const bareYearRe = /\b((?:19|20)\d{2})\b/g;
  for (const m of line.matchAll(bareYearRe)) {
    const idx = m.index ?? 0;
    const overlaps = matches.some((mm) => Math.abs(mm.idx - idx) <= 5);
    if (!overlaps) matches.push({ idx, my: { year: Number(m[1]) } });
  }

  matches.sort((a, b) => a.idx - b.idx);
  return matches.map((m) => m.my);
}

function parseDateRange(line: string): {
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
  current: boolean;
} {
  const out: ReturnType<typeof parseDateRange> = { current: false };
  const presentRe = /\b(present|current(?:ly)?|now)\b/i;
  const dates = extractMonthYears(line);

  if (dates.length >= 1) {
    out.startMonth = dates[0]!.month;
    out.startYear = dates[0]!.year;
  }
  if (dates.length >= 2) {
    out.endMonth = dates[1]!.month;
    out.endYear = dates[1]!.year;
  }

  if (presentRe.test(line)) {
    out.current = true;
    out.endMonth = undefined;
    out.endYear = undefined;
  }

  return out;
}

function parseEducationSection(lines: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  let entryLines: string[] = [];
  for (const line of lines) {
    const isNewEntry =
      entryLines.length > 0 &&
      /\b(?:university|college|institute|school)\b/i.test(line) &&
      !hasDateRange(line);
    if (isNewEntry) {
      const e = parseSingleEducation(entryLines);
      if (e) entries.push(e);
      entryLines = [];
    }
    entryLines.push(line);
  }
  if (entryLines.length > 0) {
    const e = parseSingleEducation(entryLines);
    if (e) entries.push(e);
  }
  return entries;
}

function parseSingleEducation(lines: string[]): EducationEntry | null {
  if (lines.length === 0) return null;
  const schoolLine = lines.find((l) => /\b(?:university|college|institute|school)\b/i.test(l));
  const degreeLine = lines.find((l) =>
    /\b(?:b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba|ph\.?d\.?|bachelor|master|doctorate)\b/i.test(l),
  );
  const dateLine = lines.find((l) => hasDateRange(l));
  const dates = dateLine ? parseDateRange(dateLine) : null;
  const gpaMatch = lines.join(' ').match(/\bGPA[:\s]+(\d\.\d{1,2}(?:\s*\/\s*\d\.\d{1,2})?)/i);

  if (!schoolLine && !degreeLine) return null;

  let degree = '';
  let fieldOfStudy = '';
  if (degreeLine) {
    const degreeMatch = degreeLine.match(
      /(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba|ph\.?d\.?|bachelor(?:'?s)?|master(?:'?s)?|doctorate)\b\s*(?:in|of)?\s*(.+)?/i,
    );
    if (degreeMatch) {
      degree = degreeMatch[1]!;
      fieldOfStudy = (degreeMatch[2] ?? '').replace(/^,\s*/, '').trim().slice(0, 100);
    }
  }

  return {
    school: (schoolLine ?? '').trim().slice(0, 200),
    degree: degree.slice(0, 100),
    fieldOfStudy,
    minor: '',
    startMonth: dates?.startMonth,
    startYear: dates?.startYear,
    gradMonth: dates?.endMonth,
    gradYear: dates?.endYear,
    gpa: gpaMatch ? gpaMatch[1]!.trim() : '',
  };
}

function parseListSection(lines: string[]): string[] {
  const all = lines
    .join(' ')
    .split(/[•·,;|\n‣◦▪▫▸]/)
    .map((s) => s.trim().replace(BULLET_LEAD_RE, ''))
    .filter((s) => s.length > 0 && s.length <= 60);
  return Array.from(new Set(all));
}

function parseLanguagesSection(lines: string[]): { language: string; proficiency: string }[] {
  const out: { language: string; proficiency: string }[] = [];
  const items = parseListSection(lines);
  for (const item of items) {
    const m = item.match(/^([\p{L}\s]+?)\s*(?:[-–—:(]|\bat\b)\s*([\p{L}\s]+)\)?$/u);
    if (m) {
      out.push({ language: m[1]!.trim(), proficiency: m[2]!.trim() });
    } else {
      out.push({ language: item, proficiency: '' });
    }
  }
  return out;
}
