import { NextResponse } from "next/server";
import { disconnect } from "@/lib/google/oauth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Revoke at Google (best-effort) and clear the stored connection. */
export async function POST() {
  try {
    await disconnect();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
