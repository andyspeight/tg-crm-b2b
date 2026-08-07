import { NextRequest, NextResponse } from "next/server";
import { listRecentSignals, listSignalsByCompany } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** List signals — recent across the base, or all for one company (?companyId=). */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (companyId) {
      return NextResponse.json({ signals: await listSignalsByCompany(companyId) });
    }
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, limitRaw) : 30;
    return NextResponse.json({ signals: await listRecentSignals({ status, limit }) });
  } catch (e) {
    return errorResponse(e);
  }
}
