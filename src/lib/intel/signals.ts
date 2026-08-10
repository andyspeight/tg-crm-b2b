import type { SignalType } from "@/lib/crm/types";
import type { SerpResult } from "./brightdata";
import { hostBrand } from "@/lib/domain";

/**
 * Turn Google (SERP) results into scored buying/intent signals for a company.
 * Pure and dependency-free. No AI call here — cheap and deterministic.
 *
 * The bar is precision, not recall: a noisy feed is worse than a quiet one, so a
 * result only becomes a signal when it clears four gates —
 *   1. it names the company (full name, not a stray keyword);
 *   2. it's about *this* company, not a same-named business in another industry —
 *      a generically-named client ("Horizon", "Premier") only counts when the
 *      article also reads as travel (so a private fund buying a fence installer
 *      called Horizon never lands on a travel agent's timeline);
 *   3. it describes a real event (funding, M&A, a senior hire, a genuine award,
 *      a partnership, an expansion, a replatform) — marketing adjectives like
 *      "award-winning" don't count;
 *   4. it isn't the company's own website (a client adding a page to their own
 *      site isn't market intel), and it's recent (default ≤90 days).
 */

export interface SignalCandidate {
  headline: string;
  url: string;
  type: SignalType;
  relevanceScore: number;
  /** The article's real publish date (ISO), when Google reported one. */
  date?: string;
}

interface Rule {
  re: RegExp;
  type: SignalType;
  weight: number;
  /** A genuine event (vs. background marketing colour). At least one must fire. */
  strong: boolean;
}

// Ordered by importance — the first *strong* matching rule sets the signal's type.
// `strong: false` rules can lift the score but can never create a signal alone.
const RULES: Rule[] = [
  { re: /\b(raises?|raised|secures?|funding round|investment round|series [a-e]\b|seed round|backed by|venture (capital|round))\b/i, type: "Funding", weight: 3, strong: true },
  { re: /\b(acquires?|acquisition of|acquired by|acquired|merges? with|merger with|buyout|takeover of|bought by)\b/i, type: "News", weight: 3, strong: true },
  { re: /\b(appoints?|appointment of|names? (a )?new|promotes?|hires? (a )?new|new (ceo|cfo|coo|cto|md|managing director|head of|director of)|joins as|steps down as)\b/i, type: "Job Change", weight: 3, strong: true },
  { re: /\b(wins? (the|a|an|its)|awarded (the|a|an)|shortlisted for|scoops? (the|a|an)|named best|crowned|highly commended|has been accredited)\b/i, type: "Award", weight: 2, strong: true },
  { re: /\b(partners? with|announces? (a )?partnership|teams? up with|signs? (a )?deal with|integrat(es?|ion) with)\b/i, type: "News", weight: 2, strong: true },
  { re: /\b(expands? into|expansion into|opens? (a|its|new)|new office in|enters the .{2,30} market|launches? (a )?new)\b/i, type: "News", weight: 2, strong: true },
  { re: /\b(rebrand|relaunch(es|ed)?|new booking (system|engine|platform)|replatform|migrates? to a new)\b/i, type: "Website Change", weight: 2, strong: true },
  { re: /\b(record (year|results|profits?)|profit up|revenue up|turnover up|reaches? a milestone)\b/i, type: "News", weight: 1, strong: false },
];

// Results from these hosts are noise for intent monitoring: social, encyclopaedias,
// job boards, data-broker/company-directory aggregators, and essay/homework mills.
// They match a company name without ever describing a real event.
const SKIP_HOST = /(facebook\.|instagram\.|twitter\.|x\.com|youtube\.|tiktok\.|pinterest\.|reddit\.|wikipedia\.|glassdoor\.|indeed\.|google\.|accounts\.|login\.|rocketreach\.|tracxn\.|zoominfo\.|apollo\.io|leadiq\.|myjobmag\.|totaljobs\.|reed\.co|freelancer\.|upwork\.|coursesidekick\.|coursehero\.|studocu\.|twstalker\.|picuki\.|companieshouse\.|opencorporates\.|dnb\.com|bizapedia\.)/i;

// Signals older than this are dropped even if the query's recency filter let them
// through — Google's recency hint is a hint, not a guarantee. Env-tunable; the
// default is deliberately tight (a stale "signal" is just make-work).
function maxAgeMs(): number {
  const days = Number(process.env.INTEL_SIGNAL_MAX_AGE_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 90) * 864e5;
}

/** Reduce a string to lowercased alphanumeric words separated by single spaces. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Generic tokens that don't make a company name distinctive on their own. A name
// built only from these (e.g. "Premier Holidays Group Ltd") isn't identifying.
const GENERIC_NAME_TOKENS = new Set([
  "the", "and", "co", "company", "group", "ltd", "limited", "llp", "plc", "inc",
  "holdings", "services", "solutions", "uk", "gb", "worldwide", "global",
  "international", "travel", "holiday", "holidays", "tours", "tour", "tourism",
  "cruise", "cruises", "agency", "agents", "trips", "leisure", "getaways",
]);

/** Words that mark an article as travel-industry — used to disambiguate namesakes. */
const TRAVEL_CONTEXT =
  /\b(travel|tourism|tourist|holiday|holidays|vacation|getaway|agent|agency|tour operator|operator|cruise|cruises|airline|airlines|flight|flights|hotel|hotels|resort|resorts|booking|bookings|itinerary|destination|destinations|package holiday|staycation|abta|atol|iata|the travel network|advantage travel|ota|hospitality)\b/i;

/**
 * Is this result actually about the company? Requires the full company name to
 * appear (punctuation-insensitive) — a single distinctive word matched too much
 * generic travel content (an "adults only hotels" listicle is not a signal about
 * a company that happens to be called that).
 */
function mentionsCompany(hayNorm: string, name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return hayNorm.includes(n);
}

/**
 * Does the name identify the company on its own, or could it collide with a
 * business in another sector? Distinctive = a multi-word name carrying a real
 * brand token (≥4 chars, not a generic word). Single-word names ("Horizon",
 * "Premier") are never treated as distinctive — too collision-prone — so they
 * must earn their place via travel context in the article.
 */
function isDistinctiveName(name: string): boolean {
  const tokens = norm(name).split(" ").filter(Boolean);
  if (tokens.length < 2) return false;
  return tokens.some((t) => t.length >= 4 && !GENERIC_NAME_TOKENS.has(t));
}

function hasTravelContext(hay: string): boolean {
  return TRAVEL_CONTEXT.test(hay);
}

/** Parse Google's date string — absolute ("12 Jan 2024") or relative ("3 months ago"). */
function parseWhen(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  const rel = s.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/i);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const ms: Record<string, number> = { hour: 3600e3, day: 864e5, week: 6048e5, month: 2_629_800e3, year: 31_557_600e3 };
    return Date.now() - n * (ms[rel[2].toLowerCase()] ?? 0);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function detectSignals(
  companyName: string,
  results: SerpResult[],
  opts?: { max?: number; domain?: string },
): SignalCandidate[] {
  const max = opts?.max ?? 3;
  const ownBrand = opts?.domain ? hostBrand(opts.domain) : "";
  const cutoff = Date.now() - maxAgeMs();
  const distinctive = isDistinctiveName(companyName);
  const out: SignalCandidate[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const url = (r.link || "").trim();
    if (!url || SKIP_HOST.test(url)) continue;

    // The company's own website isn't market intel — skip a new page on their
    // own site (and the "award-winning" marketing copy that used to mislabel it).
    if (ownBrand && hostBrand(url) === ownBrand) continue;

    const key = url.toLowerCase();
    if (seen.has(key)) continue;

    // Drop stale results — a signal is only useful while it's current.
    const when = parseWhen(r.date);
    if (when !== null && when < cutoff) continue;

    const title = (r.title || "").trim();
    const hay = `${title} ${r.description || ""}`;
    const hayNorm = norm(hay);
    if (!mentionsCompany(hayNorm, companyName)) continue;

    // Namesake guard: a generically-named client only counts when the article
    // itself reads as travel, so a private fund buying a same-named fence
    // installer (or any other-industry namesake) never becomes a signal.
    const travel = hasTravelContext(hay);
    if (!distinctive && !travel) continue;

    let strongRule: Rule | null = null;
    let score = 0;
    for (const rule of RULES) {
      if (rule.re.test(hay)) {
        if (rule.strong && !strongRule) strongRule = rule;
        score += rule.weight;
      }
    }
    // No genuine event named → not a signal, just background chatter.
    if (!strongRule) continue;

    seen.add(key);
    out.push({
      headline: title.slice(0, 250) || strongRule.type,
      url,
      type: strongRule.type,
      // Travel-context corroboration nudges the score, so on-topic signals rank first.
      relevanceScore: Math.min(5, score + (travel ? 1 : 0)),
      date: when !== null ? new Date(when).toISOString() : undefined,
    });
  }

  return out.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, max);
}

/** The SERP query used to surface recent intent signals for a company. */
export function signalQuery(name: string): string {
  return `"${name}" (raises OR funding OR investment OR acquired OR acquisition OR appoints OR "new CEO" OR "managing director" OR partnership OR "teams up" OR expansion OR "new office" OR shortlisted OR award OR relaunch OR rebrand OR "new booking system")`;
}
