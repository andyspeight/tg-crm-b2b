import { NextRequest, NextResponse } from "next/server";
import { enrollContact } from "@/lib/email/sequence-engine";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Enrol one contact into this sequence (first step scheduled per its delay). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await readJson(req);
    const contactId = typeof b.contactId === "string" ? b.contactId.trim() : "";
    if (!contactId) return NextResponse.json({ error: "Pick a contact to enrol." }, { status: 400 });
    const enrollment = await enrollContact(id, contactId);
    return NextResponse.json({ enrollment });
  } catch (e) {
    return errorResponse(e);
  }
}
