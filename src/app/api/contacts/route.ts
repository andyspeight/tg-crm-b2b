import { NextRequest, NextResponse } from "next/server";
import {
  applyLeadCustomerStatus,
  createContact,
  listContacts,
  listContactsByCompany,
} from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (companyId) {
      return NextResponse.json({ contacts: await listContactsByCompany(companyId) });
    }
    const q = req.nextUrl.searchParams.get("q") || undefined;
    return NextResponse.json({ contacts: await listContacts({ q }) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const contact = await createContact(body);
    if ((body.setStatus === "customer" || body.setStatus === "lead") && contact.companyId) {
      await applyLeadCustomerStatus(contact.companyId, body.setStatus);
    }
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
