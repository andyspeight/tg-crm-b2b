import { NextResponse } from "next/server";
import { runMonitor } from "@/lib/intel/monitor";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manual "scan now" — session-gated by the middleware. */
export async function POST() {
  try {
    return NextResponse.json(await runMonitor());
  } catch (e) {
    return errorResponse(e);
  }
}
