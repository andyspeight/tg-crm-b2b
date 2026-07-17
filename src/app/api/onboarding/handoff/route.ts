import { NextRequest, NextResponse } from "next/server";
import { startOnboarding } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Start onboarding for a company: hand it off to tg-onboarding and mark it Customer. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`onboarding:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    const b = await readJson(req);
    const companyId = typeof b.companyId === "string" ? b.companyId : "";
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    const result = await startOnboarding(companyId, {
      contactId: typeof b.contactId === "string" ? b.contactId : undefined,
      plan: typeof b.plan === "string" ? b.plan : undefined,
      startDate: typeof b.startDate === "string" ? b.startDate : undefined,
      accountManager: typeof b.accountManager === "string" ? b.accountManager : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
