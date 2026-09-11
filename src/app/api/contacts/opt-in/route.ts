import { NextRequest, NextResponse } from "next/server";
import { bulkSetMarketingOptIn, type OptInSegment } from "@/lib/crm/data";
import { MARKETING_OPT_IN } from "@/lib/crm/config";
import type { MarketingOptIn } from "@/lib/crm/types";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// A full-base pass batches ~120 Airtable writes with rate-limit pauses — give it room.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SEGMENTS: OptInSegment[] = ["all", "customers", "prospects"];

/** POST — set a marketing opt-in status across a segment of contacts. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`optin:${clientIp(req)}`, 10, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    const body = await readJson(req);
    const segment = (typeof body.segment === "string" && SEGMENTS.includes(body.segment as OptInSegment)
      ? body.segment
      : "all") as OptInSegment;
    const status = (typeof body.status === "string" &&
      (MARKETING_OPT_IN as readonly string[]).includes(body.status)
      ? body.status
      : "") as MarketingOptIn | "";
    if (!status) {
      return NextResponse.json({ error: "Choose a valid opt-in status." }, { status: 400 });
    }

    const { updated } = await bulkSetMarketingOptIn(segment, status);
    return NextResponse.json({ ok: true, updated, segment, status });
  } catch (e) {
    return errorResponse(e);
  }
}
