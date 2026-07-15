import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { completeConnection } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "g_oauth_state";

/** Google redirects the connected user's browser back here with a code. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const settings = new URL("/settings", url.origin);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  function finish(status: string) {
    settings.searchParams.set("google", status);
    const res = NextResponse.redirect(settings);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (error) return finish("denied");
  // CSRF: the state we set must come back unchanged.
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
    return finish("error");
  }

  try {
    await completeConnection(code, url.origin);
    return finish("connected");
  } catch (e) {
    console.error("[google/callback] connection failed:", e);
    return finish("error");
  }
}
