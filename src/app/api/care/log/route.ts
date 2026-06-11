import { NextRequest, NextResponse } from "next/server";
import { logCareTouch } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const touchId = typeof body.touchId === "string" ? body.touchId : "";
    if (!touchId) {
      return NextResponse.json({ error: "touchId is required" }, { status: 400 });
    }
    const outcomeNotes = typeof body.outcomeNotes === "string" ? body.outcomeNotes : undefined;
    const touchType = typeof body.touchType === "string" ? body.touchType : undefined;
    return NextResponse.json({ touch: await logCareTouch(touchId, { outcomeNotes, touchType }) });
  } catch (e) {
    return errorResponse(e);
  }
}
