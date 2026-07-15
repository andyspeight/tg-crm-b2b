/**
 * Small, dependency-free helpers for matching people to companies by their email
 * domain. Used by enrichment (LinkedIn discovery) and by the CRM data layer to
 * reunite orphaned contacts with their account (e.g. kelly@aarucollective.com ->
 * "A'ARU Collective"). Pure string logic, safe to import anywhere.
 */

/** Free/shared mailbox providers — a match on these tells us nothing about the company. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail",
  "googlemail",
  "outlook",
  "hotmail",
  "live",
  "msn",
  "yahoo",
  "ymail",
  "icloud",
  "me",
  "mac",
  "aol",
  "protonmail",
  "proton",
  "pm",
  "gmx",
  "mail",
  "yandex",
  "zoho",
  "fastmail",
  "hey",
  "btinternet",
  "sky",
  "talktalk",
  "virginmedia",
  "ntlworld",
  "blueyonder",
  "tiscali",
  "aol",
]);

/**
 * The distinctive brand label of a hostname: strips protocol, www and the public
 * suffix, so www.aarucollective.co.uk -> "aarucollective".
 */
export function hostBrand(hostOrUrl: string): string {
  const h = (hostOrUrl || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("@")
    .pop()!;
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  const tail2 = parts.slice(-2).join(".");
  // Second-level public suffixes like co.uk, org.uk, com.au, ac.uk...
  const isCcSld = /^(co|com|org|net|gov|ac|ltd|plc|me)\.[a-z]{2}$/.test(tail2);
  const idx = isCcSld ? parts.length - 3 : parts.length - 2;
  return parts[Math.max(idx, 0)];
}

/** The brand label from an email address, or "" for a generic/free mailbox. */
export function emailBrand(email?: string): string {
  const at = (email || "").toLowerCase().trim();
  const i = at.lastIndexOf("@");
  if (i < 0) return "";
  const brand = hostBrand(at.slice(i + 1));
  if (!brand || GENERIC_EMAIL_DOMAINS.has(brand)) return "";
  return brand;
}

/** A company name reduced to comparable letters+digits: "A'ARU Collective" -> "aarucollective". */
export function nameKey(name?: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
