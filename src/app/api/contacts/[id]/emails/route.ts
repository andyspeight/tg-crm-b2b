import { NextResponse } from "next/server";
import { getContact, listContactEmails, trackingByMessageIds } from "@/lib/crm/data";
import { AirtableError } from "@/lib/airtable";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One contact, their email correspondence, and open-tracking for the sent ones. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [contact, emails] = await Promise.all([getContact(id), listContactEmails(id)]);
    // Attach open/read status for the emails we sent (keyed by Gmail message id).
    const sentIds = emails
      .filter((e) => e.direction === "Outbound" && e.gmailMessageId)
      .map((e) => e.gmailMessageId as string);
    const opens = await trackingByMessageIds(sentIds).catch(() => ({}));
    return NextResponse.json({ contact, emails, opens });
  } catch (e) {
    if (e instanceof AirtableError && e.status === 404) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return errorResponse(e);
  }
}
