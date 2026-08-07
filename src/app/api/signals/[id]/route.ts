import { NextRequest, NextResponse } from "next/server";
import { updateSignalStatus } from "@/lib/crm/data";
import { SIGNAL_STATUSES } from "@/lib/crm/config";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Update a signal's status (Seen / Actioned / Dismissed). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await readJson(req);
    const status = typeof b.status === "string" ? b.status : "";
    if (!(SIGNAL_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    return NextResponse.json({ signal: await updateSignalStatus(id, status) });
  } catch (e) {
    return errorResponse(e);
  }
}
