import { NextResponse } from "next/server";
import { listCareBoard } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json({ rows: await listCareBoard() });
  } catch (e) {
    return errorResponse(e);
  }
}
