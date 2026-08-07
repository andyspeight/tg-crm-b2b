import { NextRequest, NextResponse } from "next/server";
import { runInboxSync } from "@/lib/google/inbox-sync";
import { errorResponse } from "@/lib/api";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled Gmail inbox sync (Vercel Cron). Allowlisted in middleware; guards
 * itself with the CRON_SECRET bearer token. Fails closed if the secret is unset.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runInboxSync());
  } catch (e) {
    return errorResponse(e);
  }
}
