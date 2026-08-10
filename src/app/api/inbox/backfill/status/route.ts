import { NextResponse } from "next/server";
import { inboxBackfillStatus } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Progress readout for the deep-history backfill (contacts done / remaining, reach). */
export async function GET() {
  try {
    return NextResponse.json(await inboxBackfillStatus());
  } catch (e) {
    return errorResponse(e);
  }
}
