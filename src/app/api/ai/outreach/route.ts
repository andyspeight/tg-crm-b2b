import { NextRequest, NextResponse } from "next/server";
import {
  getCompany,
  listActivitiesByIds,
  listContactsByIds,
  listDealsByIds,
} from "@/lib/crm/data";
import { generateOutreach } from "@/lib/ai/outreach";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    const goal = typeof body.goal === "string" ? body.goal : undefined;
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const company = await getCompany(companyId);
    const [contacts, deals, activities] = await Promise.all([
      listContactsByIds(company.contactIds),
      listDealsByIds(company.dealIds),
      listActivitiesByIds(company.activityIds),
    ]);
    const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined;

    const result = await generateOutreach({ company, contact, deals, activities, goal });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured. Set ANTHROPIC_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
