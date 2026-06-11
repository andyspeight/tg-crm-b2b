import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authConfigured, sessionToken, safeEqual } from "@/lib/auth";

/**
 * Auth gate on every route (brief §3: "No unauthenticated access to any API route
 * or page."). Pages redirect to /login; API routes get a JSON 401. The login page
 * and the auth endpoints are the only public surfaces.
 */

const PUBLIC_PAGES = ["/login"];
const PUBLIC_APIS = ["/api/auth/login", "/api/auth/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_APIS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  if (await isAuthed(req)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

async function isAuthed(req: NextRequest): Promise<boolean> {
  // Fail closed: with no password/secret configured, nothing is accessible.
  if (!authConfigured()) return false;

  // TODO(SSO): once Luna Desk runs on *.travelify.io, accept a valid Travelgenix
  // Control `tg_session` cookie here (tg-auth-gate pattern) ahead of the password
  // session. Until then the password gate below is the only way in.

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, await sessionToken());
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
