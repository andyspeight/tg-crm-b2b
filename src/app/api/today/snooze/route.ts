import { NextRequest, NextResponse } from "next/server";
import { snoozeAction } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Snooze one "Needs you today" item for 7 days. */
export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const key = typeof b.key === "string" ? b.key : "";
    if (!key.trim()) return NextResponse.json({ error: "Missing key." }, { status: 400 });
    await snoozeAction(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
