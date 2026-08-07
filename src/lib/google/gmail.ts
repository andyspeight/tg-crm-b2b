import "server-only";

/**
 * Minimal Gmail send. Builds an RFC 5322 message and posts it to
 * users.messages.send as the connected account. Header fields are stripped of
 * CR/LF to prevent header injection (travelgenix-security: validate every input).
 */

const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** Remove anything that could break out of a header line. */
function headerSafe(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

function utf8Base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Encode a subject as RFC 2047 when it contains non-ASCII, else leave as-is. */
function encodeSubject(subject: string): string {
  const clean = headerSafe(subject);
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${utf8Base64(clean)}?=`;
}

/** Wrap a base64 string at 76 chars per line (RFC 2045). */
function wrap76(s: string): string {
  return s.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function fromHeader(email: string, name?: string): string {
  const addr = headerSafe(email);
  if (!name) return addr;
  // Quote the display name and drop any quotes/backslashes from it.
  const clean = headerSafe(name).replace(/["\\]/g, "");
  return `"${clean}" <${addr}>`;
}

export interface SendInput {
  accessToken: string;
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string; // plain text
}

export async function sendGmail(input: SendInput): Promise<{ id: string; threadId: string }> {
  const headers = [
    `From: ${fromHeader(input.fromEmail, input.fromName)}`,
    `To: ${headerSafe(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const raw = `${headers.join("\r\n")}\r\n\r\n${wrap76(utf8Base64(input.body))}`;

  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url(raw) }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Gmail send failed (${res.status}): ${body.error?.message || "unknown"}`);
  }
  const data = (await res.json()) as { id?: string; threadId?: string };
  return { id: data.id || "", threadId: data.threadId || "" };
}

// --- rich send (HTML + attachments) -----------------------------------------

export interface RichAttachment {
  filename: string;
  contentType: string;
  base64: string; // raw base64 (no data: prefix)
}

export interface RichSendInput {
  accessToken: string;
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text?: string; // plain-text alternative; derived from html if omitted
  attachments?: RichAttachment[];
}

/** Very small HTML → plain-text fallback for the text/plain alternative part. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Send an HTML email (with an auto plain-text part) and optional attachments. */
export async function sendGmailRich(input: RichSendInput): Promise<{ id: string; threadId: string }> {
  const alt = `alt_${crypto.randomUUID()}`;
  const mixed = `mix_${crypto.randomUUID()}`;
  const text = input.text ?? htmlToPlain(input.html);
  const attachments = input.attachments ?? [];

  const altPart = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(utf8Base64(text)),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(utf8Base64(input.html)),
    `--${alt}--`,
  ].join("\r\n");

  const baseHeaders = [
    `From: ${fromHeader(input.fromEmail, input.fromName)}`,
    `To: ${headerSafe(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
  ];

  let raw: string;
  if (attachments.length === 0) {
    const headers = [...baseHeaders, `Content-Type: multipart/alternative; boundary="${alt}"`];
    raw = `${headers.join("\r\n")}\r\n\r\n${altPart}`;
  } else {
    const parts: string[] = [
      `--${mixed}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      altPart,
    ];
    for (const a of attachments) {
      const name = headerSafe(a.filename).replace(/["\\]/g, "");
      parts.push(
        `--${mixed}`,
        `Content-Type: ${headerSafe(a.contentType) || "application/octet-stream"}; name="${name}"`,
        `Content-Disposition: attachment; filename="${name}"`,
        "Content-Transfer-Encoding: base64",
        "",
        wrap76(a.base64),
      );
    }
    parts.push(`--${mixed}--`);
    const headers = [...baseHeaders, `Content-Type: multipart/mixed; boundary="${mixed}"`];
    raw = `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
  }

  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url(raw) }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Gmail send failed (${res.status}): ${body.error?.message || "unknown"}`);
  }
  const data = (await res.json()) as { id?: string; threadId?: string };
  return { id: data.id || "", threadId: data.threadId || "" };
}
