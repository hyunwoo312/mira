import type { SearchQuery } from '../types';
import aliasData from '@/data/aliases.json';

function getAliasFallback(value: string, aliasKey: string): string | undefined {
  const entries = (aliasData as Record<string, Record<string, string[]>>)[aliasKey];
  if (!entries) return undefined;
  const lower = value.toLowerCase();
  for (const [canonical, alts] of Object.entries(entries)) {
    if (canonical.toLowerCase() === lower) return undefined; // exact match, no fallback needed
    for (const alt of alts) {
      if (alt.toLowerCase() === lower) return canonical;
    }
  }
  return undefined;
}

function parseLocation(value: string): { city: string; state: string; country: string } {
  const parts = value.split(',').map((p) => p.trim());
  return {
    city: parts[0] ?? '',
    state: parts[1] ?? '',
    country: parts[2] ?? '',
  };
}

function contextHints(text: string, patterns: RegExp[]): boolean {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
}

function buildContext(ctx: { label?: string; description?: string; placeholder?: string }): string {
  return [ctx.label, ctx.description, ctx.placeholder].filter(Boolean).join(' ');
}

export function inferSearchTerms(
  category: string,
  profileValue: string,
  context: { label?: string; description?: string; placeholder?: string } = {},
): SearchQuery {
  const ctx = buildContext(context);

  switch (category) {
    case 'location': {
      const loc = parseLocation(profileValue);

      // Check if field specifically wants state/province
      if (contextHints(ctx, [/state|province|region/i])) {
        return {
          primary: loc.state.slice(0, 30) || loc.city.slice(0, 30),
          fallback: loc.city.slice(0, 30) || undefined,
        };
      }
      // Check if field specifically wants country
      if (contextHints(ctx, [/country/i])) {
        return {
          primary: loc.country.slice(0, 20) || loc.state.slice(0, 20),
        };
      }
      // Check if field specifically wants zip/postal
      if (contextHints(ctx, [/zip|postal/i])) {
        return { primary: profileValue.slice(0, 10) };
      }
      // Default: city first, state as fallback
      return {
        primary: loc.city.slice(0, 30) || profileValue.slice(0, 30),
        fallback: loc.state.slice(0, 30) || undefined,
      };
    }

    case 'country':
      return { primary: profileValue.slice(0, 20) };

    case 'state':
      return {
        primary: profileValue.slice(0, 30),
        // Fallback: try abbreviation if full name is long
        fallback: profileValue.length > 4 ? profileValue.slice(0, 2).toUpperCase() : undefined,
      };

    case 'degree':
      // Extract degree level only — "Bachelor's Degree in CS" → "Bachelor"
      return {
        primary: extractDegreeLevel(profileValue),
        fallback: profileValue.slice(0, 20),
      };

    case 'school':
      return { primary: profileValue.slice(0, 30) };

    case 'fieldOfStudy':
      return {
        primary: profileValue.slice(0, 25),
        fallback: getAliasFallback(profileValue, 'fieldOfStudy')?.slice(0, 25),
      };

    case 'company':
      return { primary: profileValue.slice(0, 25) };

    case 'jobTitle':
      return { primary: profileValue.slice(0, 25) };

    default:
      // Generic: first meaningful segment (before parentheses/commas)
      return {
        primary: profileValue.split(/[,(]/)[0]!.trim().slice(0, 20),
        fallback: profileValue.slice(0, 20),
      };
  }
}

function extractDegreeLevel(degree: string): string {
  const lower = degree.toLowerCase();

  if (/\bph\.?d|doctor/i.test(lower)) return 'PhD';
  if (/\bm\.?b\.?a\b/i.test(lower)) return 'MBA';
  if (/\bj\.?d\b/i.test(lower)) return 'Juris Doctor';
  if (/\bm\.?d\b/i.test(lower)) return 'Doctor of Medicine';
  if (/\bm\.?s\.?\b|master.*science/i.test(lower)) return "Master's";
  if (/\bm\.?a\.?\b|master.*art/i.test(lower)) return "Master's";
  if (/master/i.test(lower)) return "Master's";
  if (/\bb\.?s\.?\b|bachelor.*science/i.test(lower)) return "Bachelor's";
  if (/\bb\.?a\.?\b|bachelor.*art/i.test(lower)) return "Bachelor's";
  if (/bachelor/i.test(lower)) return "Bachelor's";
  if (/\ba\.?s\.?\b|associate.*science/i.test(lower)) return "Associate's";
  if (/\ba\.?a\.?\b|associate.*art/i.test(lower)) return "Associate's";
  if (/associate/i.test(lower)) return "Associate's";
  if (/high\s*school|ged|diploma/i.test(lower)) return 'High School';

  // Fallback: first word/segment
  return degree
    .split(/[\s,(-]/)[0]!
    .trim()
    .slice(0, 15);
}
