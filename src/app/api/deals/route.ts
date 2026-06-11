import { NextRequest, NextResponse } from "next/server";
import { createDeal, listDeals, listDealsByCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (companyId) {
      return NextResponse.json({ deals: await listDealsByCompany(companyId) });
    }
    const q = req.nextUrl.searchParams.get("q") || undefined;
    return NextResponse.json({ deals: await listDeals({ q }) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const deal = await createDeal(await readJson(req));
    return NextResponse.json({ deal }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
