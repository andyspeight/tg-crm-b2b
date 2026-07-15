import "server-only";

/**
 * Google OAuth for Gmail sending. Single-sender internal tool: one connected
 * Google account (Andy's) whose refresh token is stored encrypted in App Settings.
 * Scopes are the minimum for the job — identity + gmail.send only, no read scope
 * (send-only phase). Because the app is internal to the agendas.group Workspace,
 * the OAuth consent screen is set to "Internal", so these scopes need no Google
 * verification.
 */

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { deleteSetting, getSetting, setSetting } from "@/lib/settings";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const KEY_REFRESH = "google_refresh_token";
const KEY_EMAIL = "google_email";
const KEY_NAME = "google_name";
const KEY_CONNECTED_AT = "google_connected_at";

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

/** The callback URL. Prefer an explicit env (must match Google exactly); else derive. */
export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
}

export function buildConsentUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent", // force a refresh token every time we (re)connect
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error) {
    // Do not surface Google's raw body to clients; callers log server-side.
    throw new Error(`Google token request failed: ${data.error || res.status}`);
  }
  return data;
}

/** Decode a JWT payload (no verification needed — received directly from Google over TLS). */
function decodeIdToken(idToken?: string): { email?: string; name?: string } {
  if (!idToken) return {};
  try {
    const part = idToken.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = JSON.parse(atob(b64)) as { email?: string; name?: string };
    return { email: json.email, name: json.name };
  } catch {
    return {};
  }
}

/** Exchange an auth code for tokens and persist the connection (encrypted refresh token). */
export async function completeConnection(code: string, origin: string): Promise<{ email?: string }> {
  const data = await tokenRequest(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  );
  if (!data.refresh_token) {
    // Google only returns a refresh token on first consent unless prompt=consent.
    throw new Error("Google did not return a refresh token. Remove app access and reconnect.");
  }
  const { email, name } = decodeIdToken(data.id_token);
  await setSetting(KEY_REFRESH, await encryptSecret(data.refresh_token));
  if (email) await setSetting(KEY_EMAIL, email);
  if (name) await setSetting(KEY_NAME, name);
  await setSetting(KEY_CONNECTED_AT, new Date().toISOString());
  return { email };
}

export interface GoogleConnection {
  email: string;
  name?: string;
  connectedAt?: string;
}

/** The connected account (presence of a stored email = connected), or null. */
export async function getConnection(): Promise<GoogleConnection | null> {
  const email = await getSetting(KEY_EMAIL);
  if (!email) return null;
  const [name, connectedAt] = await Promise.all([getSetting(KEY_NAME), getSetting(KEY_CONNECTED_AT)]);
  return { email, name: name || undefined, connectedAt: connectedAt || undefined };
}

/** A fresh access token plus the sender identity. Throws if not connected. */
export async function getAccessToken(): Promise<{ accessToken: string; email: string; name?: string }> {
  const enc = await getSetting(KEY_REFRESH);
  const email = await getSetting(KEY_EMAIL);
  if (!enc || !email) throw new Error("Gmail is not connected");
  const refreshToken = await decryptSecret(enc);
  const data = await tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  );
  if (!data.access_token) throw new Error("Google did not return an access token");
  const name = (await getSetting(KEY_NAME)) || undefined;
  return { accessToken: data.access_token, email, name };
}

/** Revoke at Google (best-effort) and clear the stored connection. */
export async function disconnect(): Promise<void> {
  const enc = await getSetting(KEY_REFRESH);
  if (enc) {
    try {
      const token = await decryptSecret(enc);
      await fetch(REVOKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        cache: "no-store",
      });
    } catch {
      /* best-effort revoke; clear locally regardless */
    }
  }
  await Promise.all([
    deleteSetting(KEY_REFRESH),
    deleteSetting(KEY_EMAIL),
    deleteSetting(KEY_NAME),
    deleteSetting(KEY_CONNECTED_AT),
  ]);
}
