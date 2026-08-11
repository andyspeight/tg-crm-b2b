import { NextResponse } from "next/server";
import { getContact } from "@/lib/crm/data";
import { canSyncInbox, getAccessToken } from "@/lib/google/oauth";
import { getMessageForSync, listMessageIds } from "@/lib/google/gmail";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OLDER_THAN_DAYS = 365; // the CRM stores the last 12 months; this reaches past it
const MAX_MESSAGES = 25;

/**
 * Older correspondence pulled LIVE from Gmail, beyond the 12-month window the CRM
 * stores. Nothing is written to Airtable — this is a read-through so the rare
 * "what did we say back then" is one click without bloating the base.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await canSyncInbox())) {
      return NextResponse.json(
        { error: "Gmail isn't connected with read access. Reconnect Gmail in Settings.", needsConnect: true },
        { status: 409 },
      );
    }
    const contact = await getContact(id).catch(() => null);
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    const addrs = [contact.email, ...(contact.alternateEmails ?? [])]
      .map((e) => (e || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (addrs.length === 0) return NextResponse.json({ messages: [] });

    const { accessToken } = await getAccessToken();
    const clause = addrs.map((a) => `from:${a} OR to:${a}`).join(" OR ");
    const query = `older_than:${OLDER_THAN_DAYS}d (${clause})`;
    const ids = await listMessageIds(accessToken, query, MAX_MESSAGES);

    const fetched = await Promise.all(ids.slice(0, MAX_MESSAGES).map((mid) => getMessageForSync(accessToken, mid).catch(() => null)));
    const messages = fetched
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({
        id: m.id,
        subject: m.subject,
        date: m.date,
        direction: m.direction === "inbound" ? "Inbound" : "Outbound",
        body: m.body || m.snippet,
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({ messages });
  } catch (e) {
    return errorResponse(e);
  }
}
