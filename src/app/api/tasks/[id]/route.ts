import { NextRequest, NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ task: await updateTask(id, await readJson(req)) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
