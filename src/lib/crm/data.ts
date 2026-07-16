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
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  MEANINGFUL_ACTIVITY_TYPES,
  TASK_STATUSES,
  TASK_CREATED_BY,
  TOUCH_TYPES,
  CARE_STATUSES,
} from "./config";
import type {
  Activity,
  ActivityInput,
  CareTouch,
  CareTouchInput,
  Company,
  CompanyInput,
  Contact,
  ContactInput,
  Deal,
  DealInput,
  Task,
  TaskInput,
} from "./types";
import {
  AirtableRecord,
  createRecord,
  createRecords,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
  updateRecords,
} from "@/lib/airtable";
import { emailBrand, hostBrand, nameKey } from "@/lib/domain";

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
    supportOpenTickets: numv(f[F.supportOpenTickets]),
    supportTickets30d: numv(f[F.supportTickets30d]),
    supportLastIssue: str(f[F.supportLastIssue]),
    supportLastContact: str(f[F.supportLastContact]),
    supportSentiment: str(f[F.supportSentiment]) as Company["supportSentiment"],
    supportUpdated: str(f[F.supportUpdated]),
    contactIds: idList(f[F.contacts]),
    dealIds: idList(f[F.deals]),
    activityIds: idList(f[F.activities]),
    taskIds: idList(f[F.tasks]),
    createdTime: rec.createdTime,
  };
}

function toActivity(rec: AirtableRecord): Activity {
  const f = rec.fields;
  const F = FIELDS.activities;
  return {
    id: rec.id,
    summary: str(f[F.summary]) ?? "",
    type: str(f[F.type]) as Activity["type"],
    date: str(f[F.date]),
    rawContent: str(f[F.rawContent]),
    source: str(f[F.source]) as Activity["source"],
    companyId: firstId(f[F.company]),
    contactId: firstId(f[F.contact]),
    dealId: firstId(f[F.deal]),
    createdTime: rec.createdTime,
  };
}

function toTask(rec: AirtableRecord): Task {
  const f = rec.fields;
  const F = FIELDS.tasks;
  return {
    id: rec.id,
    title: str(f[F.title]) ?? "",
    dueDate: str(f[F.dueDate]),
    status: str(f[F.status]) as Task["status"],
    owner: str(f[F.owner]),
    createdBy: str(f[F.createdBy]) as Task["createdBy"],
    companyId: firstId(f[F.company]),
    dealId: firstId(f[F.deal]),
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
  if (has("enrichedAt")) f[F.enrichedAt] = text(input.enrichedAt);
  if (has("enrichmentSource")) f[F.enrichmentSource] = text(input.enrichmentSource);
  // AI Brief, Next Best Action and Last Meaningful Contact are written by app jobs,
  // not the CRUD forms, so they remain not settable here.
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
  if (has("enrichedAt")) f[F.enrichedAt] = text(input.enrichedAt);
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

/** Bulk-create companies (Monday import), chunked to Airtable's 10-per-request limit. */
export async function createCompaniesBatch(inputs: CompanyInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const fieldsList = inputs.map((i) => buildCompanyFields(i, false));
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.companies, fieldsList);
  return created.length;
}

/** Bulk-create companies and return the created records (needed to link contacts). */
export async function createCompaniesReturning(inputs: CompanyInput[]): Promise<Company[]> {
  if (inputs.length === 0) return [];
  const fieldsList = inputs.map((i) => buildCompanyFields(i, false));
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.companies, fieldsList);
  return created.map((r) => toCompany(r));
}

/** Bulk-set Account Health on existing companies (Clients Progress overlay). */
export async function updateCompaniesHealth(
  updates: { id: string; health: string }[],
): Promise<number> {
  if (updates.length === 0) return 0;
  const F = FIELDS.companies;
  const records = updates.map((u) => ({ id: u.id, fields: { [F.accountHealth]: u.health } }));
  const updated = await updateRecords(AIRTABLE_BASE_ID, TABLES.companies, records);
  return updated.length;
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  const fields = buildCompanyFields(input, true);
  return toCompany(await updateRecord(AIRTABLE_BASE_ID, TABLES.companies, id, fields));
}

export async function deleteCompany(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.companies, id);
}

/** Write the app-generated AI fields (not settable via the CRUD whitelist). */
export async function saveCompanyBrief(
  id: string,
  brief: string,
  nextBestAction: string,
): Promise<Company> {
  const F = FIELDS.companies;
  const rec = await updateRecord(AIRTABLE_BASE_ID, TABLES.companies, id, {
    [F.aiBrief]: brief,
    [F.nextBestAction]: nextBestAction,
  });
  return toCompany(rec);
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

/** The brand tokens that identify a company: its website domain and its name. */
function companyBrands(company: Pick<Company, "name" | "website">): string[] {
  const brands = new Set<string>();
  if (company.website) {
    const b = hostBrand(company.website);
    if (b.length >= 3) brands.add(b);
  }
  const nk = nameKey(company.name);
  if (nk.length >= 4) brands.add(nk);
  return [...brands];
}

/**
 * People who almost certainly belong to this account but aren't linked yet —
 * matched by email domain (e.g. kelly@aarucollective.com -> "A'ARU Collective").
 * Only unlinked contacts are suggested, so we never poach someone from another
 * account. Powers the "add these people" prompt on the company page.
 */
export async function listSuggestedContactsForCompany(
  company: Pick<Company, "id" | "name" | "website">,
  excludeIds: string[] = [],
): Promise<Contact[]> {
  const brands = companyBrands(company);
  if (brands.length === 0) return [];
  const F = FIELDS.contacts;
  // Narrow server-side by the "@brand." fragment, then confirm the brand in JS.
  const clauses = brands.map((b) => `FIND("@${b}.", LOWER({${F.email}}&""))`);
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.contacts, {
    filterByFormula: clauses.length === 1 ? clauses[0] : `OR(${clauses.join(",")})`,
    maxRecords: 50,
  });
  const brandSet = new Set(brands);
  const exclude = new Set(excludeIds);
  return records
    .map(toContact)
    .filter((c) => !c.companyId && !exclude.has(c.id) && brandSet.has(emailBrand(c.email)))
    .sort((a, b) => a.name.localeCompare(b.name));
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

/** Bulk-create contacts (Monday import), chunked to Airtable's 10-per-request limit. */
export async function createContactsBatch(inputs: ContactInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const fieldsList = inputs.map((i) => buildContactFields(i, false));
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.contacts, fieldsList);
  return created.length;
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

/** Bulk-create deals (Monday import), chunked to Airtable's 10-per-request limit. */
export async function createDealsBatch(inputs: DealInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const fieldsList = inputs.map((i) => buildDealFields(i, false));
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.deals, fieldsList);
  return created.length;
}

export async function updateDeal(id: string, input: DealInput): Promise<Deal> {
  const fields = buildDealFields(input, true);
  return toDeal(await updateRecord(AIRTABLE_BASE_ID, TABLES.deals, id, fields));
}

export async function deleteDeal(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.deals, id);
}

// --- activities (append-only timeline) -------------------------------------

function buildActivityFields(input: ActivityInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.activities;
  const f: Record<string, unknown> = {};
  const has = (k: keyof ActivityInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has("summary")) f[F.summary] = requiredText(input.summary, "Summary");
  if (has("type")) f[F.type] = enumOrNull(input.type, ACTIVITY_TYPES, "type");
  if (has("date")) f[F.date] = text(input.date);
  if (has("rawContent")) f[F.rawContent] = text(input.rawContent);
  if (has("source")) f[F.source] = enumOrNull(input.source, ACTIVITY_SOURCES, "source");
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  if (has("contactId")) {
    const id = text(input.contactId);
    f[F.contact] = id ? [id] : [];
  }
  if (has("dealId")) {
    const id = text(input.dealId);
    f[F.deal] = id ? [id] : [];
  }
  return f;
}

export async function listActivitiesByIds(ids: string[]): Promise<Activity[]> {
  const records = await recordsByIds(TABLES.activities, ids);
  return records
    .map(toActivity)
    .sort((a, b) => (b.date || b.createdTime || "").localeCompare(a.date || a.createdTime || ""));
}

export async function listActivitiesByCompany(companyId: string): Promise<Activity[]> {
  const company = await getRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId);
  return listActivitiesByIds(idList(company.fields[FIELDS.companies.activities]));
}

export async function createActivity(input: ActivityInput): Promise<Activity> {
  const F = FIELDS.activities;
  const fields = buildActivityFields(input, false);
  if (fields[F.type] == null) fields[F.type] = "Note";
  if (fields[F.source] == null) fields[F.source] = "Manual";
  if (fields[F.date] == null) fields[F.date] = new Date().toISOString();

  const activity = toActivity(await createRecord(AIRTABLE_BASE_ID, TABLES.activities, fields));

  // Maintain Last Meaningful Contact when the activity is a real human touch.
  if (
    activity.companyId &&
    activity.type &&
    (MEANINGFUL_ACTIVITY_TYPES as readonly string[]).includes(activity.type)
  ) {
    await bumpLastMeaningfulContact(activity.companyId, activity.date);
  }
  return activity;
}

export async function deleteActivity(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.activities, id);
}

async function bumpLastMeaningfulContact(companyId: string, isoDate?: string): Promise<void> {
  const date = (isoDate || new Date().toISOString()).slice(0, 10); // YYYY-MM-DD
  try {
    const rec = await getRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId);
    const current = str(rec.fields[FIELDS.companies.lastMeaningfulContact]);
    if (!current || date > current) {
      await updateRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId, {
        [FIELDS.companies.lastMeaningfulContact]: date,
      });
    }
  } catch {
    // Non-fatal: the activity is logged even if the rollup write fails.
  }
}

/** Most recent activity date per deal and per company, for stale-deal flagging. */
export async function activityRecency(): Promise<{
  byDeal: Record<string, string>;
  byCompany: Record<string, string>;
}> {
  const F = FIELDS.activities;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.activities, {
    fields: [F.date, F.deal, F.company],
    maxRecords: 5000,
  });
  const byDeal: Record<string, string> = {};
  const byCompany: Record<string, string> = {};
  for (const rec of records) {
    const date = str(rec.fields[F.date]) || rec.createdTime;
    if (!date) continue;
    const dealId = firstId(rec.fields[F.deal]);
    const companyId = firstId(rec.fields[F.company]);
    if (dealId && (!byDeal[dealId] || date > byDeal[dealId])) byDeal[dealId] = date;
    if (companyId && (!byCompany[companyId] || date > byCompany[companyId])) byCompany[companyId] = date;
  }
  return { byDeal, byCompany };
}

// --- tasks ------------------------------------------------------------------

function buildTaskFields(input: TaskInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.tasks;
  const f: Record<string, unknown> = {};
  const has = (k: keyof TaskInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has("title")) f[F.title] = requiredText(input.title, "Task title");
  if (has("dueDate")) f[F.dueDate] = text(input.dueDate);
  if (has("status")) f[F.status] = enumOrNull(input.status, TASK_STATUSES, "status");
  if (has("owner")) f[F.owner] = text(input.owner);
  if (has("createdBy")) f[F.createdBy] = enumOrNull(input.createdBy, TASK_CREATED_BY, "created by");
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  if (has("dealId")) {
    const id = text(input.dealId);
    f[F.deal] = id ? [id] : [];
  }
  return f;
}

function taskSort(a: Task, b: Task): number {
  const ad = a.status === "Done" ? 1 : 0;
  const bd = b.status === "Done" ? 1 : 0;
  if (ad !== bd) return ad - bd;
  return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
}

export async function listTasksByIds(ids: string[]): Promise<Task[]> {
  const records = await recordsByIds(TABLES.tasks, ids);
  return records.map(toTask).sort(taskSort);
}

export async function listTasksByCompany(companyId: string): Promise<Task[]> {
  const company = await getRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId);
  return listTasksByIds(idList(company.fields[FIELDS.companies.tasks]));
}

/** All not-Done tasks across every company, with company names, for the Today view. */
export async function listOpenTasks(): Promise<Task[]> {
  const F = FIELDS.tasks;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.tasks, {
    filterByFormula: `NOT({${F.status}}='Done')`,
    maxRecords: 1000,
  });
  const tasks = records.map(toTask).sort(taskSort);
  const ids = tasks.map((t) => t.companyId).filter((x): x is string => !!x);
  if (ids.length) {
    const map = await companyNameMap(ids);
    for (const t of tasks) if (t.companyId) t.companyName = map.get(t.companyId);
  }
  return tasks;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const F = FIELDS.tasks;
  const fields = buildTaskFields(input, false);
  if (fields[F.status] == null) fields[F.status] = "Open";
  if (fields[F.createdBy] == null) fields[F.createdBy] = "Manual";
  return toTask(await createRecord(AIRTABLE_BASE_ID, TABLES.tasks, fields));
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  return toTask(await updateRecord(AIRTABLE_BASE_ID, TABLES.tasks, id, buildTaskFields(input, true)));
}

export async function deleteTask(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.tasks, id);
}

// --- care touches + cadence engine -----------------------------------------

function toCareTouch(rec: AirtableRecord): CareTouch {
  const f = rec.fields;
  const F = FIELDS.careTouches;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    touchType: str(f[F.touchType]) as CareTouch["touchType"],
    dueDate: str(f[F.dueDate]),
    status: str(f[F.status]) as CareTouch["status"],
    outcomeNotes: str(f[F.outcomeNotes]),
    companyId: firstId(f[F.company]),
    createdTime: rec.createdTime,
  };
}

function buildCareTouchFields(input: CareTouchInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.careTouches;
  const f: Record<string, unknown> = {};
  const has = (k: keyof CareTouchInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Name");
  if (has("touchType")) f[F.touchType] = enumOrNull(input.touchType, TOUCH_TYPES, "touch type");
  if (has("dueDate")) f[F.dueDate] = text(input.dueDate);
  if (has("status")) f[F.status] = enumOrNull(input.status, CARE_STATUSES, "status");
  if (has("outcomeNotes")) f[F.outcomeNotes] = text(input.outcomeNotes);
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  return f;
}

/** Care cadence in months. Top-tier monthly, standard quarterly (brief §4). */
export function cadenceMonths(cadence?: string): number | null {
  if (cadence === "Monthly") return 1;
  if (cadence === "Quarterly") return 3;
  return null;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface CareRow {
  company: Company;
  nextTouch?: CareTouch;
}

/** All customers with their next open (Scheduled) care touch, soonest-due first. */
export async function listCareBoard(): Promise<CareRow[]> {
  const F = FIELDS.careTouches;
  const [companies, touchRecs] = await Promise.all([
    listCompanies(),
    listRecords(AIRTABLE_BASE_ID, TABLES.careTouches, {
      filterByFormula: `{${F.status}}='Scheduled'`,
      maxRecords: 2000,
    }),
  ]);
  const customers = companies.filter((c) => c.lifecycleStage === "Customer");
  const nextByCompany = new Map<string, CareTouch>();
  for (const rec of touchRecs) {
    const t = toCareTouch(rec);
    if (!t.companyId) continue;
    const cur = nextByCompany.get(t.companyId);
    if (!cur || (t.dueDate || "9999-99-99") < (cur.dueDate || "9999-99-99")) {
      nextByCompany.set(t.companyId, t);
    }
  }
  return customers
    .map((company) => ({ company, nextTouch: nextByCompany.get(company.id) }))
    .sort((a, b) =>
      (a.nextTouch?.dueDate || "9999-99-99").localeCompare(b.nextTouch?.dueDate || "9999-99-99"),
    );
}

export async function createCareTouch(input: CareTouchInput): Promise<CareTouch> {
  const F = FIELDS.careTouches;
  const fields = buildCareTouchFields(input, false);
  if (fields[F.status] == null) fields[F.status] = "Scheduled";
  return toCareTouch(await createRecord(AIRTABLE_BASE_ID, TABLES.careTouches, fields));
}

export async function deleteCareTouch(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.careTouches, id);
}

/**
 * All care touches for one company (company page). The touch->company link isn't
 * queryable by record id via formula, so we read the table (small) and filter in
 * JS on the linked id, exactly as listCareBoard does.
 */
export async function listCareTouchesByCompany(companyId: string): Promise<CareTouch[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.careTouches, { maxRecords: 2000 });
  return records
    .map(toCareTouch)
    .filter((t) => t.companyId === companyId)
    .sort((a, b) => {
      // Open (Scheduled) first by soonest due, then history by most-recent due.
      const openA = a.status === "Scheduled" ? 0 : 1;
      const openB = b.status === "Scheduled" ? 0 : 1;
      if (openA !== openB) return openA - openB;
      if (openA === 0) return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      return (b.dueDate || "").localeCompare(a.dueDate || "");
    });
}

/** Ensure every cadenced customer with no open Scheduled touch has one. Idempotent. */
export async function generateDueTouches(): Promise<number> {
  const board = await listCareBoard();
  const today = new Date().toISOString().slice(0, 10);
  const F = FIELDS.careTouches;
  const toCreate: Record<string, unknown>[] = [];
  for (const { company, nextTouch } of board) {
    const months = cadenceMonths(company.careCadence);
    if (!months || nextTouch) continue;
    const due = addMonths(company.lastMeaningfulContact || today, months);
    toCreate.push({
      [F.name]: `Check-In Call · ${company.name}`,
      [F.touchType]: "Check-In Call",
      [F.dueDate]: due,
      [F.status]: "Scheduled",
      [F.company]: [company.id],
    });
  }
  if (toCreate.length === 0) return 0;
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.careTouches, toCreate);
  return created.length;
}

/** Complete a touch with an outcome, then schedule the next per the company cadence. */
export async function logCareTouch(
  touchId: string,
  input: { outcomeNotes?: string; touchType?: string },
): Promise<CareTouch> {
  const completeFields: CareTouchInput = { status: "Completed" };
  if (input.outcomeNotes !== undefined) completeFields.outcomeNotes = input.outcomeNotes;
  if (input.touchType) completeFields.touchType = input.touchType as CareTouch["touchType"];
  const updated = toCareTouch(
    await updateRecord(
      AIRTABLE_BASE_ID,
      TABLES.careTouches,
      touchId,
      buildCareTouchFields(completeFields, true),
    ),
  );
  if (updated.companyId) {
    const company = await getCompany(updated.companyId);
    const months = cadenceMonths(company.careCadence);
    if (months) {
      await createCareTouch({
        companyId: company.id,
        touchType: "Check-In Call",
        dueDate: addMonths(new Date().toISOString().slice(0, 10), months),
        status: "Scheduled",
        name: `Check-In Call · ${company.name}`,
      });
    }
  }
  return updated;
}

/**
 * Log a care touch for a company by completing its next open Scheduled touch.
 * If there isn't one, record a Completed touch and schedule the next per cadence.
 * Lets Ask Luna log care by company name without the caller knowing a touch id.
 */
export async function logCareTouchForCompany(
  companyId: string,
  input: { outcomeNotes?: string; touchType?: string },
): Promise<CareTouch> {
  const board = await listCareBoard();
  const row = board.find((r) => r.company.id === companyId);
  if (row?.nextTouch) return logCareTouch(row.nextTouch.id, input);

  const company = row?.company ?? (await getCompany(companyId));
  const touchType = (input.touchType as CareTouch["touchType"]) || "Check-In Call";
  const today = new Date().toISOString().slice(0, 10);
  const completed = await createCareTouch({
    companyId,
    touchType,
    outcomeNotes: input.outcomeNotes,
    status: "Completed",
    dueDate: today,
    name: `${touchType} · ${company.name}`,
  });
  const months = cadenceMonths(company.careCadence);
  if (months) {
    await createCareTouch({
      companyId,
      touchType: "Check-In Call",
      status: "Scheduled",
      dueDate: addMonths(today, months),
      name: `Check-In Call · ${company.name}`,
    });
  }
  return completed;
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

// --- dedupe lookups (LinkedIn import) --------------------------------------

export async function findContactByLinkedin(url: string): Promise<Contact | null> {
  const needle = formulaSafe(url);
  if (!needle) return null;
  const F = FIELDS.contacts;
  const recs = await listRecords(AIRTABLE_BASE_ID, TABLES.contacts, {
    filterByFormula: `FIND("${needle}", LOWER({${F.linkedin}}&""))`,
    maxRecords: 1,
  });
  return recs[0] ? toContact(recs[0]) : null;
}

export async function findCompanyByLinkedinOrName(
  url: string,
  name?: string,
): Promise<Company | null> {
  const F = FIELDS.companies;
  const clauses: string[] = [];
  const u = formulaSafe(url);
  if (u) clauses.push(`FIND("${u}", LOWER({${F.linkedin}}&""))`);
  const n = name ? formulaSafe(name) : "";
  if (n) clauses.push(`LOWER({${F.name}}&"")="${n}"`);
  if (clauses.length === 0) return null;
  const recs = await listRecords(AIRTABLE_BASE_ID, TABLES.companies, {
    filterByFormula: clauses.length === 1 ? clauses[0] : `OR(${clauses.join(",")})`,
    maxRecords: 1,
  });
  return recs[0] ? toCompany(recs[0]) : null;
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

// --- contact re-linking (reunite orphaned contacts with their account) -----

export interface ContactLink {
  contactId: string;
  contactName: string;
  email: string;
  companyId: string;
  companyName: string;
}

/**
 * Propose links for orphaned contacts (no company) by matching their email
 * domain to a company's website domain or name. Conservative: a brand must map
 * to exactly one company, so we never guess between same-named accounts. The
 * Monday import linked contacts by an exact company-name text match only, which
 * left anyone with a blank/mismatched company field stranded — this reunites them.
 */
export async function planContactLinks(): Promise<ContactLink[]> {
  const [companies, contactRecs] = await Promise.all([
    listCompanies(),
    listRecords(AIRTABLE_BASE_ID, TABLES.contacts, {
      filterByFormula: `NOT({${FIELDS.contacts.email}}='')`,
      maxRecords: 5000,
    }),
  ]);

  // brand -> set of company ids. A brand pointing at more than one company is
  // ambiguous and dropped, so we only ever link when the account is unambiguous.
  const byBrand = new Map<string, Set<string>>();
  const add = (brand: string, id: string) => {
    if (brand.length < 3) return;
    const s = byBrand.get(brand) ?? new Set<string>();
    s.add(id);
    byBrand.set(brand, s);
  };
  const nameById = new Map<string, string>();
  for (const c of companies) {
    nameById.set(c.id, c.name);
    if (c.website) add(hostBrand(c.website), c.id);
    const nk = nameKey(c.name);
    if (nk.length >= 4) add(nk, c.id);
  }

  const links: ContactLink[] = [];
  for (const rec of contactRecs) {
    const c = toContact(rec);
    if (c.companyId) continue; // already linked — leave it
    const brand = emailBrand(c.email);
    if (!brand) continue;
    const ids = byBrand.get(brand);
    if (!ids || ids.size !== 1) continue; // unknown or ambiguous
    const companyId = [...ids][0];
    links.push({
      contactId: c.id,
      contactName: c.name,
      email: c.email || "",
      companyId,
      companyName: nameById.get(companyId) || "",
    });
  }
  return links.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

/** Link a batch of contacts to their companies. Returns how many were updated. */
export async function applyContactLinks(
  pairs: { contactId: string; companyId: string }[],
): Promise<number> {
  const F = FIELDS.contacts;
  const records = pairs
    .filter((p) => p.contactId && p.companyId)
    .map((p) => ({ id: p.contactId, fields: { [F.company]: [p.companyId] } }));
  if (records.length === 0) return 0;
  const updated = await updateRecords(AIRTABLE_BASE_ID, TABLES.contacts, records);
  return updated.length;
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
