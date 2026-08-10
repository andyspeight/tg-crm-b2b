import { NextRequest, NextResponse } from "next/server";
import { runInboxBackfill } from "@/lib/google/inbox-sync";
import { errorResponse } from "@/lib/api";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Deep-history backfill (Vercel Cron). Runs one bounded pass each tick until the
 * whole contact base is done, so the backfill progresses in the background even
 * when nobody has the Settings page open. Self-limiting: once every contact is
 * backfilled it returns immediately with nothing to do. CRON_SECRET-guarded.
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
    return NextResponse.json(await runInboxBackfill());
  } catch (e) {
    return errorResponse(e);
  }
}
