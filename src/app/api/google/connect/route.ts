import { NextRequest, NextResponse } from "next/server";
import { buildConsentUrl, googleConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "g_oauth_state";

function randomHex(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/** Kick off Google OAuth: set a CSRF state cookie and redirect to the consent screen. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  const state = randomHex(16);
  const res = NextResponse.redirect(buildConsentUrl(req.nextUrl.origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
