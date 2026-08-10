import { NextResponse } from "next/server";
import { listAwaitingReply } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Contacts whose last email was inbound — they're waiting on a reply from you. */
export async function GET() {
  try {
    const awaiting = await listAwaitingReply({ withinDays: 30, limit: 12 });
    return NextResponse.json({ awaiting });
  } catch (e) {
    return errorResponse(e);
  }
}
