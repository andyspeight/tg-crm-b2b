import { NextResponse } from "next/server";
import { runDueSequences } from "@/lib/email/sequence-engine";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual "send due steps now" — session-gated by the middleware. */
export async function POST() {
  try {
    return NextResponse.json(await runDueSequences());
  } catch (e) {
    return errorResponse(e);
  }
}
