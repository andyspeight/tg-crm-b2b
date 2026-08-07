import { NextRequest, NextResponse } from "next/server";
import { deleteSequence, getSequence, updateSequence } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import type { SequenceInput } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function sequenceInput(b: Record<string, unknown>): SequenceInput {
  const input: SequenceInput = {};
  if (typeof b.name === "string") input.name = b.name;
  if (typeof b.description === "string") input.description = b.description;
  if (typeof b.status === "string") input.status = b.status as SequenceInput["status"];
  if (Array.isArray(b.steps)) input.steps = b.steps as SequenceInput["steps"];
  return input;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ sequence: await getSequence(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await readJson(req);
    const sequence = await updateSequence(id, sequenceInput(b));
    return NextResponse.json({ sequence });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteSequence(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
