import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  sessionToken,
  verifyPassword,
} from "@/lib/auth";
import { readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured. Set APP_PASSWORD and AUTH_SECRET." },
      { status: 503 },
    );
  }

  // Brute-force protection: cap attempts per IP. Fail closed and log on abuse.
  const ip = clientIp(req);
  const limit = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!limit.ok) {
    console.warn(`[auth] login rate-limited for ${ip}`);
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = await readJson(req);
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyPassword(password)) {
    console.warn(`[auth] failed login attempt from ${ip}`);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
