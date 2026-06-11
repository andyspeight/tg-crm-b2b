import { NextRequest, NextResponse } from "next/server";
import { createActivity, listActivitiesByCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    return NextResponse.json({ activities: await listActivitiesByCompany(companyId) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const activity = await createActivity(await readJson(req));
    return NextResponse.json({ activity }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
