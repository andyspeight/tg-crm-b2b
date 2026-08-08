import "server-only";

/**
 * Gmail inbox sync. On each tick (cron or a manual run) it round-robins over the
 * account's contacts and logs any of their recent Gmail correspondence — sent or
 * received — onto their CRM timeline, so the 360 shows the full conversation, not
 * just what was sent from inside Luna Desk.
 *
 * Bounded per run (env-tunable) and de-duped by Gmail message id, so nothing is
 * logged twice and a slow run can never blow the serverless budget.
 */

import {
  contactsForInboxSync,
  createActivity,
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

/** Gmail search query for one contact's recent mail (to or from any of their addresses). */
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

export async function runInboxSync(): Promise<InboxSyncSummary> {
  const summary: InboxSyncSummary = { ran: false, contactsScanned: 0, messagesLogged: 0, errors: 0 };

  if (!(await canSyncInbox())) {
    return { ...summary, reason: "Gmail isn't connected with read access. Reconnect Gmail in Settings to enable sync." };
  }
  let sender: { accessToken: string };
  try {
    sender = await getAccessToken();
  } catch {
    return { ...summary, reason: "Gmail isn't connected." };
  }
  summary.ran = true;

  const started = Date.now();
  const timeLeft = () => Date.now() - started < TIME_BUDGET_MS;

  const contactsCap = cap("INBOX_SYNC_CONTACTS_PER_RUN", 20, 200);
  const perContact = cap("INBOX_SYNC_MESSAGES_PER_CONTACT", 25, 100);
  const windowDays = cap("INBOX_SYNC_WINDOW_DAYS", 120, 3650);

  const seen = await loggedGmailMessageIds();
  const contacts = await contactsForInboxSync(contactsCap);

  for (const contact of contacts) {
    if (!timeLeft()) break;
    summary.contactsScanned += 1;
    try {
      const ids = await listMessageIds(sender.accessToken, contactQuery(contact, windowDays), perContact);
      for (const id of ids) {
        if (seen.has(id)) continue;
        if (!timeLeft()) break;
        const m = await getMessageForSync(sender.accessToken, id);
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
      console.error(`[inbox-sync] failed for ${contact.email}:`, e);
    }
    // Stamp regardless of outcome so the round-robin keeps moving.
    await updateContact(contact.id, { inboxSyncedAt: new Date().toISOString() }).catch(() => {});
  }

  return summary;
}
