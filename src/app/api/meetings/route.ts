import { NextRequest, NextResponse } from "next/server";
import { getMeetingConfig, setMeetingConfig } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The scheduler config (host, widget id, meeting options). Session-gated. */
export async function GET() {
  try {
    return NextResponse.json(await getMeetingConfig());
  } catch (e) {
    return errorResponse(e);
  }
}

/** Save the scheduler config. Returns the cleaned value stored. */
export async function PUT(req: NextRequest) {
  try {
    const body = await readJson(req);
    return NextResponse.json(await setMeetingConfig(body));
  } catch (e) {
    return errorResponse(e);
  }
}
