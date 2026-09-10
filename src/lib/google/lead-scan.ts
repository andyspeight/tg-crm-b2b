import "server-only";

/**
 * Inbox lead discovery (readonly). Scans the connected account's SENT mail for
 * people the user has emailed who AREN'T in the CRM yet, so they can be reviewed
 * and added as leads — the zero-admin capture the brief asks for (§7), but never
 * auto-created: a person only becomes a record when the user says so.
 *
 * Sent-only by design: someone the user actively emailed is a real intent signal;
 * scanning the whole inbox would drown the queue in newsletters and no-reply noise.
 */

import { canSyncInbox, getAccessToken } from "@/lib/google/oauth";
import { listMessageIds } from "@/lib/google/gmail";
import { allContactEmails, getDismissedLeadEmails } from "@/lib/crm/data";
import { emailBrand } from "@/lib/domain";

const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIME_BUDGET_MS = 50_000; // stay under the route's 60s maxDuration
const CONCURRENCY = 10;

// Company mailboxes that aren't a sales lead. Own domain is added at runtime.
const INTERNAL_DOMAINS = new Set([
  "agendas.group",
  "travelgenix.com",
  "travelgenix.io",
  "travelify.io",
  "lunamarketing.io",
]);

// Local-parts that are machines, not people.
const AUTOMATED_LOCAL =
  /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce|bounces|mailer|notifications?|alerts?|updates?|newsletter|news|hello@?bot|noreply)$/i;

function cap(name: string, fallback: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.min(max, Math.floor(raw));
}

export interface LeadCandidate {
  email: string;
  name: string;
  /** Suggested company (business-domain brand); "" for a free mailbox. */
  company: string;
  domain: string;
  /** How many of the user's emails went to this person. */
  count: number;
  lastEmailedAt: string; // ISO
}

export interface LeadScanResult {
  ran: boolean;
  reason?: string;
  scanned: number;
  candidates: LeadCandidate[];
}

interface GmailHeader {
  name: string;
  value: string;
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

/** Split a To/Cc header into {email,name} pairs, respecting "Name <addr>" commas. */
function parseAddresses(header: string): { email: string; name: string }[] {
  const out: { email: string; name: string }[] = [];
  for (const chunk of (header || "").split(/,(?![^<]*>)/)) {
    const c = chunk.trim();
    if (!c) continue;
    const m = c.match(/<([^>]+)>/);
    const email = (m ? m[1] : c).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    const name = m ? c.slice(0, m.index).trim().replace(/(^"|"$)/g, "").replace(/"/g, "").trim() : "";
    out.push({ email, name });
  }
  return out;
}

/** Title-case a token stream from a domain/local-part, e.g. "acme-travel" -> "Acme Travel". */
function titleize(s: string): string {
  return s
    .split(/[.\-_+ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Best-effort person name from the email local-part when no display name was sent. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  if (/^[a-z]+[._-][a-z]+/i.test(local)) return titleize(local);
  return "";
}

/** Fetch just the To/Cc/Date headers for one sent message (metadata scope, no body). */
async function getSentMeta(
  token: string,
  id: string,
): Promise<{ to: string; cc: string; dateMs: number } | null> {
  const url =
    `${API_BASE}/messages/${encodeURIComponent(id)}` +
    `?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { internalDate?: string; payload?: { headers?: GmailHeader[] } };
  const headers = data.payload?.headers;
  const ms = Number(data.internalDate);
  return {
    to: headerValue(headers, "To"),
    cc: headerValue(headers, "Cc"),
    dateMs: Number.isFinite(ms) ? ms : 0,
  };
}

interface Tally {
  count: number;
  lastMs: number;
  name: string;
}

export async function scanSentForLeads(): Promise<LeadScanResult> {
  const empty: LeadScanResult = { ran: false, scanned: 0, candidates: [] };
  if (!(await canSyncInbox())) {
    return { ...empty, reason: "Gmail isn't connected with read access. Reconnect Gmail in Settings." };
  }
  let token: string, ownEmail: string;
  try {
    const conn = await getAccessToken();
    token = conn.accessToken;
    ownEmail = (conn.email || "").toLowerCase();
  } catch {
    return { ...empty, reason: "Gmail isn't connected." };
  }

  const windowDays = cap("INBOX_LEADS_WINDOW_DAYS", 365, 3650);
  const maxMessages = cap("INBOX_LEADS_MAX_MESSAGES", 400, 1000);
  const maxRecipients = cap("INBOX_LEADS_MAX_RECIPIENTS", 8, 50); // skip bulk sends
  const maxCandidates = cap("INBOX_LEADS_MAX_CANDIDATES", 100, 500);

  const [ids, contactEmails, dismissed] = await Promise.all([
    listMessageIds(token, `in:sent newer_than:${windowDays}d`, maxMessages),
    allContactEmails(),
    getDismissedLeadEmails(),
  ]);

  const ownDomain = ownEmail.includes("@") ? ownEmail.split("@")[1] : "";
  const excludedDomain = (d: string) => INTERNAL_DOMAINS.has(d) || (!!ownDomain && d === ownDomain);
  const excludedEmail = (e: string) =>
    e === ownEmail ||
    contactEmails.has(e) ||
    dismissed.has(e) ||
    AUTOMATED_LOCAL.test(e.split("@")[0] || "") ||
    excludedDomain(e.split("@")[1] || "");

  const tally = new Map<string, Tally>();
  const started = Date.now();
  let scanned = 0;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const metas = await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => getSentMeta(token, id)));
    for (const meta of metas) {
      if (!meta) continue;
      scanned += 1;
      const recips = [...parseAddresses(meta.to), ...parseAddresses(meta.cc)];
      if (recips.length === 0 || recips.length > maxRecipients) continue; // bulk / none
      for (const r of recips) {
        if (excludedEmail(r.email)) continue;
        const t = tally.get(r.email) ?? { count: 0, lastMs: 0, name: "" };
        t.count += 1;
        if (meta.dateMs > t.lastMs) t.lastMs = meta.dateMs;
        if (!t.name && r.name) t.name = r.name;
        tally.set(r.email, t);
      }
    }
  }

  const candidates: LeadCandidate[] = [...tally.entries()]
    .map(([email, t]) => {
      const domain = email.split("@")[1] || "";
      const brand = emailBrand(email);
      return {
        email,
        name: t.name || nameFromEmail(email),
        company: brand ? titleize(brand) : "",
        domain,
        count: t.count,
        lastEmailedAt: t.lastMs ? new Date(t.lastMs).toISOString() : "",
      };
    })
    .sort((a, b) => b.count - a.count || b.lastEmailedAt.localeCompare(a.lastEmailedAt))
    .slice(0, maxCandidates);

  return { ran: true, scanned, candidates };
}
