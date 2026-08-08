import "server-only";
import { appBaseUrl } from "@/lib/base-url";
import { createTracking, getEmailTemplate, uploadTrackingFile } from "@/lib/crm/data";
import { templateAttachmentsAsBase64 } from "@/lib/email/attachments";
import type { RichAttachment } from "@/lib/google/gmail";

// Airtable's attachment upload caps around 5 MB; larger files can't be hosted for
// tracking, so they ride along as normal attachments instead.
const MAX_HOSTED_BYTES = 4.5 * 1024 * 1024;
const approxBytes = (base64: string) => Math.floor((base64.length * 3) / 4);

/**
 * Open/click tracking for outbound Gmail. Every send gets a 1×1 pixel whose URL
 * carries an opaque token; when the recipient's client loads it, the public
 * /api/track/open endpoint records the open. Attachments go out as tracked
 * download links (a pixel can't live inside a PDF), so a click is a real
 * "opened the attachment" signal.
 *
 * All of this is best-effort: if we can't resolve a public base URL, or a row
 * fails to write, the email still sends — tracking must never block outreach.
 */

export function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn a plain-text body into minimal, safe HTML (escape + paragraph/line breaks). */
export function plainToHtml(text: string): string {
  const blocks = text.trim().split(/\n{2,}/);
  return blocks
    .map((b) => `<p style="margin:0 0 1em">${esc(b).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function pixelTag(base: string, token: string): string {
  return `<img src="${base}/api/track/open/${token}" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden" />`;
}

function attachmentsBlock(links: { name: string; href: string }[]): string {
  if (links.length === 0) return "";
  const rows = links
    .map(
      (l) =>
        `<div style="margin:4px 0"><a href="${l.href}" style="color:#0096B7;text-decoration:underline">📎 ${esc(l.name)}</a></div>`,
    )
    .join("");
  return `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #E2E8F0"><div style="font-size:13px;color:#475569;margin-bottom:6px">Attachments</div>${rows}</div>`;
}

export interface TrackedSend {
  html: string;
  attachments: RichAttachment[];
}

/**
 * Augment an outbound email with tracking. Returns the HTML to send (with pixel +
 * any tracked attachment links) and the attachments to attach directly.
 *
 * When tracking is possible, attachments become links (attachments array is
 * empty). When it isn't (no base URL), we fall back to the previous behaviour:
 * no pixel, and any template files are attached normally so nothing is lost.
 */
export async function applyEmailTracking(opts: {
  html: string;
  subject: string;
  recipient: string;
  companyId?: string;
  contactId?: string;
  templateId?: string;
  /** Ad-hoc files uploaded in the composer — delivered directly (a file attached
   *  in the message can't be open-tracked; template files become tracked links). */
  extraAttachments?: RichAttachment[];
}): Promise<TrackedSend> {
  const base = appBaseUrl();
  const extra = opts.extraAttachments ?? [];

  // No public origin → can't build tracking URLs. Preserve existing behaviour.
  if (!base) {
    const templateFiles = opts.templateId ? await templateAttachmentsAsBase64(opts.templateId) : [];
    return { html: opts.html, attachments: [...templateFiles, ...extra] };
  }

  let html = opts.html;

  // Tracked attachment links (in place of direct attachments).
  const links: { name: string; href: string }[] = [];
  if (opts.templateId) {
    try {
      const template = await getEmailTemplate(opts.templateId);
      for (let i = 0; i < template.attachments.length; i++) {
        const a = template.attachments[i];
        if (!a.url) continue;
        const row = await createTracking({
          token: newToken(),
          kind: "Attachment",
          subject: opts.subject,
          filename: a.filename,
          templateId: opts.templateId,
          attachIndex: i,
          recipient: opts.recipient,
          companyId: opts.companyId,
          contactId: opts.contactId,
        });
        links.push({ name: a.filename, href: `${base}/api/track/file/${row.token}` });
      }
    } catch (e) {
      console.error("[tracking] attachment links failed:", e);
    }
  }
  // Ad-hoc uploads: host each on its own tracking row and link it, so downloads
  // are tracked too. Files too big to host (or that fail to upload) ride along
  // as normal attachments instead.
  const directAttach: RichAttachment[] = [];
  for (const a of extra) {
    if (approxBytes(a.base64) > MAX_HOSTED_BYTES) {
      directAttach.push(a);
      continue;
    }
    try {
      const row = await createTracking({
        token: newToken(),
        kind: "Attachment",
        subject: opts.subject,
        filename: a.filename,
        recipient: opts.recipient,
        companyId: opts.companyId,
        contactId: opts.contactId,
      });
      await uploadTrackingFile(row.id, a);
      links.push({ name: a.filename, href: `${base}/api/track/file/${row.token}` });
    } catch (e) {
      console.error("[tracking] ad-hoc host failed:", e);
      directAttach.push(a);
    }
  }

  if (links.length) html += attachmentsBlock(links);

  // The open pixel (last, so it sits at the very end of the body).
  try {
    const row = await createTracking({
      token: newToken(),
      kind: "Email",
      subject: opts.subject,
      recipient: opts.recipient,
      companyId: opts.companyId,
      contactId: opts.contactId,
    });
    html += pixelTag(base, row.token);
  } catch (e) {
    console.error("[tracking] pixel row failed:", e);
  }

  // Only files we couldn't host go out as normal attachments.
  return { html, attachments: directAttach };
}
