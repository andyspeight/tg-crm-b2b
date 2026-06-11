import { NextRequest, NextResponse } from "next/server";
import { createContact, listContacts, listContactsByCompany } from "@/lib/crm/data";
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
    const contact = await createContact(await readJson(req));
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
