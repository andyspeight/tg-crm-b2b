import { NextRequest, NextResponse } from "next/server";
import { deleteEnrollment, getEnrollment, updateEnrollment } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import type { EnrollmentInput } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Pause / resume / stop one enrollment. Resume re-arms it to send on the next tick. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await readJson(req);
    const action = typeof b.action === "string" ? b.action : "";

    let patch: EnrollmentInput;
    if (action === "pause") {
      patch = { status: "Paused" };
    } else if (action === "resume") {
      const current = await getEnrollment(id);
      if (current.status !== "Paused") {
        return NextResponse.json({ error: "Only a paused enrollment can be resumed." }, { status: 400 });
      }
      patch = { status: "Active", nextSendAt: new Date().toISOString(), lastError: "" };
    } else if (action === "stop") {
      patch = { status: "Stopped", completedAt: new Date().toISOString() };
    } else if (action === "retry") {
      // Re-arm a failed (or stopped) enrollment to send again on the next tick.
      patch = { status: "Active", nextSendAt: new Date().toISOString(), completedAt: "", lastError: "" };
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const enrollment = await updateEnrollment(id, patch);
    return NextResponse.json({ enrollment });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteEnrollment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
