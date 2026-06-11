import { NextRequest, NextResponse } from "next/server";
import { deleteActivity } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteActivity(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
