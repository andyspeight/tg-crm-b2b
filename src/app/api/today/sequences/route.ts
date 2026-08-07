import { NextResponse } from "next/server";
import { listSequenceFeed } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Sequence items that need the human: replies to follow up, and failed sends. */
export async function GET() {
  try {
    return NextResponse.json(await listSequenceFeed());
  } catch (e) {
    return errorResponse(e);
  }
}
