import "server-only";
import type { EnrichedCompanyData, EnrichedContactData } from "./types";
import { SIZE_BANDS } from "@/lib/crm/config";

/**
 * Bright Data Web Scraper API adapter. Public-data only, via the official API
 * (brief §3, §7). The trigger -> poll -> snapshot flow is async, so callers run
 * on routes with an extended maxDuration.
 *
 * Dataset IDs default to Bright Data's standard LinkedIn scrapers and can be
 * overridden per-account via env without a code change.
 */

const API = "https://api.brightdata.com/datasets/v3";
const POLL_MS = 3000;
const DEADLINE_MS = 55_000;

function key(): string {
  const k = process.env.BRIGHTDATA_API_KEY;
  if (!k) throw new Error("BRIGHTDATA_API_KEY is not set");
  return k;
}

const PROFILE_DATASET = process.env.BRIGHTDATA_LINKEDIN_PROFILE_DATASET || "gd_l1viktl72bvl7bjuj0";
const COMPANY_DATASET = process.env.BRIGHTDATA_LINKEDIN_COMPANY_DATASET || "gd_l1vikfnt1wgvvqz95w";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trigger(datasetId: string, url: string): Promise<string> {
  const res = await fetch(`${API}/trigger?dataset_id=${datasetId}&include_errors=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ url }]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bright Data trigger failed (${res.status})`);
  const data = (await res.json()) as { snapshot_id?: string };
  if (!data.snapshot_id) throw new Error("Bright Data did not return a snapshot id");
  return data.snapshot_id;
}

async function collect(snapshotId: string): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + DEADLINE_MS;
  // Poll progress until the snapshot is ready.
  for (;;) {
    const res = await fetch(`${API}/progress/${snapshotId}`, {
      headers: { Authorization: `Bearer ${key()}` },
      cache: "no-store",
    });
    const data = (await res.json()) as { status?: string };
    if (data.status === "ready") break;
    if (data.status === "failed") throw new Error("Bright Data snapshot failed");
    if (Date.now() > deadline) throw new Error("Bright Data timed out. Please try again.");
    await sleep(POLL_MS);
  }
  const res = await fetch(`${API}/snapshot/${snapshotId}?format=json`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bright Data snapshot fetch failed (${res.status})`);
  const json = await res.json();
  return Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
}

// --- defensive field access -------------------------------------------------

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}
function pick(rec: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = str(rec[k]);
    if (v) return v;
  }
  return undefined;
}

function mapSizeBand(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/,/g, "");
  for (const band of SIZE_BANDS) if (s.includes(band)) return band;
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) {
    if (n <= 10) return "1-10";
    if (n <= 50) return "11-50";
    if (n <= 200) return "51-200";
    if (n <= 500) return "201-500";
    if (n <= 1000) return "501-1000";
    return "1000+";
  }
  if (/\b(1001|5000|10001|\+)\b/.test(s)) return "1000+";
  return undefined;
}

function mapProfile(rec: Record<string, unknown>, url: string): EnrichedContactData {
  const company = rec.current_company as Record<string, unknown> | undefined;
  const location =
    pick(rec, ["location", "city"]) ||
    [str(rec.city), str(rec.country_code)].filter(Boolean).join(", ") ||
    undefined;
  return {
    name: pick(rec, ["name", "full_name"]) || [str(rec.first_name), str(rec.last_name)].filter(Boolean).join(" ") || undefined,
    role: pick(rec, ["position", "headline"]) || (company ? str(company.title) : undefined),
    headline: pick(rec, ["headline", "position"]),
    location,
    linkedin: pick(rec, ["url", "input_url", "linkedin_url"]) || url,
    companyName: company ? str(company.name) : pick(rec, ["current_company_name"]),
    companyLinkedin: company ? str(company.link) : undefined,
    notes: pick(rec, ["about", "summary"]),
  };
}

function mapCompany(rec: Record<string, unknown>, url: string): EnrichedCompanyData {
  return {
    name: pick(rec, ["name", "company_name"]),
    website: pick(rec, ["website", "company_website"]),
    description: pick(rec, ["about", "description"]),
    sizeBand: mapSizeBand(pick(rec, ["company_size", "size", "employees_in_linkedin"])),
    country: pick(rec, ["country", "country_code"]) || pick(rec, ["headquarters", "location"]),
    linkedin: pick(rec, ["url", "input_url", "linkedin_url"]) || url,
    socials: undefined,
  };
}

export class BrightDataProvider {
  async profileFromUrl(url: string): Promise<EnrichedContactData> {
    const records = await collect(await trigger(PROFILE_DATASET, url));
    if (records.length === 0) throw new Error("No LinkedIn profile data found for that URL");
    return mapProfile(records[0], url);
  }

  async companyFromUrl(url: string): Promise<EnrichedCompanyData> {
    const records = await collect(await trigger(COMPANY_DATASET, url));
    if (records.length === 0) throw new Error("No LinkedIn company data found for that URL");
    return mapCompany(records[0], url);
  }
}
