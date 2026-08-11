/**
 * Email signature. One block appended to the end of every client-facing email we
 * send from Luna Desk — the composer, template sends and sequence steps — but not
 * the internal weekly digest. Stored as HTML in App Settings.
 *
 * This module owns the default signature, normalisation, and an idempotent append:
 * the block carries a marker attribute so a body that already contains a signature
 * (a re-send, or a template that embedded one) is never double-stamped.
 */

/** Marker attribute that identifies our signature block in an email body. */
export const SIGNATURE_MARKER = "data-tg-signature";

/** Seed signature — Andy's, used until the setting is edited. */
export const DEFAULT_SIGNATURE_HTML =
  `<div ${SIGNATURE_MARKER}="1" style="margin-top:16px;font-size:14px;line-height:1.5;color:#0f172a">` +
  `<p style="margin:0 0 12px">Andy</p>` +
  `<hr style="border:none;border-top:1px solid #cbd5e1;margin:0 0 12px;width:220px" />` +
  `<p style="margin:0;color:#475569">` +
  `Andy Speight<br />` +
  `Co-Founder &amp; CEO<br />` +
  `Agendas Group Ltd<br />` +
  `P +44 (0) 1202 934033<br />` +
  `M +44 (0) 7711157575<br />` +
  `<a href="https://www.agendas.group" style="color:#0096b7">https://www.agendas.group</a>` +
  `</p></div>`;

const MAX_SIGNATURE = 20_000;

/** Coerce arbitrary input to a trimmed, length-capped signature string. */
export function normalizeSignature(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, MAX_SIGNATURE);
}

/** True when the html already carries a signature block (our marker present). */
export function hasSignature(html: string): boolean {
  return typeof html === "string" && html.includes(SIGNATURE_MARKER);
}

/**
 * Append the signature to the end of an email body. Idempotent and safe:
 *  - a blank signature leaves the body untouched;
 *  - a body that already carries a signature (marker) is returned unchanged, so
 *    re-sends and signature-bearing templates don't get a second copy;
 *  - a custom signature without our marker is wrapped in a marked <div> (with a
 *    little top spacing) so it's detectable next time.
 */
export function appendSignatureHtml(bodyHtml: string, signatureHtml: string): string {
  const body = typeof bodyHtml === "string" ? bodyHtml : "";
  const sig = normalizeSignature(signatureHtml);
  if (!sig) return body;
  if (hasSignature(body)) return body;
  const block = hasSignature(sig)
    ? sig
    : `<div ${SIGNATURE_MARKER}="1" style="margin-top:16px">${sig}</div>`;
  return `${body}${block}`;
}
