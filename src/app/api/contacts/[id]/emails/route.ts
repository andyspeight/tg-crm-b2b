import { NextResponse } from "next/server";
import { getContact, listContactActivities, trackingByMessageIds } from "@/lib/crm/data";
import { AirtableError } from "@/lib/airtable";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One contact, their full activity timeline, and open-tracking for the sent emails. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [contact, activities] = await Promise.all([getContact(id), listContactActivities(id)]);
    // Attach open/read status for the emails we sent (keyed by Gmail message id).
    const sentIds = activities
      .filter((a) => a.type === "Email" && a.direction === "Outbound" && a.gmailMessageId)
      .map((a) => a.gmailMessageId as string);
    const opens = await trackingByMessageIds(sentIds).catch(() => ({}));
    return NextResponse.json({ contact, activities, opens });
  } catch (e) {
    if (e instanceof AirtableError && e.status === 404) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return errorResponse(e);
  }
}
