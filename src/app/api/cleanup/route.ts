import { NextRequest, NextResponse } from "next/server";
import { planCleanup } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Dry run: duplicate companies/people + junk records to review. Never mutates. */
export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`cleanup:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    return NextResponse.json(await planCleanup());
  } catch (e) {
    return errorResponse(e);
  }
}
