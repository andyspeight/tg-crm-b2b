import { NextRequest, NextResponse } from "next/server";
import {
  getCompany,
  listActivitiesByIds,
  listContactsByIds,
  listDealsByIds,
  saveCompanyBrief,
} from "@/lib/crm/data";
import { generateBrief } from "@/lib/ai/brief";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    // Cost control: cap AI calls per IP (travelgenix-security §rate limiting).
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { id } = await params;
    const company = await getCompany(id);
    const [contacts, deals, activities] = await Promise.all([
      listContactsByIds(company.contactIds),
      listDealsByIds(company.dealIds),
      listActivitiesByIds(company.activityIds),
    ]);

    const result = await generateBrief({ company, contacts, deals, activities });
    const updated = await saveCompanyBrief(id, result.brief, result.nextBestAction);

    return NextResponse.json({
      brief: updated.aiBrief ?? result.brief,
      nextBestAction: updated.nextBestAction ?? result.nextBestAction,
    });
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
