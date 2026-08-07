import { NextResponse } from "next/server";
import { runInboxSync } from "@/lib/google/inbox-sync";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manual "sync now" — session-gated by the middleware. */
export async function POST() {
  try {
    return NextResponse.json(await runInboxSync());
  } catch (e) {
    return errorResponse(e);
  }
}
