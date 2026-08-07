import { NextRequest, NextResponse } from "next/server";
import { createSequence, listSequences } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import type { SequenceInput } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

/** Copy only the sequence fields present in the body (avoid clobbering with undefined). */
function sequenceInput(b: Record<string, unknown>): SequenceInput {
  const input: SequenceInput = {};
  if (typeof b.name === "string") input.name = b.name;
  if (typeof b.description === "string") input.description = b.description;
  if (typeof b.status === "string") input.status = b.status as SequenceInput["status"];
  if (Array.isArray(b.steps)) input.steps = b.steps as SequenceInput["steps"];
  return input;
}

export async function GET() {
  try {
    return NextResponse.json({ sequences: await listSequences() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const sequence = await createSequence(sequenceInput(b));
    return NextResponse.json({ sequence });
  } catch (e) {
    return errorResponse(e);
  }
}
