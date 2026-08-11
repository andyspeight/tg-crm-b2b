import { NextRequest, NextResponse } from "next/server";
import { getEmailSignature, setEmailSignature } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The email signature HTML appended to every client-facing send. Session-gated. */
export async function GET() {
  try {
    return NextResponse.json({ html: await getEmailSignature() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Save the signature. Body: { html }. Returns the cleaned value stored. */
export async function PUT(req: NextRequest) {
  try {
    const body = await readJson(req);
    const html = await setEmailSignature((body as { html?: unknown }).html);
    return NextResponse.json({ html });
  } catch (e) {
    return errorResponse(e);
  }
}
