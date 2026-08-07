import { NextRequest, NextResponse } from "next/server";
import { dismissSequenceFeedItem } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Hide one enrollment from the Today sequences feed. */
export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const id = typeof b.id === "string" ? b.id : "";
    if (!id.trim()) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await dismissSequenceFeedItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
