import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    return NextResponse.json(await searchAll(q));
  } catch (e) {
    return errorResponse(e);
  }
}
