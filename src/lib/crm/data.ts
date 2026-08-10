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
  DEAL_SOURCES,
  MARKETING_OPT_IN,
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  ACTIVITY_DIRECTIONS,
  MEANINGFUL_ACTIVITY_TYPES,
  TASK_STATUSES,
  TASK_CREATED_BY,
  TOUCH_TYPES,
  CARE_STATUSES,
  SEQUENCE_STATUSES,
  ENROLLMENT_STATUSES,
  SIGNAL_TYPES,
  SIGNAL_STATUSES,
  DEFAULT_PIPELINE_STAGES,
  PIPELINE_STAGES_KEY,
  STAGE_COLORS,
  STAGE_KINDS,
  PACKAGES,
  TRACKING_KINDS,
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
  EmailAttachment,
  EmailTemplate,
  EmailTemplateInput,
  PipelineStage,
  Signal,
  SignalInput,
  EmailTracking,
  EmailTrackingInput,
  EmailOpenStatus,
  InboxSyncStatus,
  InboxBackfillStatus,
  AwaitingReply,
  Sequence,
  SequenceInput,
  SequenceStep,
  SequenceEnrollment,
  EnrollmentInput,
  StageKind,
  Task,
  TaskInput,
} from "./types";
import { findDuplicateGroups, type DuplicateGroup } from "./duplicates";
import {
  AirtableRecord,
  createRecord,
  createRecords,
  deleteRecord,
  deleteRecords,
  getRecord,
  listRecords,
  updateRecord,
  updateRecords,
  uploadAttachment,
} from "@/lib/airtable";
import { getSetting, setSetting } from "@/lib/settings";
import { emailBrand, hostBrand, nameKey } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";

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
/** Split a multiline text cell into trimmed, non-empty lines. */
function splitLines(v?: string): string[] | undefined {
  if (!v) return undefined;
  const out = v
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}
function firstId(v: unknown): string | undefined {
  return idList(v)[0];
}

// List views load the whole directory (paginated), not a truncated page — the
// old 1,000 cap silently cut the People/Companies lists off partway (e.g. at "S").
const LIST_CAP = 50000;
// Above this many ids, filter-by-record-id formulas risk Airtable's length limit,
// so we scan the (small) companies table once instead.
const ID_FILTER_MAX = 100;

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
    onboardingClientId: str(f[F.onboardingClientId]),
    onboardingStarted: str(f[F.onboardingStarted]),
    signalsCheckedAt: str(f[F.signalsChecked]),
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
    gmailMessageId: str(f[F.gmailMessageId]),
    direction: str(f[F.direction]) as Activity["direction"],
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
    alternateEmails: splitLines(str(f[F.alternateEmails])),
    phone: normalizePhone(str(f[F.phone])),
    linkedin: str(f[F.linkedin]),
    marketingOptIn: str(f[F.marketingOptIn]) as Contact["marketingOptIn"],
    notes: str(f[F.notes]),
    headline: str(f[F.headline]),
    location: str(f[F.location]),
    enrichedAt: str(f[F.enrichedAt]),
    source: str(f[F.source]),
    companyId: firstId(f[F.company]),
    inboxSyncedAt: str(f[F.inboxSynced]),
    inboxBackfilledAt: str(f[F.inboxBackfilled]),
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
  if (has("signalsCheckedAt")) f[F.signalsChecked] = text(input.signalsCheckedAt);
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
  if (has("alternateEmails")) {
    const list = (input.alternateEmails ?? []).map((s) => s.trim()).filter(Boolean);
    f[F.alternateEmails] = list.length ? list.join("\n") : null;
  }
  if (has("phone")) f[F.phone] = normalizePhone(text(input.phone)) ?? null;
  if (has("linkedin")) f[F.linkedin] = text(input.linkedin);
  if (has("marketingOptIn"))
    f[F.marketingOptIn] = enumOrNull(input.marketingOptIn, MARKETING_OPT_IN, "marketing opt-in");
  if (has("notes")) f[F.notes] = text(input.notes);
  if (has("headline")) f[F.headline] = text(input.headline);
  if (has("location")) f[F.location] = text(input.location);
  if (has("source")) f[F.source] = text(input.source);
  if (has("enrichedAt")) f[F.enrichedAt] = text(input.enrichedAt);
  if (has("inboxSyncedAt")) f[F.inboxSynced] = text(input.inboxSyncedAt);
  if (has("inboxBackfilledAt")) f[F.inboxBackfilled] = text(input.inboxBackfilledAt);
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
  // Stage is a user-editable pipeline column, so accept any name; writes typecast
  // so a new/renamed stage auto-creates its Airtable single-select option.
  if (has("stage")) f[F.stage] = text(input.stage);
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
    maxRecords: opts.limit ?? LIST_CAP,
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
    maxRecords: opts.limit ?? LIST_CAP,
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

const CUSTOMER_LIFECYCLES = new Set(["Customer", "At Risk"]);
const LEAD_LIFECYCLES = new Set(["Prospect", "Engaged", "Opportunity"]);

/**
 * Move a contact's account between the Leads and Customers lists (the People
 * filter reads the company lifecycle). Only crosses groups — an account already
 * in the target group is left alone, so a specific stage like Opportunity isn't
 * flattened back to Prospect just by re-saving a contact.
 */
export async function applyLeadCustomerStatus(
  companyId: string,
  status: "customer" | "lead",
): Promise<void> {
  const company = await getCompany(companyId);
  const current = company.lifecycleStage ?? "";
  if (status === "customer" && !CUSTOMER_LIFECYCLES.has(current)) {
    await updateCompany(companyId, { lifecycleStage: "Customer" });
  } else if (status === "lead" && !LEAD_LIFECYCLES.has(current)) {
    await updateCompany(companyId, { lifecycleStage: "Prospect" });
  }
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
    maxRecords: opts.limit ?? LIST_CAP,
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
  return toDeal(await createRecord(AIRTABLE_BASE_ID, TABLES.deals, fields, { typecast: true }));
}

/** Bulk-create deals (Monday import), chunked to Airtable's 10-per-request limit. */
export async function createDealsBatch(inputs: DealInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const fieldsList = inputs.map((i) => buildDealFields(i, false));
  const created = await createRecords(AIRTABLE_BASE_ID, TABLES.deals, fieldsList, { typecast: true });
  return created.length;
}

export async function updateDeal(id: string, input: DealInput): Promise<Deal> {
  const fields = buildDealFields(input, true);
  return toDeal(await updateRecord(AIRTABLE_BASE_ID, TABLES.deals, id, fields, { typecast: true }));
}

export async function deleteDeal(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.deals, id);
}

// --- pipeline stages (editable) --------------------------------------------

/** Coerce arbitrary input into a clean, de-duplicated stage list. */
function normalizeStages(input: unknown): PipelineStage[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: PipelineStage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // stage names must be unique
    seen.add(key);
    const color = (STAGE_COLORS as readonly string[]).includes(String(o.color)) ? String(o.color) : "neutral";
    const kind = (STAGE_KINDS as readonly string[]).includes(String(o.kind))
      ? (String(o.kind) as StageKind)
      : "open";
    out.push({ name, color, kind });
  }
  return out;
}

/** The live pipeline columns — the stored config, or the defaults until customised. */
export async function getPipelineStages(): Promise<PipelineStage[]> {
  const raw = await getSetting(PIPELINE_STAGES_KEY).catch(() => null);
  if (raw) {
    try {
      const parsed = normalizeStages(JSON.parse(raw));
      if (parsed.length) return parsed;
    } catch {
      /* fall through to defaults on a corrupt value */
    }
  }
  return normalizeStages(DEFAULT_PIPELINE_STAGES);
}

async function savePipelineStages(stages: PipelineStage[]): Promise<void> {
  if (stages.length === 0) throw new ValidationError("A pipeline needs at least one stage");
  await setSetting(PIPELINE_STAGES_KEY, JSON.stringify(stages));
}

/** Relabel every deal currently in `from` to `to`. Small table, filtered in JS. */
async function moveDealsStage(from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return 0;
  const F = FIELDS.deals;
  const recs = await listRecords(AIRTABLE_BASE_ID, TABLES.deals, {
    fields: [F.stage],
    maxRecords: 5000,
  });
  const targets = recs
    .filter((r) => str(r.fields[F.stage]) === from)
    .map((r) => ({ id: r.id, fields: { [F.stage]: to } }));
  if (targets.length === 0) return 0;
  const updated = await updateRecords(AIRTABLE_BASE_ID, TABLES.deals, targets, { typecast: true });
  return updated.length;
}

/**
 * Apply an edit to the pipeline: rename cascades every deal old->new, remove
 * reassigns a column's deals to another stage, then the final column list is
 * saved. Adds/reorders/recolours are just the new list.
 */
export async function applyStageChanges(input: {
  stages: unknown;
  renames?: { from: string; to: string }[];
  removals?: { name: string; moveTo: string }[];
}): Promise<PipelineStage[]> {
  const stages = normalizeStages(input.stages);
  if (stages.length === 0) throw new ValidationError("A pipeline needs at least one stage");
  const names = new Set(stages.map((s) => s.name));

  for (const r of input.renames ?? []) {
    if (r && r.from && r.to && r.from !== r.to) await moveDealsStage(r.from, r.to);
  }
  for (const rm of input.removals ?? []) {
    if (!rm || !rm.name) continue;
    if (!rm.moveTo || !names.has(rm.moveTo)) {
      throw new ValidationError(`Choose where to move deals from "${rm.name}"`);
    }
    await moveDealsStage(rm.name, rm.moveTo);
  }

  await savePipelineStages(stages);
  return stages;
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
  if (has("gmailMessageId")) f[F.gmailMessageId] = text(input.gmailMessageId);
  if (has("direction")) f[F.direction] = enumOrNull(input.direction, ACTIVITY_DIRECTIONS, "direction");
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

/** Every logged email across the base (Activity type "Email"). For analytics + reply state. */
export async function listEmailActivities(): Promise<Activity[]> {
  const F = FIELDS.activities;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.activities, {
    filterByFormula: `{${F.type}}='Email'`,
    fields: [F.date, F.type, F.company, F.contact, F.summary, F.direction, F.gmailMessageId],
    maxRecords: 5000,
  });
  return records.map(toActivity);
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

// Top packages get proactive monthly care; everyone else quarterly. This is the
// fallback when a customer has no explicit cadence set, so the care programme
// covers every customer out of the box (brief: ≥1 touch per quarter) without
// anyone having to set a cadence on each record by hand.
const TOP_TIER_PACKAGES = new Set(["Ignite", "Bespoke"]);
export function effectiveCadenceMonths(
  company: { careCadence?: string | null; planTier?: string | null },
): number | null {
  const explicit = company.careCadence;
  if (explicit === "Monthly") return 1;
  if (explicit === "Quarterly") return 3;
  if (explicit === "None") return null; // deliberately opted out — respect it
  // Unset: sensible default from the package tier.
  return TOP_TIER_PACKAGES.has((company.planTier || "").trim()) ? 1 : 3;
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
    const months = effectiveCadenceMonths(company);
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
    const months = effectiveCadenceMonths(company);
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
  const months = effectiveCadenceMonths(company);
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
  // Small sets: fetch by id. Large sets (full list views): one scan of the table,
  // to stay clear of Airtable's filterByFormula length limit.
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.companies, {
    ...(unique.length <= ID_FILTER_MAX
      ? { filterByFormula: idFormula(unique), maxRecords: unique.length }
      : { maxRecords: LIST_CAP }),
    fields: [F.name],
  });
  for (const rec of records) map.set(rec.id, str(rec.fields[F.name]) ?? "");
  return map;
}

/** Company name + lifecycle for the contact/People list (customer vs lead lens). */
async function companyMetaMap(ids: string[]): Promise<Map<string, { name: string; lifecycle?: string }>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, { name: string; lifecycle?: string }>();
  if (unique.length === 0) return map;
  const F = FIELDS.companies;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.companies, {
    ...(unique.length <= ID_FILTER_MAX
      ? { filterByFormula: idFormula(unique), maxRecords: unique.length }
      : { maxRecords: LIST_CAP }),
    fields: [F.name, F.lifecycleStage],
  });
  for (const rec of records) {
    map.set(rec.id, {
      name: str(rec.fields[F.name]) ?? "",
      lifecycle: str(rec.fields[F.lifecycleStage]),
    });
  }
  return map;
}

async function attachCompanyNames(contacts: Contact[]): Promise<void> {
  const ids = contacts.map((c) => c.companyId).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const map = await companyMetaMap(ids);
  for (const c of contacts) {
    if (!c.companyId) continue;
    const meta = map.get(c.companyId);
    if (meta) {
      c.companyName = meta.name;
      c.companyLifecycle = meta.lifecycle as Contact["companyLifecycle"];
    }
  }
}

/**
 * Quick-add a lead or customer as the AMs think of it: a person at a company on
 * a package. Finds the company by name (or creates it, stamped with the chosen
 * lifecycle + package) and links the person to it. Company-only adds are allowed
 * (no person name), and an existing company is reused rather than duplicated.
 */
export async function quickAddPerson(input: {
  name?: string;
  email?: string;
  phone?: string;
  companyName: string;
  packageTier?: string;
  lifecycleStage?: string;
}): Promise<{ company: Company; contact: Contact | null }> {
  const companyName = (input.companyName || "").trim();
  if (!companyName) throw new ValidationError("Company name is required");
  const lifecycle = enumOrNull(input.lifecycleStage, LIFECYCLE_STAGES, "lifecycle stage");
  const pkg = text(input.packageTier);

  let company = await findCompanyByLinkedinOrName("", companyName);
  if (!company) {
    company = await createCompany({
      name: companyName,
      lifecycleStage: lifecycle ?? undefined,
      planTier: pkg ?? undefined,
    });
  } else {
    // Reuse the existing account; only fill blanks, never overwrite.
    const patch: CompanyInput = {};
    if (pkg && !company.planTier) patch.planTier = pkg;
    if (lifecycle && !company.lifecycleStage) patch.lifecycleStage = lifecycle;
    if (Object.keys(patch).length) company = await updateCompany(company.id, patch);
  }

  let contact: Contact | null = null;
  const name = (input.name || "").trim();
  if (name) {
    contact = await createContact({
      name,
      email: text(input.email) ?? undefined,
      phone: text(input.phone) ?? undefined,
      companyId: company.id,
    });
  }
  return { company, contact };
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

export interface StartOnboardingResult {
  clientId: string;
  alreadyStarted: boolean;
}

/**
 * Hand a won account off to tg-onboarding: create the client + kick off their
 * journey there, then flip this company to Customer with a starter care cadence
 * and record the onboarding client id so it can't be handed off twice.
 *
 * We call the onboarding tool's endpoint (server-to-server, shared secret) so it
 * owns creating the client and stamping the journey — the CRM never writes into
 * the onboarding base directly.
 */
export async function startOnboarding(
  companyId: string,
  opts: { contactId?: string; plan?: string; startDate?: string; accountManager?: string } = {},
): Promise<StartOnboardingResult> {
  const company = await getCompany(companyId);
  if (company.onboardingClientId) {
    return { clientId: company.onboardingClientId, alreadyStarted: true };
  }

  const base = process.env.NEXT_PUBLIC_ONBOARDING_URL;
  const secret = process.env.CRM_HANDOFF_SECRET;
  if (!base || !secret) {
    throw new ValidationError(
      "Onboarding isn't linked yet. Set NEXT_PUBLIC_ONBOARDING_URL and CRM_HANDOFF_SECRET in Vercel.",
    );
  }

  // Who to onboard: the chosen contact, else the first with an email.
  const contacts = await listContactsByIds(company.contactIds);
  const contact = opts.contactId
    ? (contacts.find((c) => c.id === opts.contactId) ?? (await getContact(opts.contactId).catch(() => null)))
    : contacts.find((c) => c.email);
  if (!contact || !contact.email) {
    throw new ValidationError("Add a contact with an email address before starting onboarding.");
  }

  const plan = (opts.plan || company.planTier || "").trim();
  if (!(PACKAGES as readonly string[]).includes(plan)) {
    throw new ValidationError("Set a package (Spark, Boost, Ignite or Bespoke) before starting onboarding.");
  }

  const startDate =
    opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)
      ? opts.startDate
      : new Date().toISOString().slice(0, 10);
  const accountManager = opts.accountManager?.trim() || "Andy Speight";

  const res = await fetch(`${base.replace(/\/+$/, "")}/api/integrations/crm-handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      company: company.name,
      contactName: contact.name,
      contactEmail: contact.email,
      plan,
      accountManager,
      startDate,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[startOnboarding] onboarding responded", res.status, detail.slice(0, 200));
    throw new Error("The onboarding tool couldn't start this client. Please try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { clientId?: string };
  const clientId = data.clientId;
  if (!clientId) throw new Error("The onboarding tool didn't return a client id.");

  const F = FIELDS.companies;
  await updateRecord(AIRTABLE_BASE_ID, TABLES.companies, companyId, {
    [F.onboardingClientId]: clientId,
    [F.onboardingStarted]: new Date().toISOString(),
    [F.lifecycleStage]: "Customer",
    ...(company.careCadence ? {} : { [F.careCadence]: "Quarterly" }),
  });

  await createActivity({
    type: "Note",
    summary: "Onboarding started",
    rawContent: `Handed off to the onboarding tool on the ${plan} plan for ${contact.name}.`,
    companyId,
    contactId: contact.id,
    date: new Date().toISOString(),
  }).catch((e) => console.error("[startOnboarding] activity log failed:", e));

  return { clientId, alreadyStarted: false };
}

// --- tidy: dedupe + junk cleanup (Wave 2) ----------------------------------

export interface DupCompany {
  id: string;
  name: string;
  website?: string;
  linkedin?: string;
  lifecycleStage?: string;
  mrr?: number;
  country?: string;
  contacts: number;
  deals: number;
  activities: number;
  createdTime?: string;
}
export interface DupContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  createdTime?: string;
}
export interface DupGroup<T> {
  reason: string;
  /** The record the app suggests keeping (richest / oldest). */
  primaryId: string;
  records: T[];
}
export interface JunkRecord {
  id: string;
  name: string;
  reason: string;
}
export interface CleanupPlan {
  duplicateCompanies: DupGroup<DupCompany>[];
  duplicateContacts: DupGroup<DupContact>[];
  junkCompanies: JunkRecord[];
  junkContacts: JunkRecord[];
}

/** Normalise a LinkedIn (or any) URL into a stable identity key. */
function urlKey(url?: string): string {
  const u = (url || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  return u.length >= 6 ? u : "";
}

/** Union-find grouping: any two items sharing a signature land in one group. */
function groupBySignatures<T>(items: T[], sig: (t: T) => string[]): T[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const firstSeen = new Map<string, number>();
  items.forEach((it, i) => {
    for (const s of sig(it)) {
      if (!s) continue;
      const prev = firstSeen.get(s);
      if (prev === undefined) firstSeen.set(s, i);
      else union(prev, i);
    }
  });
  const groups = new Map<number, T[]>();
  items.forEach((it, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(it);
    else groups.set(root, [it]);
  });
  return [...groups.values()].filter((g) => g.length >= 2);
}

function companySigs(c: Company): string[] {
  const out: string[] = [];
  const nk = nameKey(c.name);
  if (nk.length >= 3) out.push(`n:${nk}`);
  if (c.website) {
    const b = hostBrand(c.website);
    if (b.length >= 3) out.push(`w:${b}`);
  }
  const li = urlKey(c.linkedin);
  if (li) out.push(`l:${li}`);
  return out;
}
function contactSigs(c: Contact): string[] {
  const out: string[] = [];
  const email = (c.email || "").toLowerCase().trim();
  if (email.includes("@")) out.push(`e:${email}`);
  const li = urlKey(c.linkedin);
  if (li) out.push(`l:${li}`);
  const nk = nameKey(c.name);
  if (nk.length >= 4 && c.companyId) out.push(`nc:${nk}:${c.companyId}`);
  return out;
}

function companyScore(c: Company): number {
  let s =
    c.contactIds.length * 3 +
    c.dealIds.length * 3 +
    c.activityIds.length * 2 +
    c.taskIds.length;
  for (const v of [
    c.website,
    c.type,
    c.country,
    c.linkedin,
    c.description,
    c.mrr,
    c.accountHealth,
    c.careCadence,
    c.planTier,
  ]) {
    if (v != null && v !== "") s += 1;
  }
  if (c.lifecycleStage && CUSTOMER_LIFECYCLES.has(c.lifecycleStage)) s += 5;
  return s;
}
function contactScore(c: Contact): number {
  let s = 0;
  for (const v of [c.email, c.phone, c.linkedin, c.role, c.notes, c.headline, c.location]) {
    if (v) s += 1;
  }
  if (c.companyId) s += 3;
  return s;
}

function companyReason(recs: Company[]): string {
  const nk = recs.map((c) => nameKey(c.name));
  if (nk.every((k) => k && k === nk[0])) return "Same name";
  const wb = recs.map((c) => (c.website ? hostBrand(c.website) : ""));
  if (wb.every((b) => b && b === wb[0])) return "Same website";
  const li = recs.map((c) => urlKey(c.linkedin));
  if (li.every((k) => k && k === li[0])) return "Same LinkedIn";
  return "Likely the same";
}
function contactReason(recs: Contact[]): string {
  const em = recs.map((c) => (c.email || "").toLowerCase().trim());
  if (em.every((e) => e && e === em[0])) return "Same email";
  const li = recs.map((c) => urlKey(c.linkedin));
  if (li.every((k) => k && k === li[0])) return "Same LinkedIn";
  return "Same name at company";
}

function toDupCompany(c: Company): DupCompany {
  return {
    id: c.id,
    name: c.name,
    website: c.website,
    linkedin: c.linkedin,
    lifecycleStage: c.lifecycleStage,
    mrr: c.mrr,
    country: c.country,
    contacts: c.contactIds.length,
    deals: c.dealIds.length,
    activities: c.activityIds.length,
    createdTime: c.createdTime,
  };
}
function toDupContact(c: Contact): DupContact {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    linkedin: c.linkedin,
    role: c.role,
    companyId: c.companyId,
    companyName: c.companyName,
    createdTime: c.createdTime,
  };
}

/**
 * Find likely-duplicate companies and people, plus junk/orphan records — all as a
 * preview. Nothing is changed here; the UI shows this and the human confirms every
 * merge or deletion (brief zero-admin bias, but never a silent edit).
 */
export async function planCleanup(): Promise<CleanupPlan> {
  const [companies, contacts] = await Promise.all([listCompanies(), listContacts()]);

  const olderFirst = (a: { createdTime?: string }, b: { createdTime?: string }) =>
    (a.createdTime || "").localeCompare(b.createdTime || "");

  const duplicateCompanies: DupGroup<DupCompany>[] = groupBySignatures(companies, companySigs)
    .map((recs) => {
      const ranked = [...recs].sort((a, b) => companyScore(b) - companyScore(a) || olderFirst(a, b));
      return {
        reason: companyReason(recs),
        primaryId: ranked[0].id,
        records: ranked.map(toDupCompany),
      };
    })
    .sort((a, b) => b.records.length - a.records.length);

  const duplicateContacts: DupGroup<DupContact>[] = groupBySignatures(contacts, contactSigs)
    .map((recs) => {
      const ranked = [...recs].sort((a, b) => contactScore(b) - contactScore(a) || olderFirst(a, b));
      return {
        reason: contactReason(recs),
        primaryId: ranked[0].id,
        records: ranked.map(toDupContact),
      };
    })
    .sort((a, b) => b.records.length - a.records.length);

  const junkCompanies: JunkRecord[] = companies
    .filter((c) => nameKey(c.name) === "")
    .map((c) => ({ id: c.id, name: c.name || "(no name)", reason: "No name" }));

  const junkContacts: JunkRecord[] = contacts
    .filter((c) => !c.companyId && !c.email && !c.phone && !c.linkedin)
    .map((c) => ({ id: c.id, name: c.name || "(no name)", reason: "No company, email or phone" }));

  return { duplicateCompanies, duplicateContacts, junkCompanies, junkContacts };
}

/** Re-point a set of child records at a new company (linked-record field). */
async function relinkToCompany(
  tableId: string,
  companyField: string,
  ids: string[],
  companyId: string,
): Promise<number> {
  const records = [...new Set(ids)]
    .filter(Boolean)
    .map((id) => ({ id, fields: { [companyField]: [companyId] } }));
  if (records.length === 0) return 0;
  const updated = await updateRecords(AIRTABLE_BASE_ID, tableId, records);
  return updated.length;
}

/** Fill only the primary's blank fields from the secondaries — never overwrite. */
function fillCompanyBlanks(primary: Company, secondaries: Company[]): CompanyInput {
  const keys: (keyof CompanyInput)[] = [
    "website",
    "type",
    "country",
    "region",
    "linkedin",
    "socials",
    "lifecycleStage",
    "planTier",
    "mrr",
    "goLiveDate",
    "renewalDate",
    "accountHealth",
    "careCadence",
    "productsUsed",
    "description",
    "sizeBand",
  ];
  const patch: CompanyInput = {};
  for (const k of keys) {
    const cur = primary[k as keyof Company];
    if (cur != null && cur !== "") continue;
    for (const s of secondaries) {
      const v = s[k as keyof Company];
      if (v != null && v !== "") {
        (patch as Record<string, unknown>)[k] = v;
        break;
      }
    }
  }
  return patch;
}

function fillContactBlanks(primary: Contact, secondaries: Contact[]): ContactInput {
  const keys: (keyof ContactInput)[] = [
    "role",
    "email",
    "phone",
    "linkedin",
    "marketingOptIn",
    "notes",
    "headline",
    "location",
    "companyId",
  ];
  const patch: ContactInput = {};
  for (const k of keys) {
    const cur = primary[k as keyof Contact];
    if (cur != null && cur !== "") continue;
    for (const s of secondaries) {
      const v = s[k as keyof Contact];
      if (v != null && v !== "") {
        (patch as Record<string, unknown>)[k] = v;
        break;
      }
    }
  }
  return patch;
}

/**
 * Merge duplicate companies into one. The primary is kept; every secondary's
 * contacts, deals, activities, tasks and care touches are re-pointed at the
 * primary, the primary's blank fields are filled from the secondaries, then the
 * secondaries are deleted. Returns how many child records moved.
 */
export async function mergeCompanies(
  primaryId: string,
  secondaryIds: string[],
): Promise<{ moved: number; merged: number }> {
  const secondaries = [...new Set(secondaryIds)].filter((id) => id && id !== primaryId);
  if (secondaries.length === 0) return { moved: 0, merged: 0 };

  const primary = await getCompany(primaryId);
  const secCompanies: Company[] = [];
  for (const id of secondaries) secCompanies.push(await getCompany(id));

  const contactIds = new Set<string>();
  const dealIds = new Set<string>();
  const activityIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const s of secCompanies) {
    s.contactIds.forEach((x) => contactIds.add(x));
    s.dealIds.forEach((x) => dealIds.add(x));
    s.activityIds.forEach((x) => activityIds.add(x));
    s.taskIds.forEach((x) => taskIds.add(x));
  }

  let moved = 0;
  moved += await relinkToCompany(TABLES.contacts, FIELDS.contacts.company, [...contactIds], primaryId);
  moved += await relinkToCompany(TABLES.deals, FIELDS.deals.company, [...dealIds], primaryId);
  moved += await relinkToCompany(TABLES.activities, FIELDS.activities.company, [...activityIds], primaryId);
  moved += await relinkToCompany(TABLES.tasks, FIELDS.tasks.company, [...taskIds], primaryId);

  // Care touches link to a company but aren't in the reverse-link set — scan + move.
  const secSet = new Set(secondaries);
  const careRecs = await listRecords(AIRTABLE_BASE_ID, TABLES.careTouches, {
    fields: [FIELDS.careTouches.company],
    maxRecords: 5000,
  });
  const careMove = careRecs
    .filter((r) => secSet.has(firstId(r.fields[FIELDS.careTouches.company]) ?? ""))
    .map((r) => r.id);
  moved += await relinkToCompany(TABLES.careTouches, FIELDS.careTouches.company, careMove, primaryId);

  const patch = fillCompanyBlanks(primary, secCompanies);
  if (Object.keys(patch).length) await updateCompany(primaryId, patch);

  await deleteRecords(AIRTABLE_BASE_ID, TABLES.companies, secondaries);
  return { moved, merged: secondaries.length };
}

/**
 * Merge duplicate people into one. The primary is kept; each secondary's linked
 * activities are re-pointed at the primary, blank fields are filled from the
 * secondaries, then the secondaries are deleted.
 */
export async function mergeContacts(
  primaryId: string,
  secondaryIds: string[],
): Promise<{ moved: number; merged: number }> {
  const secondaries = [...new Set(secondaryIds)].filter((id) => id && id !== primaryId);
  if (secondaries.length === 0) return { moved: 0, merged: 0 };

  const primary = await getContact(primaryId);
  const secContacts: Contact[] = [];
  for (const id of secondaries) secContacts.push(await getContact(id));

  const secSet = new Set(secondaries);
  // Repoint every record that links to a secondary contact onto the primary, so
  // no history is lost — timeline, sequence enrollments, email opens, signals.
  const linked: { table: string; field: string }[] = [
    { table: TABLES.activities, field: FIELDS.activities.contact },
    { table: TABLES.sequenceEnrollments, field: FIELDS.sequenceEnrollments.contact },
    { table: TABLES.emailTracking, field: FIELDS.emailTracking.contact },
    { table: TABLES.signals, field: FIELDS.signals.contact },
  ];
  let moved = 0;
  for (const { table, field } of linked) {
    const recs = await listRecords(AIRTABLE_BASE_ID, table, { fields: [field], maxRecords: 5000 });
    const updates = recs
      .filter((r) => secSet.has(firstId(r.fields[field]) ?? ""))
      .map((r) => ({ id: r.id, fields: { [field]: [primaryId] } }));
    if (updates.length) moved += (await updateRecords(AIRTABLE_BASE_ID, table, updates)).length;
  }

  // Fill blanks from the secondaries, then fold their email addresses into the
  // primary's Alternate Emails so the same person's other addresses aren't lost.
  const patch = fillContactBlanks(primary, secContacts);
  const emails = new Set<string>((primary.alternateEmails ?? []).map((e) => e.trim()).filter(Boolean));
  for (const s of secContacts) {
    if (s.email) emails.add(s.email.trim());
    (s.alternateEmails ?? []).forEach((e) => e.trim() && emails.add(e.trim()));
  }
  const primaryEmail = ((patch.email as string) || primary.email || "").trim();
  if (primaryEmail) emails.delete(primaryEmail);
  patch.alternateEmails = [...emails];
  await updateContact(primaryId, patch);

  await deleteRecords(AIRTABLE_BASE_ID, TABLES.contacts, secondaries);
  return { moved, merged: secondaries.length };
}

/** Bulk-delete junk companies (their child links simply clear on delete). */
export async function deleteCompanies(ids: string[]): Promise<number> {
  return deleteRecords(AIRTABLE_BASE_ID, TABLES.companies, ids);
}
/** Bulk-delete junk contacts. */
export async function deleteContacts(ids: string[]): Promise<number> {
  return deleteRecords(AIRTABLE_BASE_ID, TABLES.contacts, ids);
}

// --- email templates --------------------------------------------------------

function toEmailAttachments(v: unknown): EmailAttachment[] {
  if (!Array.isArray(v)) return [];
  return v.map((a): EmailAttachment => {
    const o = a as Record<string, unknown>;
    return {
      id: str(o.id),
      url: str(o.url),
      filename: str(o.filename) ?? "attachment",
      size: numv(o.size),
      type: str(o.type),
    };
  });
}

function toEmailTemplate(rec: AirtableRecord): EmailTemplate {
  const f = rec.fields;
  const F = FIELDS.emailTemplates;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    subject: str(f[F.subject]),
    body: str(f[F.body]),
    description: str(f[F.description]),
    attachments: toEmailAttachments(f[F.attachments]),
    createdTime: rec.createdTime,
  };
}

function buildEmailTemplateFields(input: EmailTemplateInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.emailTemplates;
  const f: Record<string, unknown> = {};
  const has = (k: keyof EmailTemplateInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Name");
  if (has("subject")) f[F.subject] = text(input.subject);
  if (has("body")) f[F.body] = text(input.body);
  if (has("description")) f[F.description] = text(input.description);
  return f;
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const F = FIELDS.emailTemplates;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.emailTemplates, {
    sort: [{ field: F.name, direction: "asc" }],
  });
  return records.map(toEmailTemplate);
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  return toEmailTemplate(await getRecord(AIRTABLE_BASE_ID, TABLES.emailTemplates, id));
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  const fields = buildEmailTemplateFields(input, false);
  return toEmailTemplate(await createRecord(AIRTABLE_BASE_ID, TABLES.emailTemplates, fields));
}

export async function updateEmailTemplate(id: string, input: EmailTemplateInput): Promise<EmailTemplate> {
  const fields = buildEmailTemplateFields(input, true);
  return toEmailTemplate(await updateRecord(AIRTABLE_BASE_ID, TABLES.emailTemplates, id, fields));
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.emailTemplates, id);
}

export async function addTemplateAttachment(
  id: string,
  file: { filename: string; contentType: string; base64: string },
): Promise<EmailTemplate> {
  await uploadAttachment(AIRTABLE_BASE_ID, id, FIELDS.emailTemplates.attachments, file);
  return getEmailTemplate(id);
}

export async function removeTemplateAttachment(id: string, attachmentId: string): Promise<EmailTemplate> {
  const current = await getEmailTemplate(id);
  // Re-patch the field with only the attachments we're keeping (by id); the one
  // we drop simply isn't in the list any more.
  const keep = current.attachments
    .filter((a) => a.id && a.id !== attachmentId)
    .map((a) => ({ id: a.id as string }));
  await updateRecord(AIRTABLE_BASE_ID, TABLES.emailTemplates, id, {
    [FIELDS.emailTemplates.attachments]: keep,
  });
  return getEmailTemplate(id);
}

// --- Email sequences (Phase 3) ----------------------------------------------

/** Parse the Steps JSON blob into a clean, validated step list. */
function parseSteps(v: unknown): SequenceStep[] {
  if (typeof v !== "string" || !v.trim()) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(v);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s): SequenceStep | null => {
      const o = s as Record<string, unknown>;
      const templateId = typeof o.templateId === "string" ? o.templateId : "";
      if (!templateId) return null;
      const delay = Number(o.delayDays);
      return { templateId, delayDays: Number.isFinite(delay) && delay > 0 ? Math.floor(delay) : 0 };
    })
    .filter((s): s is SequenceStep => s !== null);
}

/** Validate an incoming step list (from the builder) before we store it. */
function cleanSteps(v: unknown): SequenceStep[] {
  if (!Array.isArray(v)) return [];
  const out: SequenceStep[] = [];
  for (const s of v) {
    const o = (s ?? {}) as Record<string, unknown>;
    const templateId = text(o.templateId);
    if (!templateId) continue;
    const delay = Number(o.delayDays);
    out.push({ templateId, delayDays: Number.isFinite(delay) && delay > 0 ? Math.floor(delay) : 0 });
  }
  return out;
}

function toSequence(rec: AirtableRecord): Sequence {
  const f = rec.fields;
  const F = FIELDS.sequences;
  return {
    id: rec.id,
    name: str(f[F.name]) ?? "",
    description: str(f[F.description]),
    status: (str(f[F.status]) as Sequence["status"]) ?? "Draft",
    steps: parseSteps(f[F.steps]),
    createdTime: rec.createdTime,
  };
}

function buildSequenceFields(input: SequenceInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.sequences;
  const f: Record<string, unknown> = {};
  const has = (k: keyof SequenceInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (!partial || has("name")) f[F.name] = requiredText(input.name, "Name");
  if (has("description")) f[F.description] = text(input.description);
  if (has("status")) f[F.status] = enumOrNull(input.status, SEQUENCE_STATUSES, "status");
  if (has("steps")) f[F.steps] = JSON.stringify(cleanSteps(input.steps));
  return f;
}

export async function listSequences(): Promise<Sequence[]> {
  const F = FIELDS.sequences;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.sequences, {
    sort: [{ field: F.name, direction: "asc" }],
  });
  return records.map(toSequence);
}

export async function getSequence(id: string): Promise<Sequence> {
  return toSequence(await getRecord(AIRTABLE_BASE_ID, TABLES.sequences, id));
}

export async function createSequence(input: SequenceInput): Promise<Sequence> {
  const F = FIELDS.sequences;
  const fields = buildSequenceFields(input, false);
  if (fields[F.status] == null) fields[F.status] = "Draft";
  if (fields[F.steps] == null) fields[F.steps] = "[]";
  return toSequence(await createRecord(AIRTABLE_BASE_ID, TABLES.sequences, fields));
}

export async function updateSequence(id: string, input: SequenceInput): Promise<Sequence> {
  const fields = buildSequenceFields(input, true);
  return toSequence(await updateRecord(AIRTABLE_BASE_ID, TABLES.sequences, id, fields));
}

export async function deleteSequence(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.sequences, id);
}

// --- enrollments ------------------------------------------------------------

function toEnrollment(rec: AirtableRecord): SequenceEnrollment {
  const f = rec.fields;
  const F = FIELDS.sequenceEnrollments;
  return {
    id: rec.id,
    sequenceId: firstId(f[F.sequence]),
    contactId: firstId(f[F.contact]),
    status: (str(f[F.status]) as SequenceEnrollment["status"]) ?? "Active",
    stepIndex: numv(f[F.stepIndex]) ?? 0,
    nextSendAt: str(f[F.nextSendAt]),
    threadId: str(f[F.threadId]),
    threadSubject: str(f[F.threadSubject]),
    lastMessageId: str(f[F.lastMessageId]),
    companyId: str(f[F.companyId]),
    lastError: str(f[F.lastError]),
    enrolledAt: str(f[F.enrolledAt]),
    completedAt: str(f[F.completedAt]),
    createdTime: rec.createdTime,
  };
}

function buildEnrollmentFields(input: EnrollmentInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.sequenceEnrollments;
  const f: Record<string, unknown> = {};
  const has = (k: keyof EnrollmentInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (has("sequenceId")) {
    const id = text(input.sequenceId);
    f[F.sequence] = id ? [id] : [];
  }
  if (has("contactId")) {
    const id = text(input.contactId);
    f[F.contact] = id ? [id] : [];
  }
  if (has("status")) f[F.status] = enumOrNull(input.status, ENROLLMENT_STATUSES, "status");
  if (has("stepIndex")) f[F.stepIndex] = input.stepIndex ?? 0;
  if (has("nextSendAt")) f[F.nextSendAt] = text(input.nextSendAt);
  if (has("threadId")) f[F.threadId] = text(input.threadId);
  if (has("threadSubject")) f[F.threadSubject] = text(input.threadSubject);
  if (has("lastMessageId")) f[F.lastMessageId] = text(input.lastMessageId);
  if (has("companyId")) f[F.companyId] = text(input.companyId);
  if (has("lastError")) f[F.lastError] = text(input.lastError);
  if (has("enrolledAt")) f[F.enrolledAt] = text(input.enrolledAt);
  if (has("completedAt")) f[F.completedAt] = text(input.completedAt);
  return f;
}

/** Fill sequenceName + contactName/email on a set of enrollments (for list views). */
async function attachEnrollmentJoins(enrollments: SequenceEnrollment[]): Promise<void> {
  if (enrollments.length === 0) return;
  const [contactRecs, sequenceRecs] = await Promise.all([
    recordsByIds(TABLES.contacts, enrollments.map((e) => e.contactId || "")),
    recordsByIds(TABLES.sequences, enrollments.map((e) => e.sequenceId || "")),
  ]);
  const cF = FIELDS.contacts;
  const contacts = new Map(
    contactRecs.map((r) => [r.id, { name: str(r.fields[cF.name]) ?? "", email: str(r.fields[cF.email]) }]),
  );
  const seqNames = new Map(sequenceRecs.map((r) => [r.id, str(r.fields[FIELDS.sequences.name]) ?? ""]));
  for (const e of enrollments) {
    const c = e.contactId ? contacts.get(e.contactId) : undefined;
    e.contactName = c?.name;
    e.contactEmail = c?.email;
    e.sequenceName = e.sequenceId ? seqNames.get(e.sequenceId) : undefined;
  }
}

/** Every enrollment (optionally for one sequence), newest first, with joins. */
export async function listEnrollments(sequenceId?: string): Promise<SequenceEnrollment[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, { maxRecords: 5000 });
  let rows = records.map(toEnrollment);
  if (sequenceId) rows = rows.filter((e) => e.sequenceId === sequenceId);
  rows.sort((a, b) => (b.createdTime || "").localeCompare(a.createdTime || ""));
  await attachEnrollmentJoins(rows);
  return rows;
}

/** Active enrollments whose next step is due on or before `nowIso` (engine). */
export async function listDueEnrollments(nowIso: string): Promise<SequenceEnrollment[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, { maxRecords: 5000 });
  return records
    .map(toEnrollment)
    .filter((e) => e.status === "Active" && !!e.nextSendAt && e.nextSendAt <= nowIso)
    .sort((a, b) => (a.nextSendAt || "").localeCompare(b.nextSendAt || ""));
}

export async function getEnrollment(id: string): Promise<SequenceEnrollment> {
  return toEnrollment(await getRecord(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, id));
}

export async function createEnrollmentRecord(fields: EnrollmentInput & { label?: string }): Promise<SequenceEnrollment> {
  const built = buildEnrollmentFields(fields, false);
  if (fields.label) built[FIELDS.sequenceEnrollments.label] = text(fields.label);
  return toEnrollment(await createRecord(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, built));
}

export async function updateEnrollment(id: string, input: EnrollmentInput): Promise<SequenceEnrollment> {
  const fields = buildEnrollmentFields(input, true);
  return toEnrollment(await updateRecord(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, id, fields));
}

export async function deleteEnrollment(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_BASE_ID, TABLES.sequenceEnrollments, id);
}

/** True if this contact already has a live (Active/Paused) enrollment in this sequence. */
export async function hasLiveEnrollment(sequenceId: string, contactId: string): Promise<boolean> {
  const rows = await listEnrollments(sequenceId);
  return rows.some(
    (e) => e.contactId === contactId && (e.status === "Active" || e.status === "Paused"),
  );
}

// --- Today "Needs you" snooze -----------------------------------------------

const SNOOZE_KEY = "today_snoozed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

async function readSnoozeMap(): Promise<Record<string, string>> {
  const raw = await getSetting(SNOOZE_KEY);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Action keys currently snoozed (expired ones dropped). */
export async function getSnoozedActionKeys(): Promise<string[]> {
  const map = await readSnoozeMap();
  const now = new Date().toISOString();
  return Object.entries(map)
    .filter(([, until]) => until > now)
    .map(([key]) => key);
}

/** Snooze one "Needs you today" item for 7 days; prunes expired entries. */
export async function snoozeAction(key: string): Promise<void> {
  const clean = key.trim();
  if (!clean) return;
  const map = await readSnoozeMap();
  const now = Date.now();
  const next: Record<string, string> = {};
  for (const [k, until] of Object.entries(map)) {
    if (Date.parse(until) > now) next[k] = until; // keep still-active snoozes
  }
  next[clean] = new Date(now + SNOOZE_MS).toISOString();
  await setSetting(SNOOZE_KEY, JSON.stringify(next));
}

// --- Today sequences feed (replies to follow up / failed) -------------------

const SEQ_FEED_KEY = "today_seq_dismissed";
const SEQ_FEED_PRUNE_MS = 45 * 24 * 60 * 60 * 1000;
// Only surface replies from the recent past so the feed doesn't grow forever.
const REPLY_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

async function readSeqFeedMap(): Promise<Record<string, string>> {
  const raw = await getSetting(SEQ_FEED_KEY);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Enrollments that need the human: replies to follow up, and failed sends. */
export async function listSequenceFeed(): Promise<{
  replied: SequenceEnrollment[];
  failed: SequenceEnrollment[];
}> {
  const [rows, dismissedMap] = await Promise.all([listEnrollments(), readSeqFeedMap()]);
  const drop = new Set(Object.keys(dismissedMap));
  const cutoff = new Date(Date.now() - REPLY_WINDOW_MS).toISOString();
  const stamp = (e: SequenceEnrollment) => e.completedAt || e.createdTime || "";
  const replied = rows
    .filter((e) => e.status === "Replied" && !drop.has(e.id) && stamp(e) >= cutoff)
    .sort((a, b) => stamp(b).localeCompare(stamp(a)));
  const failed = rows
    .filter((e) => e.status === "Failed" && !drop.has(e.id))
    .sort((a, b) => (b.createdTime || "").localeCompare(a.createdTime || ""));
  return { replied, failed };
}

/** Hide one enrollment from the Today sequences feed; prunes old entries. */
export async function dismissSequenceFeedItem(id: string): Promise<void> {
  const clean = id.trim();
  if (!clean) return;
  const map = await readSeqFeedMap();
  const now = Date.now();
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (Date.parse(v) > now - SEQ_FEED_PRUNE_MS) next[k] = v;
  }
  next[clean] = new Date(now).toISOString();
  await setSetting(SEQ_FEED_KEY, JSON.stringify(next));
}

// --- Signals (intel monitoring) ---------------------------------------------

function toSignal(rec: AirtableRecord): Signal {
  const f = rec.fields;
  const F = FIELDS.signals;
  return {
    id: rec.id,
    headline: str(f[F.headline]) ?? "",
    type: str(f[F.type]) as Signal["type"],
    url: str(f[F.url]),
    dateFound: str(f[F.dateFound]),
    relevanceScore: numv(f[F.relevanceScore]),
    status: (str(f[F.status]) as Signal["status"]) ?? "New",
    companyId: firstId(f[F.company]),
    contactId: firstId(f[F.contact]),
    createdTime: rec.createdTime,
  };
}

function buildSignalFields(input: SignalInput, partial: boolean): Record<string, unknown> {
  const F = FIELDS.signals;
  const f: Record<string, unknown> = {};
  const has = (k: keyof SignalInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (!partial || has("headline")) f[F.headline] = requiredText(input.headline, "Headline");
  if (has("type")) f[F.type] = enumOrNull(input.type, SIGNAL_TYPES, "signal type");
  if (has("url")) f[F.url] = text(input.url);
  if (has("dateFound")) f[F.dateFound] = text(input.dateFound);
  if (has("relevanceScore")) f[F.relevanceScore] = numberOrNull(input.relevanceScore);
  if (has("status")) f[F.status] = enumOrNull(input.status, SIGNAL_STATUSES, "status");
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  if (has("contactId")) {
    const id = text(input.contactId);
    f[F.contact] = id ? [id] : [];
  }
  return f;
}

export async function createSignal(input: SignalInput): Promise<Signal> {
  const F = FIELDS.signals;
  const fields = buildSignalFields(input, false);
  if (fields[F.status] == null) fields[F.status] = "New";
  if (fields[F.dateFound] == null) fields[F.dateFound] = new Date().toISOString();
  return toSignal(await createRecord(AIRTABLE_BASE_ID, TABLES.signals, fields));
}

export async function getSignal(id: string): Promise<Signal> {
  return toSignal(await getRecord(AIRTABLE_BASE_ID, TABLES.signals, id));
}

/** Host an ad-hoc email attachment on a tracking row so its downloads can be tracked. */
export async function uploadTrackingFile(
  id: string,
  file: { filename: string; contentType: string; base64: string },
): Promise<EmailTracking> {
  const rec = await uploadAttachment(AIRTABLE_BASE_ID, id, FIELDS.emailTracking.file, file);
  return toTracking(rec);
}

/** All signals for one company, newest first. */
export async function listSignalsByCompany(companyId: string): Promise<Signal[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.signals, { maxRecords: 2000 });
  return records
    .map(toSignal)
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => (b.dateFound || b.createdTime || "").localeCompare(a.dateFound || a.createdTime || ""));
}

/** The URLs already captured for a company — used to avoid duplicate signals. */
export async function existingSignalUrls(companyId: string): Promise<Set<string>> {
  const signals = await listSignalsByCompany(companyId);
  return new Set(signals.map((s) => (s.url || "").trim().toLowerCase()).filter(Boolean));
}

/** Recent signals across the base, optionally filtered by status, newest first. */
export async function listRecentSignals(opts?: { status?: string; limit?: number }): Promise<Signal[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.signals, { maxRecords: 5000 });
  let rows = records.map(toSignal);
  if (opts?.status) rows = rows.filter((s) => s.status === opts.status);
  rows.sort((a, b) => (b.dateFound || b.createdTime || "").localeCompare(a.dateFound || a.createdTime || ""));
  const limited = opts?.limit ? rows.slice(0, opts.limit) : rows;
  await attachSignalCompanyNames(limited);
  return limited;
}

async function attachSignalCompanyNames(signals: Signal[]): Promise<void> {
  const ids = signals.map((s) => s.companyId || "").filter(Boolean);
  if (ids.length === 0) return;
  const names = await companyNameMap(ids);
  for (const s of signals) if (s.companyId) s.companyName = names.get(s.companyId);
}

export async function updateSignalStatus(id: string, status: string): Promise<Signal> {
  const fields = buildSignalFields({ status: status as Signal["status"] }, true);
  return toSignal(await updateRecord(AIRTABLE_BASE_ID, TABLES.signals, id, fields));
}

// --- intel scan pickers (round-robin over the whole base, bounded per run) ---

/** Companies with a name, least-recently signal-checked first (never-checked lead). */
export async function companiesForSignalScan(limit: number): Promise<Company[]> {
  const companies = await listCompanies();
  return companies
    .filter((c) => c.name)
    .sort((a, b) => (a.signalsCheckedAt || "").localeCompare(b.signalsCheckedAt || ""))
    .slice(0, Math.max(0, limit));
}

/** Companies that have a LinkedIn URL but haven't been enriched yet. */
export async function companiesForBackfill(limit: number): Promise<Company[]> {
  const companies = await listCompanies();
  return companies
    .filter((c) => c.linkedin && !c.enrichedAt)
    .slice(0, Math.max(0, limit));
}

// --- email open/download tracking -------------------------------------------

function toTracking(rec: AirtableRecord): EmailTracking {
  const f = rec.fields;
  const F = FIELDS.emailTracking;
  return {
    id: rec.id,
    token: str(f[F.token]) ?? "",
    kind: (str(f[F.kind]) as EmailTracking["kind"]) ?? "Email",
    subject: str(f[F.subject]),
    filename: str(f[F.filename]),
    templateId: str(f[F.templateId]),
    attachIndex: numv(f[F.attachIndex]),
    recipient: str(f[F.recipient]),
    opens: numv(f[F.opens]) ?? 0,
    firstOpened: str(f[F.firstOpened]),
    lastOpened: str(f[F.lastOpened]),
    sentAt: str(f[F.sentAt]),
    userAgent: str(f[F.userAgent]),
    companyId: firstId(f[F.company]),
    contactId: firstId(f[F.contact]),
    gmailMessageId: str(f[F.gmailMessageId]),
    fileUrl: firstAttachmentUrl(f[F.file]),
    createdTime: rec.createdTime,
  };
}

/** The current (signed) URL of the first attachment in an Airtable attachment cell. */
function firstAttachmentUrl(v: unknown): string | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const first = v[0] as Record<string, unknown>;
  return str(first?.url);
}

function buildTrackingFields(input: EmailTrackingInput): Record<string, unknown> {
  const F = FIELDS.emailTracking;
  const f: Record<string, unknown> = {};
  const has = (k: keyof EmailTrackingInput) => Object.prototype.hasOwnProperty.call(input, k);
  if (has("token")) f[F.token] = text(input.token);
  if (has("kind")) f[F.kind] = enumOrNull(input.kind, TRACKING_KINDS, "tracking kind");
  if (has("subject")) f[F.subject] = text(input.subject);
  if (has("filename")) f[F.filename] = text(input.filename);
  if (has("templateId")) f[F.templateId] = text(input.templateId);
  if (has("attachIndex")) f[F.attachIndex] = numberOrNull(input.attachIndex);
  if (has("recipient")) f[F.recipient] = text(input.recipient);
  if (has("opens")) f[F.opens] = numberOrNull(input.opens);
  if (has("firstOpened")) f[F.firstOpened] = text(input.firstOpened);
  if (has("lastOpened")) f[F.lastOpened] = text(input.lastOpened);
  if (has("sentAt")) f[F.sentAt] = text(input.sentAt);
  if (has("userAgent")) f[F.userAgent] = text(input.userAgent);
  if (has("companyId")) {
    const id = text(input.companyId);
    f[F.company] = id ? [id] : [];
  }
  if (has("contactId")) {
    const id = text(input.contactId);
    f[F.contact] = id ? [id] : [];
  }
  if (has("gmailMessageId")) f[F.gmailMessageId] = text(input.gmailMessageId);
  return f;
}

/** Stamp the sent Gmail message id onto a send's tracking rows (joins them to the timeline). */
export async function setTrackingMessageId(ids: string[], messageId: string): Promise<void> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0 || !messageId) return;
  const F = FIELDS.emailTracking;
  await updateRecords(
    AIRTABLE_BASE_ID,
    TABLES.emailTracking,
    unique.map((id) => ({ id, fields: { [F.gmailMessageId]: messageId } })),
  );
}

/** Open/download status per Gmail message id, for badging sent emails on the timeline. */
export async function trackingByMessageIds(messageIds: string[]): Promise<Record<string, EmailOpenStatus>> {
  const wanted = new Set(messageIds.filter(Boolean));
  if (wanted.size === 0) return {};
  const rows = await listTrackings();
  const out: Record<string, EmailOpenStatus> = {};
  for (const r of rows) {
    const mid = r.gmailMessageId || "";
    if (!wanted.has(mid)) continue;
    const s = (out[mid] ??= { opened: false, opens: 0, downloaded: false, downloads: 0 });
    if (r.kind === "Email") {
      s.opens += r.opens;
      if (r.opens > 0) s.opened = true;
    } else if (r.kind === "Attachment" && r.opens > 0) {
      s.downloaded = true;
      s.downloads += 1;
    }
    const last = r.lastOpened || "";
    if (last && (!s.lastOpenedAt || last > s.lastOpenedAt)) s.lastOpenedAt = last;
  }
  return out;
}

/** Create a tracking row for one artifact (an email pixel, or a tracked file link). */
export async function createTracking(input: EmailTrackingInput): Promise<EmailTracking> {
  const F = FIELDS.emailTracking;
  const fields = buildTrackingFields({ opens: 0, sentAt: new Date().toISOString(), ...input });
  if (fields[F.opens] == null) fields[F.opens] = 0;
  return toTracking(await createRecord(AIRTABLE_BASE_ID, TABLES.emailTracking, fields));
}

async function findTrackingByToken(token: string): Promise<EmailTracking | null> {
  const F = FIELDS.emailTracking;
  const safe = token.replace(/'/g, "");
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.emailTracking, {
    filterByFormula: `{${F.token}}='${safe}'`,
    maxRecords: 1,
  });
  return records.length ? toTracking(records[0]) : null;
}

/**
 * Record an open/download hit against a token. Increments the counter and stamps
 * first/last. Returns the row and whether this was the very first hit (so the
 * caller can raise a one-time "they're warm" alert on the timeline).
 */
export async function recordTrackingHit(
  token: string,
  userAgent?: string,
): Promise<{ row: EmailTracking; firstHit: boolean } | null> {
  const existing = await findTrackingByToken(token);
  if (!existing) return null;
  const now = new Date().toISOString();
  const firstHit = existing.opens === 0;
  const updated = await updateRecord(
    AIRTABLE_BASE_ID,
    TABLES.emailTracking,
    existing.id,
    buildTrackingFields({
      opens: existing.opens + 1,
      lastOpened: now,
      ...(firstHit ? { firstOpened: now } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 250) } : {}),
    }),
  );
  // Carry the hosted-file URL from the pre-update read, in case the PATCH
  // response omits the attachment field, so the download redirect still resolves.
  const row = toTracking(updated);
  if (!row.fileUrl && existing.fileUrl) row.fileUrl = existing.fileUrl;
  return { row, firstHit };
}

/** Tracked artifacts that have been opened at least once, most-recent first. */
export async function listRecentOpens(opts?: { sinceDays?: number; limit?: number }): Promise<EmailTracking[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.emailTracking, { maxRecords: 5000 });
  let rows = records.map(toTracking).filter((r) => r.opens > 0);
  if (opts?.sinceDays) {
    const cutoff = Date.now() - opts.sinceDays * 864e5;
    rows = rows.filter((r) => {
      const t = Date.parse(r.lastOpened || r.firstOpened || "");
      return Number.isNaN(t) ? true : t >= cutoff;
    });
  }
  rows.sort((a, b) => (b.lastOpened || "").localeCompare(a.lastOpened || ""));
  const limited = opts?.limit ? rows.slice(0, opts.limit) : rows;
  await attachTrackingNames(limited);
  return limited;
}

/**
 * Contacts whose most recent email was inbound — they wrote and we haven't
 * replied since. Grouped per contact (latest email wins), limited to recent
 * inbound so ancient one-sided threads pulled in by the backfill don't surface
 * as "needs a reply today". Longest-waiting first.
 */
export async function listAwaitingReply(opts?: { withinDays?: number; limit?: number }): Promise<AwaitingReply[]> {
  const withinDays = opts?.withinDays ?? 30;
  const limit = opts?.limit ?? 12;
  const [emails, contacts, dismissed] = await Promise.all([
    listEmailActivities(),
    listContacts({ limit: 5000 }),
    getDismissedReplyKeys(),
  ]);
  const dismissedSet = new Set(dismissed);
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // Latest email per contact (only emails we can attribute to a person + a date).
  const latest = new Map<string, Activity>();
  for (const e of emails) {
    if (!e.contactId || !e.date) continue;
    const cur = latest.get(e.contactId);
    if (!cur || e.date > (cur.date || "")) latest.set(e.contactId, e);
  }

  const cutoff = Date.now() - withinDays * 864e5;
  const rows = [...latest.values()]
    .filter((e) => e.direction === "Inbound" && Date.parse(e.date || "") >= cutoff)
    .filter((e) => !dismissedSet.has(`${e.contactId}:${e.date}`))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "")) // oldest unanswered first
    .slice(0, limit);

  // Resolve the company from the *contact* record (the email row's own company can
  // be stale/blank), so every row that can link to a timeline does.
  const companyIds = rows
    .map((e) => contactById.get(e.contactId!)?.companyId || e.companyId || "")
    .filter(Boolean);
  const companies = companyIds.length ? await companyNameMap(companyIds) : new Map<string, string>();

  return rows.map((e) => {
    const c = contactById.get(e.contactId!);
    const companyId = c?.companyId || e.companyId || undefined;
    return {
      key: `${e.contactId}:${e.date}`,
      contactId: e.contactId,
      contactName: c?.name || undefined,
      companyId,
      companyName: companyId ? companies.get(companyId) : undefined,
      subject: e.summary,
      date: e.date!,
      ageDays: Math.max(0, Math.floor((Date.now() - Date.parse(e.date!)) / 864e5)),
      gmailMessageId: e.gmailMessageId,
    };
  });
}

// --- Awaiting-reply dismissals (Ignore = permanent, Pause = back tomorrow) --

const REPLY_DISMISS_KEY = "reply_dismissed";

async function readReplyDismissMap(): Promise<Record<string, string>> {
  const raw = await getSetting(REPLY_DISMISS_KEY);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Reply keys still hidden (expired/past pauses dropped). */
export async function getDismissedReplyKeys(): Promise<string[]> {
  const map = await readReplyDismissMap();
  const now = new Date().toISOString();
  return Object.entries(map)
    .filter(([, until]) => until > now)
    .map(([key]) => key);
}

/**
 * Hide one awaiting-reply row. "pause" brings it back at the start of tomorrow;
 * "ignore" hides it effectively forever — but the key includes the message date,
 * so a *newer* email from the same person makes a fresh key and reappears.
 */
export async function dismissReply(key: string, mode: "ignore" | "pause"): Promise<void> {
  const clean = key.trim();
  if (!clean) return;
  const map = await readReplyDismissMap();
  const now = Date.now();
  const next: Record<string, string> = {};
  for (const [k, until] of Object.entries(map)) if (Date.parse(until) > now) next[k] = until;

  let until: number;
  if (mode === "pause") {
    const midnight = new Date(now);
    midnight.setUTCHours(0, 0, 0, 0);
    until = Math.max(midnight.getTime() + 864e5, now + 6 * 3600e3); // tomorrow 00:00, min +6h
  } else {
    until = now + 100 * 365 * 864e5; // ~a century = permanent in practice
  }
  next[clean] = new Date(until).toISOString();
  await setSetting(REPLY_DISMISS_KEY, JSON.stringify(next));
}

/** Email activities for one contact, newest first (for the contact email drawer). */
export async function listContactEmails(contactId: string, limit = 40): Promise<Activity[]> {
  if (!contactId) return [];
  const F = FIELDS.activities;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.activities, {
    filterByFormula: `{${F.type}}='Email'`,
    fields: [F.date, F.type, F.summary, F.rawContent, F.direction, F.gmailMessageId, F.company, F.contact],
    maxRecords: 5000,
  });
  return records
    .map(toActivity)
    .filter((a) => a.contactId === contactId)
    .sort((a, b) => (b.date || b.createdTime || "").localeCompare(a.date || a.createdTime || ""))
    .slice(0, limit);
}

/** All tracking rows (for the performance summary). */
export async function listTrackings(): Promise<EmailTracking[]> {
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.emailTracking, { maxRecords: 5000 });
  return records.map(toTracking);
}

async function attachTrackingNames(rows: EmailTracking[]): Promise<void> {
  const companyIds = rows.map((r) => r.companyId || "").filter(Boolean);
  const contactIds = rows.map((r) => r.contactId || "").filter(Boolean);
  const [companies, contacts] = await Promise.all([
    companyIds.length ? companyNameMap(companyIds) : Promise.resolve(new Map<string, string>()),
    contactIds.length ? contactNameMap(contactIds) : Promise.resolve(new Map<string, string>()),
  ]);
  for (const r of rows) {
    if (r.companyId) r.companyName = companies.get(r.companyId);
    if (r.contactId) r.contactName = contacts.get(r.contactId);
  }
}

async function contactNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const F = FIELDS.contacts;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.contacts, {
    ...(unique.length <= ID_FILTER_MAX
      ? { filterByFormula: idFormula(unique), maxRecords: unique.length }
      : { maxRecords: LIST_CAP }),
    fields: [F.name],
  });
  for (const rec of records) map.set(rec.id, str(rec.fields[F.name]) ?? "");
  return map;
}

// --- duplicate contacts: detect + merge -------------------------------------

export type DuplicateGroupWithContacts = DuplicateGroup & { contacts: Contact[] };

/** Suggested duplicate-people groups across the base, with the contacts attached. */
export async function listDuplicateGroups(): Promise<DuplicateGroupWithContacts[]> {
  const contacts = await listContacts({ limit: 5000 });
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const groups = findDuplicateGroups(contacts);

  const withContacts: DuplicateGroupWithContacts[] = groups.map((g) => ({
    ...g,
    contacts: g.contactIds.map((id) => byId.get(id)).filter((c): c is Contact => !!c),
  }));

  const companyIds = withContacts.flatMap((g) => g.contacts.map((c) => c.companyId || "")).filter(Boolean);
  if (companyIds.length) {
    const names = await companyNameMap(companyIds);
    for (const g of withContacts) for (const c of g.contacts) if (c.companyId) c.companyName = names.get(c.companyId);
  }
  return withContacts;
}

// --- Gmail inbox sync helpers -----------------------------------------------

/** Gmail message ids already logged as activities — used to de-dupe the sync. */
export async function loggedGmailMessageIds(): Promise<Set<string>> {
  const F = FIELDS.activities;
  const records = await listRecords(AIRTABLE_BASE_ID, TABLES.activities, {
    filterByFormula: `NOT({${F.gmailMessageId}}='')`,
    fields: [F.gmailMessageId],
    maxRecords: 5000,
  });
  const out = new Set<string>();
  for (const r of records) {
    const id = str(r.fields[F.gmailMessageId]);
    if (id) out.add(id);
  }
  return out;
}

/**
 * Contacts to sync this run — those with an email, least-recently synced first
 * (never-synced come first), so a bounded run round-robins the whole base.
 */
export async function contactsForInboxSync(limit: number): Promise<Contact[]> {
  const contacts = await listContacts({ limit: 5000 });
  return contacts
    .filter((c) => c.email)
    .sort((a, b) => (a.inboxSyncedAt || "").localeCompare(b.inboxSyncedAt || ""))
    .slice(0, Math.max(0, limit));
}

/**
 * Progress of the Gmail inbox sync: how many contacts have been checked, how many
 * are left, how far each run reaches back, and how far the logged correspondence
 * actually stretches. Powers the readout beside the "Sync now" button in Settings.
 */
export async function inboxSyncStatus(): Promise<InboxSyncStatus> {
  const windowRaw = Number(process.env.INBOX_SYNC_WINDOW_DAYS);
  const windowDays =
    Number.isFinite(windowRaw) && windowRaw > 0 ? Math.min(3650, Math.floor(windowRaw)) : 120;

  const [contacts, emails] = await Promise.all([listContacts({ limit: 5000 }), listEmailActivities()]);

  const withEmail = contacts.filter((c) => c.email);
  const synced = withEmail.filter((c) => c.inboxSyncedAt);
  const lastSyncedAt = synced.reduce<string | undefined>((max, c) => {
    const t = c.inboxSyncedAt;
    return t && (!max || t > max) ? t : max;
  }, undefined);

  const oldestEmail = emails.reduce<string | undefined>((min, e) => {
    const d = e.date;
    return d && (!min || d < min) ? d : min;
  }, undefined);

  return {
    contactsTotal: withEmail.length,
    contactsSynced: synced.length,
    contactsRemaining: withEmail.length - synced.length,
    lastSyncedAt,
    windowDays,
    emailsLogged: emails.length,
    oldestEmail,
  };
}

/**
 * Contacts still awaiting the deep-history backfill — those with an email that
 * have never been backfilled first, so repeated bounded runs work through the
 * whole base exactly once each.
 */
export async function contactsForInboxBackfill(limit: number): Promise<Contact[]> {
  const contacts = await listContacts({ limit: 5000 });
  return contacts
    .filter((c) => c.email && !c.inboxBackfilledAt)
    .slice(0, Math.max(0, limit));
}

/** How many email-bearing contacts still need a backfill (drives the run loop). */
export async function inboxBackfillRemaining(): Promise<number> {
  const contacts = await listContacts({ limit: 5000 });
  return contacts.filter((c) => c.email && !c.inboxBackfilledAt).length;
}

/**
 * Progress of the one-off deep-history backfill: how many contacts have had their
 * full Gmail history pulled, how many remain, and how far correspondence now
 * reaches. Powers the readout beside the "Backfill history" button in Settings.
 */
export async function inboxBackfillStatus(): Promise<InboxBackfillStatus> {
  const windowRaw = Number(process.env.INBOX_BACKFILL_WINDOW_DAYS);
  const windowDays =
    Number.isFinite(windowRaw) && windowRaw > 0 ? Math.min(3650, Math.floor(windowRaw)) : 3650;

  const [contacts, emails] = await Promise.all([listContacts({ limit: 5000 }), listEmailActivities()]);

  const withEmail = contacts.filter((c) => c.email);
  const done = withEmail.filter((c) => c.inboxBackfilledAt);
  const lastBackfilledAt = done.reduce<string | undefined>((max, c) => {
    const t = c.inboxBackfilledAt;
    return t && (!max || t > max) ? t : max;
  }, undefined);

  const oldestEmail = emails.reduce<string | undefined>((min, e) => {
    const d = e.date;
    return d && (!min || d < min) ? d : min;
  }, undefined);

  return {
    contactsTotal: withEmail.length,
    contactsBackfilled: done.length,
    contactsRemaining: withEmail.length - done.length,
    lastBackfilledAt,
    windowDays,
    emailsLogged: emails.length,
    oldestEmail,
  };
}
