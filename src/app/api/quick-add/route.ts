import { NextRequest, NextResponse } from "next/server";
import { quickAddPerson } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Quick-add a lead/customer: a person + their company + package, in one go. */
export async function POST(req: NextRequest) {
  try {
    const b = await readJson(req);
    const s = (v: unknown) => (typeof v === "string" ? v : undefined);
    const result = await quickAddPerson({
      name: s(b.name),
      email: s(b.email),
      phone: s(b.phone),
      companyName: s(b.companyName) ?? "",
      packageTier: s(b.packageTier),
      lifecycleStage: s(b.lifecycleStage),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
