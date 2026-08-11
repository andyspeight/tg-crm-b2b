import { NextRequest, NextResponse } from "next/server";
import { findDripSequenceForTemplate } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Does this template kick off an active drip? Powers the composer's
 * "send the intro, then start the drip" toggle. Returns the matching sequence
 * (id, name, number of follow-ups) or null.
 */
export async function GET(req: NextRequest) {
  try {
    const templateId = req.nextUrl.searchParams.get("templateId") || "";
    const seq = await findDripSequenceForTemplate(templateId);
    if (!seq) return NextResponse.json({ sequence: null });
    return NextResponse.json({
      sequence: { id: seq.id, name: seq.name, followUps: Math.max(0, seq.steps.length - 1) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
