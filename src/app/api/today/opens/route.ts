import { NextResponse } from "next/server";
import { listRecentOpens } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Recently opened emails / downloaded attachments — the "they're warm" feed. */
export async function GET() {
  try {
    const opens = await listRecentOpens({ sinceDays: 14, limit: 12 });
    return NextResponse.json({ opens });
  } catch (e) {
    return errorResponse(e);
  }
}
