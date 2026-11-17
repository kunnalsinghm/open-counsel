/**
 * Pulls the things a student actually asked about (institute, branch, category,
 * quota, year, round) out of a free-text question, so the AI is grounded on the
 * right cutoff rows instead of an arbitrary sample. Pure functions: no DB access.
 */

export interface CutoffQuery {
  instituteNames: string[];
  /** Matched against branches.short_code (exact) or branches.name (contains). */
  branchTerms: string[];
  category?: string;
  quota?: string;
  year?: number;
  round?: number;
}

const BRANCH_KEYWORDS: { terms: string[]; patterns: RegExp[] }[] = [
  { terms: ["CSE", "Computer Science"], patterns: [/\bcse\b/i, /computer science/i, /\bcs\b/i] },
  { terms: ["ECE", "Electronics and Communication"], patterns: [/\bece\b/i, /electronics/i] },
  { terms: ["EE", "Electrical"], patterns: [/\bee\b/i, /\beee\b/i, /electrical/i] },
  { terms: ["ME", "Mechanical"], patterns: [/\bme\b/i, /mechanical/i] },
  { terms: ["CE", "Civil"], patterns: [/\bce\b/i, /civil/i] },
  { terms: ["IT", "Information Technology"], patterns: [/\bit\b(?! is| was| has)/i, /information technology/i] },
  { terms: ["Chemical"], patterns: [/chemical/i] },
  { terms: ["Metallurgical"], patterns: [/metallurg/i] },
  { terms: ["Mathematics"], patterns: [/mathematics and computing/i, /\bmnc\b/i] },
  { terms: ["Artificial Intelligence"], patterns: [/artificial intelligence/i, /\bai ?(&|and) ?ds\b/i, /data science/i] },
];

const TYPE_WORDS = "iiit|iit|nit|gfti|vnit|mnnit|mnit|svnit|manit";
const TYPE_PREFIX = new RegExp(`^(${TYPE_WORDS})\\s+`);

// Real JoSAA files use official long names ("Indian Institute of Technology Bombay") while
// students write "IIT Bombay". Both the stored names and the question are shortened with
// these rules before comparing. Longest phrases first.
const LONG_FORMS: [RegExp, string][] = [
  [/visvesvaraya national institute of technology/g, "vnit"],
  [/motilal nehru national institute of technology/g, "mnnit"],
  [/malaviya national institute of technology/g, "mnit"],
  [/sardar vallabhbhai national institute of technology/g, "svnit"],
  [/maulana azad national institute of technology/g, "manit"],
  [/indian institute of information technology/g, "iiit"],
  [/indian institute of technology/g, "iit"],
  [/national institute of technology/g, "nit"],
];

// Common nicknames for a place name.
const PLACE_ALIASES: Record<string, string[]> = {
  tiruchirappalli: ["trichy", "tiruchi"],
  surathkal: ["nitk"],
  allahabad: ["prayagraj"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(normalized: string): string {
  let out = normalized;
  for (const [re, short] of LONG_FORMS) out = out.replace(re, short);
  return out;
}

/**
 * Finds institutes from `knownNames` that the message refers to.
 *
 * Matches (best first): the full stored name, its short form ("iit bombay"), or just the
 * place name ("bombay", "trichy"). If at least one institute matched by name + type, place-only
 * matches are dropped, so "IIIT Allahabad" does not also return MNNIT Allahabad.
 * Returns at most `max` names.
 */
export function matchInstitutes(message: string, knownNames: string[], max = 3): string[] {
  const m = ` ${shorten(norm(message))} `;
  const scored: { name: string; score: number }[] = [];

  for (const name of knownNames) {
    const full = norm(name);
    if (!full) continue;
    const canon = shorten(full);

    if (m.includes(` ${full} `) || m.includes(` ${canon} `)) {
      scored.push({ name, score: 100 + canon.length });
      continue;
    }

    const type = canon.match(TYPE_PREFIX)?.[1] ?? "";
    const parenthetical = name.match(/\(([^)]*)\)/)?.[1];
    const bare = shorten(norm(name.replace(/\(.*?\)/g, "")));
    const rest = bare.replace(TYPE_PREFIX, "").trim();

    const aliases = new Set<string>();
    if (rest.length >= 4) aliases.add(rest);
    const words = rest.split(" ");
    if (words.length > 1 && words[words.length - 1].length >= 5) aliases.add(words[words.length - 1]);
    if (parenthetical && norm(parenthetical).length >= 4) aliases.add(norm(parenthetical));
    // Named-NIT abbreviations (VNIT, MNNIT, ...) identify one institute on their own.
    if (/^(vnit|mnnit|mnit|svnit|manit)$/.test(type)) aliases.add(type);
    for (const w of [rest, words[words.length - 1]]) {
      for (const extra of PLACE_ALIASES[w] ?? []) aliases.add(extra);
    }

    for (const alias of aliases) {
      if (m.includes(` ${alias} `)) {
        const typeBonus = type && m.includes(` ${type} `) ? 20 : 0;
        scored.push({ name, score: 50 + typeBonus + alias.length });
        break;
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const strong = scored.filter((s) => s.score >= 100);
  const pool = strong.length > 0 ? strong : scored;
  return pool.slice(0, max).map((s) => s.name);
}

export function extractBranchTerms(message: string): string[] {
  const terms: string[] = [];
  for (const b of BRANCH_KEYWORDS) {
    if (b.patterns.some((p) => p.test(message))) terms.push(...b.terms);
  }
  return Array.from(new Set(terms));
}

export function extractCategory(message: string): string | undefined {
  if (/\bews\b/i.test(message)) return "EWS";
  if (/\bobc(?:[- ]?ncl)?\b/i.test(message)) return "OBC-NCL";
  if (/\bpwd\b|\bpwbd\b|\bdisabled\b/i.test(message)) return "PwD";
  if (/\bsc\b/i.test(message)) return "SC";
  if (/\bst\b/i.test(message)) return "ST";
  if (/\bopen\b|\bgeneral\b|\bgen\b/i.test(message)) return "OPEN";
  return undefined;
}

export function extractQuota(message: string): string | undefined {
  if (/home ?state|\bhs quota\b/i.test(message)) return "HS";
  if (/other ?state|\bos quota\b/i.test(message)) return "OS";
  if (/all ?india|\bai quota\b/i.test(message)) return "AI";
  return undefined;
}

export function extractYear(message: string): number | undefined {
  const m = message.match(/\b(20[12]\d)\b/);
  return m ? Number(m[1]) : undefined;
}

export function extractRound(message: string): number | undefined {
  const m = message.match(/\bround\s*(\d{1,2})\b/i) ?? message.match(/\br(\d)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : undefined;
}

export function extractCutoffQuery(message: string, knownInstituteNames: string[]): CutoffQuery {
  return {
    instituteNames: matchInstitutes(message, knownInstituteNames),
    branchTerms: extractBranchTerms(message),
    category: extractCategory(message),
    quota: extractQuota(message),
    year: extractYear(message),
    round: extractRound(message),
  };
}

/** True when the question names nothing specific enough to look up. */
export function isQueryTooVague(q: CutoffQuery): boolean {
  return q.instituteNames.length === 0 && q.branchTerms.length === 0;
}
