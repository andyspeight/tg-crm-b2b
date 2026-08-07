import "server-only";
import { getEmailTemplate } from "@/lib/crm/data";
import type { RichAttachment } from "@/lib/google/gmail";

// Gmail's message-size ceiling is ~25 MB; keep well under it after base64 (+33%).
const MAX_ATTACH_BYTES = 18 * 1024 * 1024;

/**
 * Fetch a template's Airtable attachments and return them base64-encoded, ready
 * for a MIME message. Server-side only — never trust client-supplied URLs.
 */
export async function templateAttachmentsAsBase64(templateId: string): Promise<RichAttachment[]> {
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
