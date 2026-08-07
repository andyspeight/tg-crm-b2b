import type { Contact } from "./types";
import { nameKey } from "@/lib/domain";

/**
 * Find likely-duplicate people — the same person recorded more than once (often
 * with different email addresses). Pure and deterministic. Precision matters far
 * more than recall here (a wrong merge is destructive), so only two tight signals
 * qualify:
 *   1. a shared email address (exact) — the same person, whatever the company;
 *   2. the same FULL name AT THE SAME company.
 * A shared first name across different companies (five different "David"s at five
 * agencies) is NOT a duplicate and is never grouped. Merging is always the user's
 * call — this only suggests.
 */

export type DupConfidence = "high" | "medium";

/** A name strong enough to match on: at least two real name tokens (a surname). */
function isFullName(name?: string): boolean {
  const tokens = (name || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.replace(/[^a-z0-9]/gi, "").length >= 2);
  return tokens.length >= 2;
}

export interface DuplicateGroup {
  key: string;
  reason: string;
  confidence: DupConfidence;
  contactIds: string[];
}

function allEmails(c: Contact): string[] {
  return [c.email, ...(c.alternateEmails ?? [])]
    .map((e) => (e || "").trim().toLowerCase())
    .filter(Boolean);
}

function dedupeById(list: Contact[]): Contact[] {
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const c of list) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export function findDuplicateGroups(contacts: Contact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const grouped = new Set<string>(); // ids already claimed by a higher-confidence rule

  // 1) Same email address — definite duplicates.
  const byEmail = new Map<string, Contact[]>();
  for (const c of contacts) {
    for (const e of allEmails(c)) {
      const arr = byEmail.get(e) ?? [];
      arr.push(c);
      byEmail.set(e, arr);
    }
  }
  for (const [email, list] of byEmail) {
    const uniq = dedupeById(list);
    if (uniq.length < 2) continue;
    groups.push({
      key: `email:${email}`,
      reason: `Same email · ${email}`,
      confidence: "high",
      contactIds: uniq.map((c) => c.id),
    });
    uniq.forEach((c) => grouped.add(c.id));
  }

  // 2) Same FULL name AT THE SAME company — near-certain. Keyed on name+company,
  // so a shared first name across different agencies never groups.
  const byNameCompany = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (grouped.has(c.id)) continue;
    if (!c.companyId) continue; // no company to corroborate → skip
    if (!isFullName(c.name)) continue; // a bare first name is too generic
    const k = `${nameKey(c.name)}@@${c.companyId}`;
    const arr = byNameCompany.get(k) ?? [];
    arr.push(c);
    byNameCompany.set(k, arr);
  }
  for (const [k, list] of byNameCompany) {
    const uniq = dedupeById(list).filter((c) => !grouped.has(c.id));
    if (uniq.length < 2) continue;
    groups.push({
      key: `name:${k}`,
      reason: `Same name at the same company · ${uniq[0].name}`,
      confidence: "high",
      contactIds: uniq.map((c) => c.id),
    });
    uniq.forEach((c) => grouped.add(c.id));
  }

  return groups;
}
