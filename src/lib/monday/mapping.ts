import "server-only";
import { listCompanies, listContacts } from "@/lib/crm/data";
import type { CompanyInput, ContactInput } from "@/lib/crm/types";
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

// --- Contacts (from either "Contacts" or "Contacts Type", deduped by email) ---

/** Build a Luna Contact from a Monday contact row, linking to a company by name. */
export function contactFromItem(
  item: MondayItem,
  companyIdByName: Map<string, string>,
): ContactInput {
  const v = (title: string) => item.values[title.toLowerCase()] ?? "";
  const last = v("last name").trim();
  const name = [item.name.trim(), last].filter(Boolean).join(" ") || item.name.trim();
  const email = v("email").trim().toLowerCase() || undefined;
  const phone = v("phone number").trim() || undefined;
  const companyName = v("company").trim();
  const companyId = companyName ? companyIdByName.get(norm(companyName)) : undefined;
  const linkedin = [v("link"), v("link 1"), v("social")]
    .find((u) => /linkedin\.com/i.test(u))
    ?.trim();
  const notes = v("comments").trim() || undefined;
  return { name, email, phone, companyId, linkedin, notes, source: "Monday import" };
}

export interface ContactsPlan {
  total: number;
  duplicates: number;
  skipped: number;
  toCreate: ContactInput[];
}

export async function planContacts(boardId: string): Promise<ContactsPlan> {
  const [{ items }, existingContacts, companies] = await Promise.all([
    getBoardItems(boardId),
    listContacts({ limit: 5000 }),
    listCompanies(),
  ]);
  const companyIdByName = new Map(companies.map((c) => [norm(c.name), c.id]));
  const seenEmail = new Set(
    existingContacts.map((c) => (c.email || "").toLowerCase()).filter(Boolean),
  );
  const seenNameCo = new Set(existingContacts.map((c) => `${norm(c.name)}|${c.companyId || ""}`));

  const toCreate: ContactInput[] = [];
  let duplicates = 0;
  let skipped = 0;
  const batchEmail = new Set<string>();
  const batchNameCo = new Set<string>();

  for (const it of items) {
    const name = (it.name || "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    const contact = contactFromItem(it, companyIdByName);
    if (contact.email) {
      if (seenEmail.has(contact.email) || batchEmail.has(contact.email)) {
        duplicates++;
        continue;
      }
      batchEmail.add(contact.email);
    } else {
      // No email: dedupe on name + linked company so re-runs don't double up.
      const key = `${norm(name)}|${contact.companyId || ""}`;
      if (seenNameCo.has(key) || batchNameCo.has(key)) {
        duplicates++;
        continue;
      }
      batchNameCo.add(key);
    }
    toCreate.push(contact);
  }
  return { total: items.length, duplicates, skipped, toCreate };
}
