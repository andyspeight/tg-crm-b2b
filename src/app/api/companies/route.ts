import { NextRequest, NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    return NextResponse.json({ companies: await listCompanies({ q }) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const company = await createCompany(await readJson(req));
    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
