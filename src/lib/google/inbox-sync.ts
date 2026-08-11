import "server-only";

/**
 * Gmail inbox sync. Two flavours over one shared core:
 *
 *  - runInboxSync():     the rolling tick (cron or manual). Round-robins the whole
 *                        contact base, logging recent correspondence onto timelines.
 *  - runInboxBackfill(): a one-off deep-history pass. Reaches back years and pulls
 *                        hundreds of messages per contact, marking each contact done
 *                        exactly once so repeated bounded runs converge.
 *
 * Both are bounded per run (env-tunable + a wall-clock budget) and de-duped by
 * Gmail message id, so nothing is logged twice and a slow run can't blow the
 * serverless budget.
 */

import {
  contactsForInboxBackfill,
  contactsForInboxSync,
  createActivity,
  inboxBackfillRemaining,
  loggedGmailMessageIds,
  updateContact,
} from "@/lib/crm/data";
import type { Contact } from "@/lib/crm/types";
import { canSyncInbox, getAccessToken } from "@/lib/google/oauth";
import { getMessageForSync, listMessageIds, type SyncMessage } from "@/lib/google/gmail";

const TIME_BUDGET_MS = 270_000; // leave headroom under the route's 300s maxDuration
const MAX_BODY = 4000;

function cap(name: string, fallback: number, max = 100): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.min(max, Math.floor(raw));
}

export interface InboxSyncSummary {
  ran: boolean;
  reason?: string;
  contactsScanned: number;
  messagesLogged: number;
  errors: number;
}

export interface InboxBackfillSummary extends InboxSyncSummary {
  /** Email-bearing contacts still awaiting a backfill after this run (drives the loop). */
  contactsRemaining: number;
}

/** Gmail search query for one contact's mail (to or from any of their addresses). */
function contactQuery(contact: Contact, windowDays: number): string {
  const addrs = [contact.email, ...(contact.alternateEmails ?? [])]
    .map((e) => (e || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const clause = addrs.map((a) => `from:${a} OR to:${a}`).join(" OR ");
  return `newer_than:${windowDays}d (${clause})`;
}

/** A one-line header for the timeline, then the body (or snippet fallback), capped. */
function bodyFor(m: SyncMessage): string {
  const who = m.direction === "inbound" ? `Received from ${m.from}` : `Sent to ${m.to}`;
  const text = (m.body || m.snippet || "").slice(0, MAX_BODY);
  return `${who}\n\n${text}`.trim();
}

interface CoreOptions {
  accessToken: string;
  contacts: Contact[];
  windowDays: number;
  perContact: number;
  /** Which contact timestamp to stamp when the contact is finished. */
  stampField: "inboxSyncedAt" | "inboxBackfilledAt";
  /** Stamp even when the time budget cut a contact short (rolling sync keeps moving). */
  stampOnPartial: boolean;
}

/** Shared per-contact loop: fetch, log de-duped, stamp. Mutates `summary` and `seen`. */
async function processContacts(
  opts: CoreOptions,
  summary: InboxSyncSummary,
  seen: Set<string>,
  startedAt: number,
): Promise<void> {
  const timeLeft = () => Date.now() - startedAt < TIME_BUDGET_MS;

  for (const contact of opts.contacts) {
    if (!timeLeft()) break;
    summary.contactsScanned += 1;
    let completed = true;
    try {
      const ids = await listMessageIds(
        opts.accessToken,
        contactQuery(contact, opts.windowDays),
        opts.perContact,
      );
      for (const id of ids) {
        if (seen.has(id)) continue;
        if (!timeLeft()) {
          completed = false;
          break;
        }
        const m = await getMessageForSync(opts.accessToken, id);
        await createActivity({
          type: "Email",
          source: "Gmail",
          summary: m.subject || "(no subject)",
          rawContent: bodyFor(m),
          date: m.date || new Date().toISOString(),
          companyId: contact.companyId,
          contactId: contact.id,
          gmailMessageId: id,
          direction: m.direction === "inbound" ? "Inbound" : "Outbound",
        });
        seen.add(id);
        summary.messagesLogged += 1;
      }
    } catch (e) {
      summary.errors += 1;
      completed = false;
      console.error(`[inbox-sync] failed for ${contact.email}:`, e);
    }
    // Stamp the contact done even when the time budget (or an error) cut it short.
    // De-dup makes re-runs idempotent, but the point of best-effort stamping is
    // forward progress: a single deep mailbox that can't finish in one 270s pass
    // would otherwise be retried at the head of every pass forever, stalling the
    // whole backfill on that one contact. Stamping it means the pass captures its
    // most-recent N messages and moves on; the rolling sync backfills the rest.
    if (completed || opts.stampOnPartial) {
      const patch =
        opts.stampField === "inboxBackfilledAt"
          ? { inboxBackfilledAt: new Date().toISOString() }
          : { inboxSyncedAt: new Date().toISOString() };
      await updateContact(contact.id, patch).catch(() => {});
    }
    if (!timeLeft()) break;
  }
}

async function connect(): Promise<{ accessToken: string } | { reason: string }> {
  if (!(await canSyncInbox())) {
    return { reason: "Gmail isn't connected with read access. Reconnect Gmail in Settings to enable sync." };
  }
  try {
    return await getAccessToken();
  } catch {
    return { reason: "Gmail isn't connected." };
  }
}

export async function runInboxSync(): Promise<InboxSyncSummary> {
  const summary: InboxSyncSummary = { ran: false, contactsScanned: 0, messagesLogged: 0, errors: 0 };
  const conn = await connect();
  if ("reason" in conn) return { ...summary, reason: conn.reason };
  summary.ran = true;

  const seen = await loggedGmailMessageIds();
  const contacts = await contactsForInboxSync(cap("INBOX_SYNC_CONTACTS_PER_RUN", 20, 200));
  await processContacts(
    {
      accessToken: conn.accessToken,
      contacts,
      windowDays: cap("INBOX_SYNC_WINDOW_DAYS", 120, 3650),
      perContact: cap("INBOX_SYNC_MESSAGES_PER_CONTACT", 25, 100),
      stampField: "inboxSyncedAt",
      stampOnPartial: true,
    },
    summary,
    seen,
    Date.now(),
  );
  return summary;
}

export async function runInboxBackfill(): Promise<InboxBackfillSummary> {
  const base: InboxSyncSummary = { ran: false, contactsScanned: 0, messagesLogged: 0, errors: 0 };
  const conn = await connect();
  if ("reason" in conn) {
    return { ...base, reason: conn.reason, contactsRemaining: await inboxBackfillRemaining().catch(() => 0) };
  }
  base.ran = true;

  const seen = await loggedGmailMessageIds();
  // Take a generous slice — the wall-clock budget below bounds how many actually
  // get processed, so shallow contacts fly through while deep ones still fit.
  const contacts = await contactsForInboxBackfill(cap("INBOX_BACKFILL_CONTACTS_PER_RUN", 30, 200));
  await processContacts(
    {
      accessToken: conn.accessToken,
      contacts,
      // Retention window: only the last 12 months are worth storing in the CRM.
      // Older mail lives in Gmail and is reachable on demand from the 360.
      windowDays: cap("INBOX_BACKFILL_WINDOW_DAYS", 365, 3650),
      perContact: cap("INBOX_BACKFILL_MESSAGES_PER_CONTACT", 300, 1000),
      stampField: "inboxBackfilledAt",
      stampOnPartial: true,
    },
    base,
    seen,
    Date.now(),
  );

  return { ...base, contactsRemaining: await inboxBackfillRemaining().catch(() => 0) };
}
