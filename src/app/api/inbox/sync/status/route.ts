import { NextResponse } from "next/server";
import { inboxSyncStatus } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Progress readout for the inbox sync (contacts synced / remaining, reach). */
export async function GET() {
  try {
    return NextResponse.json(await inboxSyncStatus());
  } catch (e) {
    return errorResponse(e);
  }
}
