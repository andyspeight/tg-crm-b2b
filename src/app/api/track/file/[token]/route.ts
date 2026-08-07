import { NextRequest, NextResponse } from "next/server";
import { createActivity, getEmailTemplate, recordTrackingHit } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

/**
 * Tracked attachment link. Public (allowlisted in middleware). Records the
 * download, raises a one-time "warm" note on the timeline for the first click,
 * then redirects to the file — resolved fresh from the template at click time so
 * the (time-limited) Airtable URL is always valid.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hit = await recordTrackingHit(token, req.headers.get("user-agent") || undefined);
    if (!hit || hit.row.kind !== "Attachment" || !hit.row.templateId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (hit.firstHit) {
      await createActivity({
        // "Signal" (not a meaningful-contact type) — an inbound download is
        // engagement, not us reaching out, so it shouldn't reset Last Contact.
        type: "Signal",
        source: "Gmail",
        summary: `📎 Downloaded ${hit.row.filename || "an attachment"}`,
        rawContent: `The recipient downloaded ${hit.row.filename || "an attachment"}${hit.row.subject ? ` from “${hit.row.subject}”` : ""} — a strong sign of interest.`,
        date: new Date().toISOString(),
        companyId: hit.row.companyId,
        contactId: hit.row.contactId,
      }).catch((e) => console.error("[track/file] activity log failed:", e));
    }

    const template = await getEmailTemplate(hit.row.templateId);
    const idx = hit.row.attachIndex ?? -1;
    const file = template.attachments[idx];
    if (!file?.url) return NextResponse.json({ error: "File no longer available" }, { status: 404 });

    return NextResponse.redirect(file.url, 302);
  } catch (e) {
    console.error("[track/file]", e);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
