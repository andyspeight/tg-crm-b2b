import { NextRequest, NextResponse } from "next/server";
import { createEmailTemplate, listEmailTemplates } from "@/lib/crm/data";
import type { EmailTemplateInput } from "@/lib/crm/types";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Only copy keys the caller actually sent, so a create/patch never clobbers a
 *  field with an accidental undefined. */
function templateInput(b: Record<string, unknown>): EmailTemplateInput {
  const input: EmailTemplateInput = {};
  if (typeof b.name === "string") input.name = b.name;
  if (typeof b.subject === "string") input.subject = b.subject;
  if (typeof b.body === "string") input.body = b.body;
  if (typeof b.description === "string") input.description = b.description;
  return input;
}

export async function GET() {
  try {
    return NextResponse.json({ templates: await listEmailTemplates() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const template = await createEmailTemplate(templateInput(await readJson(req)));
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
