import { NextRequest, NextResponse } from "next/server";
import { dismissReply } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Ignore (permanent) or pause (back tomorrow) one awaiting-reply row. */
export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const key = typeof b.key === "string" ? b.key : "";
    const mode = b.mode === "ignore" ? "ignore" : "pause";
    if (!key.trim()) return NextResponse.json({ error: "Missing key." }, { status: 400 });
    await dismissReply(key, mode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
