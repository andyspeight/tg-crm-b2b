import type { SignalType } from "@/lib/crm/types";
import type { SerpResult } from "./brightdata";

/**
 * Turn Google (SERP) results into scored buying/intent signals for a company.
 * Pure and dependency-free: keyword rules map a result to a signal type and a
 * relevance score, and require the company to actually be named so we don't log
 * unrelated news. No AI call here — cheap and deterministic.
 */

export interface SignalCandidate {
  headline: string;
  url: string;
  type: SignalType;
  relevanceScore: number;
}

interface Rule {
  re: RegExp;
  type: SignalType;
  weight: number;
}

// Ordered by importance — the first matching rule sets the signal's type.
const RULES: Rule[] = [
  { re: /\b(raises?|raised|funding|investment|invests?|series [a-e]\b|seed round|backed by|capital)\b/i, type: "Funding", weight: 3 },
  { re: /\b(acquires?|acquisition|acquired|merger|merges?|buyout|takeover)\b/i, type: "News", weight: 3 },
  { re: /\b(appoints?|appointment|names? new|promotes?|hires?|new (ceo|cfo|coo|cto|md|managing director|head of|director)|joins as|steps down)\b/i, type: "Job Change", weight: 2 },
  { re: /\b(award|awarded|wins?|winner|shortlisted|named best|recognised|recognized|accredit)\b/i, type: "Award", weight: 2 },
  { re: /\b(partners? with|partnership|teams up|integrat(es?|ion)|collaborat)\b/i, type: "News", weight: 2 },
  { re: /\b(expands?|expansion|new office|opens? (a|new)|launches?|rollout|enters the .* market|going live)\b/i, type: "News", weight: 2 },
  { re: /\b(rebrand|relaunch|new website|new platform|new booking (system|engine)|new tech)\b/i, type: "Website Change", weight: 1 },
  { re: /\b(record (year|results)|growth|profit|revenue up|milestone|turnover)\b/i, type: "News", weight: 1 },
];

// Results from these hosts are noise for intent monitoring.
const SKIP_HOST = /(facebook\.|instagram\.|twitter\.|x\.com|youtube\.|tiktok\.|pinterest\.|reddit\.|wikipedia\.|glassdoor\.|indeed\.|google\.|accounts\.|login\.)/i;

/** Loose "is this actually about the company" check. */
function mentionsCompany(hay: string, name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (hay.includes(n)) return true;
  // Fall back to the longest distinctive word (≥4 chars) of the name.
  const word = n
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !/^(the|and|group|travel|tours?|holidays?|limited|ltd)$/.test(w))
    .sort((a, b) => b.length - a.length)[0];
  if (!word) return false;
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay);
}

export function detectSignals(
  companyName: string,
  results: SerpResult[],
  opts?: { max?: number },
): SignalCandidate[] {
  const max = opts?.max ?? 3;
  const out: SignalCandidate[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const url = (r.link || "").trim();
    if (!url || SKIP_HOST.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;

    const title = (r.title || "").trim();
    const hay = `${title} ${r.description || ""}`.toLowerCase();
    if (!mentionsCompany(hay, companyName)) continue;

    let matched: Rule | null = null;
    let score = 0;
    for (const rule of RULES) {
      if (rule.re.test(hay)) {
        if (!matched) matched = rule;
        score += rule.weight;
      }
    }
    if (!matched) continue;

    seen.add(key);
    out.push({
      headline: title.slice(0, 250) || matched.type,
      url,
      type: matched.type,
      relevanceScore: Math.min(5, score),
    });
  }

  return out.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, max);
}

/** The SERP query used to surface recent intent signals for a company. */
export function signalQuery(name: string): string {
  return `"${name}" (funding OR investment OR acquisition OR partnership OR expansion OR "new office" OR appoints OR hires OR award OR launches OR rebrand OR milestone)`;
}
