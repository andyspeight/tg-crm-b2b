import "server-only";
import { listCompanies, listContacts, listDeals } from "@/lib/crm/data";
import type { CompanyInput, ContactInput, DealInput } from "@/lib/crm/types";
import { ACCOUNT_HEALTH, DEAL_STAGES, SIZE_BANDS } from "@/lib/crm/config";
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

// --- Deals -----------------------------------------------------------------

function parseNumber(raw: string): number | undefined {
  const s = (raw || "").replace(/[^0-9.]/g, "");
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

const STAGE_ALIASES: Record<string, (typeof DEAL_STAGES)[number]> = {
  lead: "New Lead",
  new: "New Lead",
  qualified: "Contacted",
  demo: "Demo Booked",
  "proposal sent": "Proposal",
  "closed won": "Won",
  "closed lost": "Lost",
};

function mapDealStage(raw: string): (typeof DEAL_STAGES)[number] {
  const s = norm(raw);
  for (const st of DEAL_STAGES) if (norm(st) === s) return st;
  return STAGE_ALIASES[s] ?? "New Lead";
}

/** Build a Luna Deal, linking to a company via the deal's linked contact name. */
export function dealFromItem(
  item: MondayItem,
  companyIdByContactName: Map<string, string>,
): DealInput {
  const v = (title: string) => item.values[title.toLowerCase()] ?? "";
  const contactName = (v("contacts").split(",")[0] || "").trim();
  const companyId = contactName ? companyIdByContactName.get(norm(contactName)) : undefined;
  return {
    name: item.name.trim(),
    stage: mapDealStage(v("stage")),
    mrr: parseNumber(v("deal value")),
    expectedCloseDate: v("expected close date").trim() || undefined,
    owner: v("owner").trim() || undefined,
    companyId,
  };
}

export interface DealsPlan {
  total: number;
  duplicates: number;
  skipped: number;
  toCreate: DealInput[];
}

export async function planDeals(boardId: string): Promise<DealsPlan> {
  const [{ items }, existingDeals, contacts] = await Promise.all([
    getBoardItems(boardId),
    listDeals({ limit: 2000 }),
    listContacts({ limit: 5000 }),
  ]);
  const companyIdByContactName = new Map<string, string>();
  for (const c of contacts) if (c.companyId) companyIdByContactName.set(norm(c.name), c.companyId);

  const seen = new Set(existingDeals.map((d) => norm(d.name)));
  const toCreate: DealInput[] = [];
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
    toCreate.push(dealFromItem(it, companyIdByContactName));
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

// --- Leads (import as prospect companies + their contacts) ------------------

export interface LeadsPlan {
  total: number;
  duplicates: number;
  skipped: number;
  newCompanies: CompanyInput[];
  contacts: { input: ContactInput; companyName: string }[];
}

export async function planLeads(boardId: string): Promise<LeadsPlan> {
  const [{ items }, companies, existingContacts] = await Promise.all([
    getBoardItems(boardId),
    listCompanies(),
    listContacts({ limit: 5000 }),
  ]);
  const existingCompanyNames = new Set(companies.map((c) => norm(c.name)));
  const seenEmail = new Set(
    existingContacts.map((c) => (c.email || "").toLowerCase()).filter(Boolean),
  );

  const newCompanyNames = new Set<string>();
  const newCompanies: CompanyInput[] = [];
  const contacts: { input: ContactInput; companyName: string }[] = [];
  let duplicates = 0;
  let skipped = 0;
  const batchEmail = new Set<string>();

  for (const it of items) {
    const personName = (it.name || "").trim();
    if (!personName) {
      skipped++;
      continue;
    }
    const v = (title: string) => it.values[title.toLowerCase()] ?? "";
    const companyName = v("company name").trim();
    if (companyName) {
      const key = norm(companyName);
      if (!existingCompanyNames.has(key) && !newCompanyNames.has(key)) {
        newCompanyNames.add(key);
        newCompanies.push({
          name: companyName,
          lifecycleStage: "Prospect",
          enrichmentSource: "Monday import (Leads)",
        });
      }
    }

    const email = v("email").trim().toLowerCase() || undefined;
    if (email && (seenEmail.has(email) || batchEmail.has(email))) {
      duplicates++;
      continue;
    }
    if (email) batchEmail.add(email);
    contacts.push({
      input: {
        name: personName,
        email,
        phone: v("phone").trim() || undefined,
        notes: v("comments").trim() || undefined,
        source: "Monday import (Leads)",
      },
      companyName,
    });
  }
  return { total: items.length, duplicates, skipped, newCompanies, contacts };
}

// --- Clients Progress (health overlay onto existing customers) --------------

type Health = (typeof ACCOUNT_HEALTH)[number];

/**
 * Normalise a company name for matching: lowercase, strip punctuation and
 * trailing legal suffixes, collapse whitespace. Applied to both sides so
 * "Acme Travel Ltd." and "Acme Travel" line up.
 */
function normCompany(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[.,'’"()]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|llp|plc|inc|incorporated)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clients Progress rows are titled "Person - Company"; take the company part. */
function companyFromProgressTitle(title: string): string {
  const t = (title || "").trim();
  const i = t.indexOf(" - ");
  return i >= 0 ? t.slice(i + 3).trim() : t;
}

/**
 * The board's Status is an onboarding stage, not a health rating: "Site Is
 * Live" is the steady state (Green); anything still in onboarding is in-flight
 * and worth watching (Amber). Nothing on this board signals churn.
 */
function progressHealth(raw: string): Health | undefined {
  const s = norm(raw);
  if (!s) return undefined;
  return s === "site is live" ? "Green" : "Amber";
}

export interface ClientsProgressPlan {
  total: number;
  unmatched: number;
  noStatus: number;
  updates: { id: string; name: string; health: Health }[];
}

export async function planClientsProgress(boardId: string): Promise<ClientsProgressPlan> {
  const [{ items }, companies] = await Promise.all([getBoardItems(boardId), listCompanies()]);
  const byName = new Map(companies.map((c) => [normCompany(c.name), c]));
  const updates: { id: string; name: string; health: Health }[] = [];
  const seen = new Set<string>();
  let unmatched = 0;
  let noStatus = 0;

  for (const it of items) {
    const title = (it.name || "").trim();
    if (!title) continue;
    const company = byName.get(normCompany(companyFromProgressTitle(title)));
    if (!company) {
      unmatched++;
      continue;
    }
    if (seen.has(company.id)) continue;
    const v = (col: string) => it.values[col.toLowerCase()] ?? "";
    const health = progressHealth(v("status"));
    if (!health) {
      noStatus++;
      continue;
    }
    seen.add(company.id);
    updates.push({ id: company.id, name: company.name, health });
  }
  return { total: items.length, unmatched, noStatus, updates };
}
