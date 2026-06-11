/**
 * Auth for Luna Desk.
 *
 * Stage 1 ships a server-checked password gate — the temporary stand-in the brief
 * (§3, §13) allows while the app is off the travelify.io domain. The locked decision
 * is Travelgenix Control SSO (tg_session cookie); the seam for it is marked in
 * middleware.ts. There is NO unauthenticated access to any route.
 *
 * The session cookie holds an opaque HMAC token derived from AUTH_SECRET, so it
 * cannot be forged without the server secret. This module is edge- and node-safe
 * (Web Crypto only) so middleware can use it.
 */

export const SESSION_COOKIE = "luna_desk_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function authSecret(): string {
  return process.env.AUTH_SECRET || "";
}

function appPassword(): string {
  return process.env.APP_PASSWORD || "";
}

/** Both env vars must be set or the gate fails closed (nothing is accessible). */
export function authConfigured(): boolean {
  return authSecret().length > 0 && appPassword().length > 0;
}

/** Opaque session token = HMAC-SHA256(AUTH_SECRET, "luna-desk:v1"), hex encoded. */
export async function sessionToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("luna-desk:v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Validate a submitted password against APP_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const pw = appPassword();
  if (!pw || !input) return false;
  return safeEqual(input, pw);
}

/** Validate a presented session cookie value against the expected token. */
export async function verifySessionCookie(value: string | undefined): Promise<boolean> {
  if (!authConfigured() || !value) return false;
  return safeEqual(value, await sessionToken());
}
