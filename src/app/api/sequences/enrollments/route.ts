import { NextRequest, NextResponse } from "next/server";
import { listEnrollments } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** List enrollments, optionally filtered to one sequence (?sequenceId=…). */
export async function GET(req: NextRequest) {
  try {
    const sequenceId = req.nextUrl.searchParams.get("sequenceId") || undefined;
    return NextResponse.json({ enrollments: await listEnrollments(sequenceId) });
  } catch (e) {
    return errorResponse(e);
  }
}
