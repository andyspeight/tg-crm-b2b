/** Shapes returned by the intel provider. Client- and server-safe (no secrets). */

export interface EnrichedContactData {
  name?: string;
  role?: string;
  headline?: string;
  location?: string;
  linkedin?: string;
  companyName?: string;
  companyLinkedin?: string;
  notes?: string;
}

export interface EnrichedCompanyData {
  name?: string;
  website?: string;
  description?: string;
  sizeBand?: string;
  country?: string;
  linkedin?: string;
  socials?: string;
}

export type LinkedInKind = "profile" | "company";
