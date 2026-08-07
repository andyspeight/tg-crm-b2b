import { NextRequest, NextResponse } from "next/server";
import { runDueSequences } from "@/lib/email/sequence-engine";
import { errorResponse } from "@/lib/api";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled tick (Vercel Cron). Allowlisted in middleware, so it guards itself:
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * If CRON_SECRET isn't configured the endpoint refuses to run — fail closed.
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
    return NextResponse.json(await runDueSequences());
  } catch (e) {
    return errorResponse(e);
  }
}
