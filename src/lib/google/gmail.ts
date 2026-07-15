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
