import { NextRequest, NextResponse } from "next/server";
import { createActivity, getEmailTemplate } from "@/lib/crm/data";
import { getAccessToken } from "@/lib/google/oauth";
import { sendGmailRich, type RichAttachment } from "@/lib/google/gmail";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_SUBJECT = 500;
const MAX_HTML = 100_000;
// Gmail's message-size ceiling is ~25 MB; keep well under it after base64 (+33%).
const MAX_ATTACH_BYTES = 18 * 1024 * 1024;

/** Turn the template's Airtable attachments into base64 parts for the MIME message. */
async function resolveTemplateAttachments(templateId: string): Promise<RichAttachment[]> {
  const template = await getEmailTemplate(templateId);
  const out: RichAttachment[] = [];
  let total = 0;
  for (const a of template.attachments) {
    if (!a.url) continue;
    const res = await fetch(a.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't fetch attachment "${a.filename}".`);
    const buf = Buffer.from(await res.arrayBuffer());
    total += buf.length;
    if (total > MAX_ATTACH_BYTES) {
      throw new Error("The attachments on this template are too large to email together.");
    }
    out.push({
      filename: a.filename,
      contentType: a.type || res.headers.get("content-type") || "application/octet-stream",
      base64: buf.toString("base64"),
    });
  }
  return out;
}

/**
 * Send a rich (HTML + attachments) 1:1 email as the connected Gmail account and
 * log it to the timeline. Subject/body arrive already merge-filled and, if the
 * user chose to, AI-personalised — this route just validates, attaches, sends.
 */
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
    const html = typeof body.html === "string" ? body.html : "";
    const companyId = typeof body.companyId === "string" ? body.companyId : undefined;
    const contactId = typeof body.contactId === "string" ? body.contactId : undefined;
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";

    if (!to || /[\r\n]/.test(to) || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
    }
    if (!subject || /[\r\n]/.test(subject)) {
      return NextResponse.json({ error: "A subject is required." }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: "That subject is too long." }, { status: 400 });
    }
    if (!html.trim()) {
      return NextResponse.json({ error: "The email body is empty." }, { status: 400 });
    }
    if (html.length > MAX_HTML) {
      return NextResponse.json({ error: "That email is too long to send." }, { status: 400 });
    }

    let sender: { accessToken: string; email: string; name?: string };
    try {
      sender = await getAccessToken();
    } catch {
      return NextResponse.json(
        { error: "Gmail isn't connected. Connect it in Settings to send.", needsConnect: true },
        { status: 409 },
      );
    }

    const attachments = templateId ? await resolveTemplateAttachments(templateId) : [];

    const sent = await sendGmailRich({
      accessToken: sender.accessToken,
      fromEmail: sender.email,
      fromName: sender.name,
      to,
      subject,
      html,
      attachments,
    });

    await createActivity({
      type: "Email",
      source: "Gmail",
      summary: subject,
      rawContent: html,
      date: new Date().toISOString(),
      companyId,
      contactId,
    }).catch((e) => console.error("[email/send-template] activity log failed:", e));

    return NextResponse.json({ ok: true, id: sent.id, from: sender.email });
  } catch (e) {
    if (e instanceof Error && /Gmail send failed/i.test(e.message)) {
      console.error("[email/send-template]", e);
      return NextResponse.json({ error: "Gmail rejected the message. Please try again." }, { status: 502 });
    }
    return errorResponse(e);
  }
}
