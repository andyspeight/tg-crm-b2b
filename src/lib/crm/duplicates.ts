import type { Contact } from "./types";
import { nameKey } from "@/lib/domain";

/**
 * Find likely-duplicate people — the same person recorded more than once (often
 * with different email addresses). Pure and deterministic. Two signals:
 *   1. a shared email address (exact) → definite;
 *   2. the same name → likely, and near-certain when they're at the same company.
 * Merging is always a human decision, so this only *suggests* groups.
 */

export type DupConfidence = "high" | "medium";

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

  // 2) Same name — likely the same person; near-certain at the same company.
  const byName = new Map<string, Contact[]>();
  for (const c of contacts) {
    const k = nameKey(c.name);
    if (k.length < 4) continue; // skip blank/very short names
    const arr = byName.get(k) ?? [];
    arr.push(c);
    byName.set(k, arr);
  }
  for (const [k, list] of byName) {
    const uniq = dedupeById(list).filter((c) => !grouped.has(c.id));
    if (uniq.length < 2) continue;
    const companyIds = uniq.map((c) => c.companyId).filter(Boolean);
    const sameCompany = companyIds.length === uniq.length && new Set(companyIds).size === 1;
    groups.push({
      key: `name:${k}`,
      reason: sameCompany
        ? `Same name at the same company · ${uniq[0].name}`
        : `Same name · ${uniq[0].name}`,
      confidence: sameCompany ? "high" : "medium",
      contactIds: uniq.map((c) => c.id),
    });
    uniq.forEach((c) => grouped.add(c.id));
  }

  // High-confidence groups first.
  return groups.sort((a, b) =>
    a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1,
  );
}
