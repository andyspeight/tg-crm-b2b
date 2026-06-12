import "server-only";
import { listCompanies } from "@/lib/crm/data";
import type { CompanyInput } from "@/lib/crm/types";
import { SIZE_BANDS } from "@/lib/crm/config";
import { getBoardItems } from "./boards";
import type { MondayItem } from "./types";

/**
 * Maps Monday board rows into Luna Desk records. Kept deliberately tolerant:
 * a row with just a name is still a valid company, and unknown values are left
 * unset (to be enriched later) rather than guessed.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseUrl(s: string): string | undefined {
  const t = (s || "").trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t)) return `https://${t}`;
  return undefined;
}

function mapSizeBand(raw: string): CompanyInput["sizeBand"] {
  const s = (raw || "").replace(/,/g, "");
  if (!s.trim()) return undefined;
  for (const band of SIZE_BANDS) if (s.includes(band)) return band;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return undefined;
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  if (n <= 1000) return "501-1000";
  return "1000+";
}

const UK_HINTS =
  /\b(uk|united kingdom|england|scotland|wales|northern ireland|london|manchester|birmingham|glasgow|edinburgh|bristol|leeds|cardiff|belfast)\b/i;

function regionFromLocation(loc: string): CompanyInput["region"] {
  const t = (loc || "").trim();
  if (!t) return undefined;
  return UK_HINTS.test(t) ? "UK" : "Non-UK";
}

/** Build a Luna Company from a Monday "Companies" board row (all are customers). */
export function companyFromItem(item: MondayItem): CompanyInput {
  const v = (title: string) => item.values[title.toLowerCase()] ?? "";
  const profile = v("company profile");
  const linkedin = /linkedin\.com/i.test(profile) ? profile.trim() : undefined;
  const hq = v("headquarters location").trim();
  return {
    name: item.name.trim(),
    lifecycleStage: "Customer",
    accountHealth: "Green",
    careCadence: "Quarterly",
    website: parseUrl(v("domain")) ?? parseUrl(v("website")),
    description: v("description").trim() || undefined,
    sizeBand: mapSizeBand(v("no. of employees")),
    country: hq || undefined,
    region: regionFromLocation(hq),
    linkedin,
    enrichmentSource: "Monday import",
  };
}

export interface CompaniesPlan {
  total: number;
  duplicates: number;
  skipped: number;
  toCreate: CompanyInput[];
}

/** Read the board, map rows to companies, and dedupe against what's already in Luna Desk. */
export async function planCompanies(boardId: string): Promise<CompaniesPlan> {
  const [{ items }, existing] = await Promise.all([getBoardItems(boardId), listCompanies()]);
  const seen = new Set(existing.map((c) => norm(c.name)));
  const toCreate: CompanyInput[] = [];
  let duplicates = 0;
  let skipped = 0;
  for (const it of items) {
    const name = (it.name || "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    const key = norm(name);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    toCreate.push(companyFromItem(it));
  }
  return { total: items.length, duplicates, skipped, toCreate };
}
