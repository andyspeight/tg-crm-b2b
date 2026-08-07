import { NextRequest, NextResponse } from "next/server";
import { createActivity, recordTrackingHit } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

// A 1×1 fully transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function pixel(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

/**
 * Open-tracking pixel. Public (allowlisted in middleware): the recipient's mail
 * client fetches it with no session. Records the open, raises a one-time "warm"
 * note on the timeline for the first open, and always returns the pixel — a
 * tracking failure must never show a broken image in someone's inbox.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return pixel();

    const hit = await recordTrackingHit(token, req.headers.get("user-agent") || undefined);
    if (hit?.firstHit && hit.row.kind === "Email") {
      const subject = hit.row.subject ? `“${hit.row.subject}”` : "your email";
      await createActivity({
        // "Signal" (not a meaningful-contact type) so an inbound open doesn't
        // reset the account's Last Meaningful Contact — that's for *our* outreach.
        type: "Signal",
        source: "Gmail",
        summary: `📬 Opened ${subject}`,
        rawContent: `The recipient opened this email${hit.row.recipient ? ` (${hit.row.recipient})` : ""} — a good moment to follow up.`,
        date: new Date().toISOString(),
        companyId: hit.row.companyId,
        contactId: hit.row.contactId,
      }).catch((e) => console.error("[track/open] activity log failed:", e));
    }
  } catch (e) {
    console.error("[track/open]", e);
  }
  return pixel();
}
