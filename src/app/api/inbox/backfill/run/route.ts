import { NextResponse } from "next/server";
import { runInboxBackfill } from "@/lib/google/inbox-sync";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One bounded deep-history backfill pass — session-gated by the middleware. */
export async function POST() {
  try {
    return NextResponse.json(await runInboxBackfill());
  } catch (e) {
    return errorResponse(e);
  }
}
