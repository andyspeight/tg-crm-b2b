import { NextRequest, NextResponse } from "next/server";
import { addTemplateAttachment, removeTemplateAttachment } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Uploads go through the request body as base64, so keep files modest — Airtable
// re-hosts them and the whole payload must fit the serverless body limit.
const MAX_BASE64 = 4_500_000; // ~3.3 MB file

/** Upload one attachment onto a template (base64 in the JSON body). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await readJson(req);
    const filename = typeof b.filename === "string" ? b.filename.trim() : "";
    const contentType = typeof b.contentType === "string" ? b.contentType : "application/octet-stream";
    const base64 = typeof b.base64 === "string" ? b.base64 : "";

    if (!filename) return NextResponse.json({ error: "Missing file name." }, { status: 400 });
    if (!base64) return NextResponse.json({ error: "Empty file." }, { status: 400 });
    if (base64.length > MAX_BASE64) {
      return NextResponse.json(
        { error: "That file is too large — keep attachments under about 3 MB." },
        { status: 413 },
      );
    }

    const template = await addTemplateAttachment(id, { filename, contentType, base64 });
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Remove one attachment (?attachmentId=…) from a template. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const attachmentId = req.nextUrl.searchParams.get("attachmentId");
    if (!attachmentId) {
      return NextResponse.json({ error: "Missing attachmentId." }, { status: 400 });
    }
    const template = await removeTemplateAttachment(id, attachmentId);
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}
