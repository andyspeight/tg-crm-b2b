import { NextRequest, NextResponse } from "next/server";
import { listCareTouchesByCompany, logCareTouchForCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ touches: await listCareTouchesByCompany(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Log a care touch against this company and schedule the next per its cadence. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const outcomeNotes = typeof body.outcomeNotes === "string" ? body.outcomeNotes : undefined;
    const touchType = typeof body.touchType === "string" ? body.touchType : undefined;
    const touch = await logCareTouchForCompany(id, { outcomeNotes, touchType });
    return NextResponse.json({ touch });
  } catch (e) {
    return errorResponse(e);
  }
}
