import { NextRequest, NextResponse } from "next/server";
import { deleteEmailTemplate, getEmailTemplate, updateEmailTemplate } from "@/lib/crm/data";
import type { EmailTemplateInput } from "@/lib/crm/types";
import { errorResponse, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function templateInput(b: Record<string, unknown>): EmailTemplateInput {
  const input: EmailTemplateInput = {};
  if (typeof b.name === "string") input.name = b.name;
  if (typeof b.subject === "string") input.subject = b.subject;
  if (typeof b.body === "string") input.body = b.body;
  if (typeof b.description === "string") input.description = b.description;
  return input;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ template: await getEmailTemplate(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const template = await updateEmailTemplate(id, templateInput(await readJson(req)));
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteEmailTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
