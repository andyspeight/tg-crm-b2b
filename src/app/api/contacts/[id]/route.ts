import { NextRequest, NextResponse } from "next/server";
import { applyLeadCustomerStatus, deleteContact, getContact, updateContact } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ contact: await getContact(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const contact = await updateContact(id, body);
    if ((body.setStatus === "customer" || body.setStatus === "lead") && contact.companyId) {
      await applyLeadCustomerStatus(contact.companyId, body.setStatus);
    }
    return NextResponse.json({ contact });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
