import { NextRequest, NextResponse } from "next/server";
import { updateSignalStatus } from "@/lib/crm/data";
import { SIGNAL_STATUSES } from "@/lib/crm/config";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Set the status on several signals at once (bulk triage). */
export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const status = typeof b.status === "string" ? b.status : "";
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : [];
    if (!(SIGNAL_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (ids.length === 0) return NextResponse.json({ error: "No signals selected." }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: "Too many at once (max 100)." }, { status: 400 });

    let updated = 0;
    for (const id of ids) {
      try {
        await updateSignalStatus(id, status);
        updated += 1;
      } catch (e) {
        console.error("[signals/bulk] failed for", id, e);
      }
    }
    return NextResponse.json({ updated });
  } catch (e) {
    return errorResponse(e);
  }
}
