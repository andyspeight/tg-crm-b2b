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

/**
 * A candidate LinkedIn profile turned up by name-search (no URL on file). Carries
 * the search result's title/snippet so the UI can show WHY it matched and the
 * user can confirm it's the right person before anything is saved.
 */
export interface ProfileCandidate {
  url: string;
  title?: string;
  snippet?: string;
}

export type LinkedInKind = "profile" | "company";
