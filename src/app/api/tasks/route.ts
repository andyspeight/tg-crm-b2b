import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasksByCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    return NextResponse.json({ tasks: await listTasksByCompany(companyId) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const task = await createTask(await readJson(req));
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
