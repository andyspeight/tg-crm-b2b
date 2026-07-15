import { NextRequest, NextResponse } from "next/server";
import { createActivity } from "@/lib/crm/data";
import { getAccessToken } from "@/lib/google/oauth";
import { sendGmail } from "@/lib/google/gmail";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_SUBJECT = 500;
const MAX_BODY = 50_000;

/** Send a 1:1 email as the connected Gmail account and log it to the timeline. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`email:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many emails just now. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.body === "string" ? body.body : "";
    const companyId = typeof body.companyId === "string" ? body.companyId : undefined;
    const contactId = typeof body.contactId === "string" ? body.contactId : undefined;

    // Validate — reject header-injection attempts and malformed addresses outright.
    if (!to || /[\r\n]/.test(to) || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
    }
    if (!subject || /[\r\n]/.test(subject)) {
      return NextResponse.json({ error: "A subject is required." }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: "That subject is too long." }, { status: 400 });
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "The email body is empty." }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: "That email is too long to send." }, { status: 400 });
    }

    let sender: { accessToken: string; email: string; name?: string };
    try {
      sender = await getAccessToken();
    } catch {
      // Not connected (or token revoked) — tell the UI to prompt a reconnect.
      return NextResponse.json(
        { error: "Gmail isn't connected. Connect it in Settings to send.", needsConnect: true },
        { status: 409 },
      );
    }

    const sent = await sendGmail({
      accessToken: sender.accessToken,
      fromEmail: sender.email,
      fromName: sender.name,
      to,
      subject,
      body: text,
    });

    // Log to the company/contact timeline (also bumps Last Meaningful Contact).
    await createActivity({
      type: "Email",
      source: "Gmail",
      summary: subject,
      rawContent: text,
      date: new Date().toISOString(),
      companyId,
      contactId,
    }).catch((e) => console.error("[email/send] activity log failed:", e));

    return NextResponse.json({ ok: true, id: sent.id, from: sender.email });
  } catch (e) {
    if (e instanceof Error && /Gmail send failed/i.test(e.message)) {
      console.error("[email/send]", e);
      return NextResponse.json({ error: "Gmail rejected the message. Please try again." }, { status: 502 });
    }
    return errorResponse(e);
  }
}
