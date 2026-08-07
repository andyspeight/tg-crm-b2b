import { NextResponse } from "next/server";
import { listDuplicateGroups } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Suggested duplicate-people groups for review. */
export async function GET() {
  try {
    const groups = await listDuplicateGroups();
    return NextResponse.json({ groups });
  } catch (e) {
    return errorResponse(e);
  }
}
