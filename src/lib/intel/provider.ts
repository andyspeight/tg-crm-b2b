import "server-only";
import type { EnrichedCompanyData, EnrichedContactData, LinkedInKind } from "./types";
import { BrightDataProvider } from "./brightdata";

/** Provider interface so Bright Data can be swapped without touching callers. */
export interface IntelProvider {
  profileFromUrl(url: string): Promise<EnrichedContactData>;
  companyFromUrl(url: string): Promise<EnrichedCompanyData>;
  discoverCompany(name: string): Promise<EnrichedCompanyData | null>;
}

export class IntelNotConfiguredError extends Error {
  constructor() {
    super("BRIGHTDATA_API_KEY is not set");
    this.name = "IntelNotConfiguredError";
  }
}

let cached: IntelProvider | null = null;

export function getProvider(): IntelProvider {
  if (!process.env.BRIGHTDATA_API_KEY) throw new IntelNotConfiguredError();
  if (!cached) cached = new BrightDataProvider();
  return cached;
}

export function detectLinkedInKind(url: string): LinkedInKind | null {
  if (/linkedin\.com\/(in|pub)\//i.test(url)) return "profile";
  if (/linkedin\.com\/(company|school|showcase)\//i.test(url)) return "company";
  return null;
}

export function normalizeLinkedInUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.split("?")[0].split("#")[0].replace(/\/+$/, "");
}
