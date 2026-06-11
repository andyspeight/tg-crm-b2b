import "server-only";

/**
 * The data-swap layer (brief §3). ALL CRM data access goes through this module so
 * the backend (Airtable today) can be swapped for Supabase later without touching
 * UI or API code. Writes are validated and whitelisted here — never trust the caller.
 */

import {
  AIRTABLE_BASE_ID,
  TABLES,
  FIELDS,
  COMPANY_TYPES,
  REGIONS,
  LIFECYCLE_STAGES,
  ACCOUNT_HEALTH,
  CARE_CADENCES,
  SIZE_BANDS,
  DEAL_STAGES,
  DEAL_SOURCES,
  MARKETING_OPT_IN,
} from "./config";
import type { Company, CompanyInput, Contact, ContactInput, Deal, DealInput } from "./types";
import {
  AirtableRecord,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} from "@/lib/airtable";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// --- field coercion helpers -------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
function numv(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function idList(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}
function firstId(v: unknown): string | undefined {
  return idList(v)[0];
}

// --- write validation helpers ----------------------------------------------

/** Trim to a non-empty string, or null to clear the field. */
function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function requiredText(v: unknown, name: string): string {
  const s = text(v);
  if (!s) throw new ValidationError(`${name} is required`);
  return s;
}
function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) throw new ValidationError("Expected a number");
  return n;
}
function enumOrNull<T extends readonly string[]>(
  v: unknown,
  allowed: T,
  name: string,
): T[number] | null {
  const s = text(v);
  if (s === null) return null;
  if (!allowed.includes(s as T[number])) {
    throw new ValidationError(`Invalid ${name}: "${s}"`);
  }
  return s as T[number];
}
function boolean(v: unknown): boolean {
  return v === true || v === "true";
}
/** Sanitise a user string for use inside an Airtable formula literal. */
function formulaSafe(q: string): string {
  return q.toLowerCase().replace(/["\\]/g, "").trim();
}

// --- record mappers ---------------------------------------------------------

function toCompany(rec: AirtableRecord): Company {
  const f = rec.fields;
  const F = FIELDS.companies;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    website: str(f[F.website]),
    type: str(f[F.type]) as Company["type"],
    country: str(f[F.country]),
    region: str(f[F.region]) as Company["region"],
    linkedin: str(f[F.linkedin]),
    socials: str(f[F.socials]),
    lifecycleStage: str(f[F.lifecycleStage]) as Company["lifecycleStage"],
    planTier: str(f[F.planTier]),
    mrr: numv(f[F.mrr]),
    goLiveDate: str(f[F.goLiveDate]),
    renewalDate: str(f[F.renewalDate]),
    accountHealth: str(f[F.accountHealth]) as Company["accountHealth"],
    careCadence: str(f[F.careCadence]) as Company["careCadence"],
    lastMeaningfulContact: str(f[F.lastMeaningfulContact]),
    productsUsed: str(f[F.productsUsed]),
    description: str(f[F.description]),
    sizeBand: str(f[F.sizeBand]) as Company["sizeBand"],
    enrichedAt: str(f[F.enrichedAt]),
    enrichmentSource: str(f[F.enrichmentSource]),
    watchlist: f[F.watchlist] === true,
    aiBrief: str(f[F.aiBrief]),
    nextBestAction: str(f[F.nextBestAction]),
    contactIds: idList(f[F.contacts]),
    dealIds: idList(f[F.deals]),
    createdTime: rec.createdTime,
  };
}

function toContact(rec: AirtableRecord): Contact {
  const f = rec.fields;
  const F = FIELDS.contacts;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    role: str(f[F.role]),
    email: str(f[F.email]),
    phone: str(f[F.phone]),
    linkedin: str(f[F.linkedin]),
    marketingOptIn: str(f[F.marketingOptIn]) as Contact["marketingOptIn"],
    notes: str(f[F.notes]),
    headline: str(f[F.headline]),
    location: str(f[F.location]),
    enrichedAt: str(f[F.enrichedAt]),
    source: str(f[F.source]),
    companyId: firstId(f[F.company]),
    createdTime: rec.createdTime,
  };
}

function toDeal(rec: AirtableRecord): Deal {
  const f = rec.fields;
  const F = FIELDS.deals;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    stage: str(f[F.stage]) as Deal["stage"],
    mrr: numv(f[F.mrr]),
    setupFee: numv(f[F.setupFee]),
    source: str(f[F.source]) as Deal["source"],
    expectedCloseDate: str(f[F.expectedCloseDate]),
    lostReason: str(f[F.lostReason]),
    owner: str(f[F.owner]),
    nextStep: str(f[F.nextStep]),
    nextStepDate: str(f[F.nextStepDate]),
    companyId: firstId(f[F.company]),
    createdTime: rec.createdTime,
  };
}

// --- write field builders ---------------------------------------------------

function buildCompanyFields(input: CompanyInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.companies;
  const f: Record<string, unknown> = {};
  const has = (k: keyof CompanyInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Company name");
  if (has("website")) f[F.website] = text(input.website);
  if (has("type")) f[F.type] = enumOrNull(input.type, COMPANY_TYPES, "type");
  if (has("country")) f[F.country] = text(input.country);
  if (has("region")) f[F.region] = enumOrNull(input.region, REGIONS, "region");
  if (has("linkedin")) f[F.linkedin] = text(input.linkedin);
  if (has("socials")) f[F.socials] = text(input.socials);
  if (has("lifecycleStage"))
    f[F.lifecycleStage] = enumOrNull(input.lifecycleStage, LIFECYCLE_STAGES, "lifecycle stage");
  if (has("planTier")) f[F.planTier] = text(input.planTier);
  if (has("mrr")) f[F.mrr] = numberOrNull(input.mrr);
  if (has("goLiveDate")) f[F.goLiveDate] = text(input.goLiveDate);
  if (has("renewalDate")) f[F.renewalDate] = text(input.renewalDate);
  if (has("accountHealth"))
    f[F.accountHealth] = enumOrNull(input.accountHealth, ACCOUNT_HEALTH, "account health");
  if (has("careCadence"))
    f[F.careCadence] = enumOrNull(input.careCadence, CARE_CADENCES, "care cadence");
  if (has("productsUsed")) f[F.productsUsed] = text(input.productsUsed);
  if (has("description")) f[F.description] = text(input.description);
  if (has("sizeBand")) f[F.sizeBand] = enumOrNull(input.sizeBand, SIZE_BANDS, "size band");
  if (has("watchlist")) f[F.watchlist] = boolean(input.watchlist);
  // Note: AI Brief, Next Best Action, enrichment + last-meaningful-contact are written
  // by later-stage jobs, not by the CRUD forms, so they are intentionally not settable here.
  return f;
}

function buildContactFields(input: ContactInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.contacts;
  const f: Record<string, unknown> = {};
  const has = (k: keyof ContactInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Contact name");
  if (has("role")) f[F.role] = text(input.role);
  if (has("email")) f[F.email] = text(input.email);
  if (has("phone")) f[F.phone] = text(input.phone);
  if (has("linkedin")) f[F.linkedin] = text(input.linkedin);
  if (has("marketingOptIn"))
    f[F.marketingOptIn] = enumOrNull(input.marketingOptIn, MARKETING_OPT_IN, "marketing opt-in");
  if (has("notes")) f[F.notes] = text(input.notes);
  if (has("headline")) f[F.headline] = text(input.headline);
  if (has("location")) f[F.location] = text(input.location);
  if (has("source")) f[F.source] = text(input.source);
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  return f;
}

function buildDealFields(input: DealInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.deals;
  const f: Record<string, unknown> = {};
  const has = (k: keyof DealInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Deal name");
  if (has("stage")) f[F.stage] = enumOrNull(input.stage, DEAL_STAGES, "stage");
  if (has("mrr")) f[F.mrr] = numberOrNull(input.mrr);
  if (has("setupFee")) f[F.setupFee] = numberOrNull(input.setupFee);
  if (has("source")) f[F.source] = enumOrNull(input.source, DEAL_SOURCES, "source");
  if (has("expectedCloseDate")) f[F.expectedCloseDate] = text(input.expectedCloseDate);
  if (has("lostReason")) f[F.lostReason] = text(input.lostReason);
  if (has("owner")) f[F.owner] = text(input.owner);
  if (has("nextStep")) f[F.nextStep] = text(input.nextStep);
  if (has("nextStepDate")) f[F.nextStepDate] = text(input.nextStepDate);
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  return f;
}

// --- companies --------------------------------------------------------------

export async function listCompanies(opts: { q?: string; limit?: number } = {}): Promise<Company[]> {
  const F = FIELDS.companies;
  const q = opts.q ? formulaSafe(opts.q) : "";
  const filterByFormula = q
    ? `OR(FIND("${q}", LOWER({${F.name}}&"")), FIND("${q}", LOWER({${F.country}}&"")), FIND("${q}", LOWER({${F.website}}&"")))`
    : undefined;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.companies, {
    filterByFormula,
    sort: [{ field: F.name, direction: "asc" }],
    maxRecords: opts.limit ?? 1000,
  });
  return records.map(toCompany);
}

export async function getCompany(id: string): Promise<Company> {
  return toCompany(await getRecord(AIRTABLE_BASE_ID, TABLES.companies, id));
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  const fields = buildCompanyFields(input, false);
  return toCompany(await createRecord(AIRTABLE_BASE_ID, TABLES.companies, fields));
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  const fields = buildCompanyFields(input, true);
  return toCompany(await updateRecord(AIRTABLE_BASE_ID, TABLES.companies, id, fields));
}

export async function deleteCompany(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.companies, id);
}

// --- contacts ---------------------------------------------------------------

export async function listContacts(opts: { q?: string; limit?: number } = {}): Promise<Contact[]> {
  const F = FIELDS.contacts;
  const q = opts.q ? formulaSafe(opts.q) : "";
  const filterByFormula = q
    ? `OR(FIND("${q}", LOWER({${F.name}}&"")), FIND("${q}", LOWER({${F.email}}&"")), FIND("${q}", LOWER({${F.role}}&"")))`
    : undefined;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.contacts, {
    filterByFormula,
    sort: [{ field: F.name, direction: "asc" }],
    maxRecords: opts.limit ?? 1000,
  });
  const contacts = records.map(toContact);
  await attachCompanyNames(contacts);
  return contacts;
}

export async function listContactsByIds(ids: string[]): Promise<Contact[]> {
  const records = await recordsByIds(TABLES.contacts, ids);
  return records.map(toContact).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listContactsByCompany(companyId: string): Promise<Contact[]> {
  // Linked-record IDs are not queryable via formula, so read the company's reverse
  // link (Contacts) and fetch those records by ID.
  const company = await getRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId);
  return listContactsByIds(idList(company.fields[FIELDS.companies.contacts]));
}

export async function getContact(id: string): Promise<Contact> {
  const contact = toContact(await getRecord(AIRTABLE_BASE_ID, TABLES.contacts, id));
  await attachCompanyNames([contact]);
  return contact;
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const fields = buildContactFields(input, false);
  return toContact(await createRecord(AIRTABLE_BASE_ID, TABLES.contacts, fields));
}

export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  const fields = buildContactFields(input, true);
  return toContact(await updateRecord(AIRTABLE_BASE_ID, TABLES.contacts, id, fields));
}

export async function deleteContact(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.contacts, id);
}

// --- deals ------------------------------------------------------------------

export async function listDeals(opts: { q?: string; limit?: number } = {}): Promise<Deal[]> {
  const F = FIELDS.deals;
  const q = opts.q ? formulaSafe(opts.q) : "";
  const filterByFormula = q
    ? `FIND("${q}", LOWER({${F.name}}&""))`
    : undefined;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.deals, {
    filterByFormula,
    sort: [{ field: F.name, direction: "asc" }],
    maxRecords: opts.limit ?? 1000,
  });
  const deals = records.map(toDeal);
  await attachDealCompanyNames(deals);
  return deals;
}

export async function listDealsByIds(ids: string[]): Promise<Deal[]> {
  const records = await recordsByIds(TABLES.deals, ids);
  return records.map(toDeal).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listDealsByCompany(companyId: string): Promise<Deal[]> {
  const company = await getRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId);
  return listDealsByIds(idList(company.fields[FIELDS.companies.deals]));
}

export async function getDeal(id: string): Promise<Deal> {
  const deal = toDeal(await getRecord(AIRTABLE_BASE_ID, TABLES.deals, id));
  await attachDealCompanyNames([deal]);
  return deal;
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const fields = buildDealFields(input, false);
  return toDeal(await createRecord(AIRTABLE_BASE_ID, TABLES.deals, fields));
}

export async function updateDeal(id: string, input: DealInput): Promise<Deal> {
  const fields = buildDealFields(input, true);
  return toDeal(await updateRecord(AIRTABLE_BASE_ID, TABLES.deals, id, fields));
}

export async function deleteDeal(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.deals, id);
}

// --- search -----------------------------------------------------------------

export async function searchAll(
  q: string,
  limit = 20,
): Promise<{ companies: Company[]; contacts: Contact[] }> {
  if (!formulaSafe(q)) return { companies: [], contacts: [] };
  const [companies, contacts] = await Promise.all([
    listCompanies({ q, limit }),
    listContacts({ q, limit }),
  ]);
  return { companies, contacts };
}

// --- helpers: fetch by id, resolve linked company names --------------------

/** Build a filterByFormula that matches a set of record IDs. */
function idFormula(ids: string[]): string {
  if (ids.length === 1) return `RECORD_ID()="${ids[0]}"`;
  return `OR(${ids.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
}

async function recordsByIds(tableId: string, ids: string[]): Promise<AirtableRecord[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  return listRecords(AIRTABLE_BASE_ID, tableId, {
    filterByFormula: idFormula(unique),
    maxRecords: unique.length,
  });
}

async function companyNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const F = FIELDS.companies;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.companies, {
    filterByFormula: idFormula(unique),
    fields: [F.name],
    maxRecords: unique.length,
  });
  for (const rec of records) map.set(rec.id, str(rec.fields[F.name]) ?? "");
  return map;
}

async function attachCompanyNames(contacts: Contact[]): Promise<void> {
  const ids = contacts.map((c) => c.companyId).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const map = await companyNameMap(ids);
  for (const c of contacts) if (c.companyId) c.companyName = map.get(c.companyId);
}

async function attachDealCompanyNames(deals: Deal[]): Promise<void> {
  const ids = deals.map((d) => d.companyId).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const map = await companyNameMap(ids);
  for (const d of deals) if (d.companyId) d.companyName = map.get(d.companyId);
}

// --- integration seam (brief §8): wired in Stage 5 -------------------------

/**
 * When a Deal hits "Won", hand off to tg-onboarding (create the client record that
 * kicks off onboarding) and flip the company to Customer with a starter care cadence.
 * Seam designed now; implemented once tg-onboarding's backend lands.
 */
export async function handoffWonDeal(_dealId: string): Promise<never> {
  throw new Error("handoffWonDeal is not implemented yet (Stage 5 — tg-onboarding seam)");
}
