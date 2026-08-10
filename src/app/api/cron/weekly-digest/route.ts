import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/ai/digest-email";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse } from "@/lib/api";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Weekly digest email (Vercel Cron, Monday mornings). Allowlisted in middleware,
 * so it guards itself with the CRON_SECRET bearer token. Fails closed if the
 * secret isn't configured; no-ops cleanly when Gmail isn't connected.
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
    return NextResponse.json(await sendWeeklyDigest());
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured. Set ANTHROPIC_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
