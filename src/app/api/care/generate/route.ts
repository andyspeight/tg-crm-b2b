import { NextResponse } from "next/server";
import { generateDueTouches } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export async function POST() {
  try {
    return NextResponse.json({ created: await generateDueTouches() });
  } catch (e) {
    return errorResponse(e);
  }
}
