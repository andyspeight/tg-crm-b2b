import { NextResponse } from "next/server";
import { getConnection, googleConfigured } from "@/lib/google/oauth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Is Gmail connected, and as whom. Drives the composer + settings UI. */
export async function GET() {
  try {
    const conn = await getConnection();
    return NextResponse.json({
      configured: googleConfigured(),
      connected: !!conn,
      email: conn?.email,
      name: conn?.name,
      connectedAt: conn?.connectedAt,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
