import { NextRequest, NextResponse } from "next/server";
import { pruneOldEmailActivities } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Retention (Vercel Cron). Deletes synced/sent email activities older than the
 * 12-month window so the Activities table stays bounded and fast. Bounded per run
 * and self-limiting — once caught up it deletes nothing. CRON_SECRET-guarded.
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
    const days = Number(process.env.ACTIVITY_RETENTION_DAYS);
    const olderThanDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 365;
    return NextResponse.json(await pruneOldEmailActivities(olderThanDays));
  } catch (e) {
    return errorResponse(e);
  }
}
