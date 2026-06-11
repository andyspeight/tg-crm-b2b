import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompany } from "@/lib/crm/data";
import type { CompanyInput, SizeBand } from "@/lib/crm/types";
import { SIZE_BANDS } from "@/lib/crm/config";
import { IntelNotConfiguredError, getProvider } from "@/lib/intel/provider";
import { errorResponse } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const limit = rateLimit(`intel:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many lookups. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { id } = await params;
    const company = await getCompany(id);
    if (!company.linkedin) {
      return NextResponse.json(
        { error: "Add the company's LinkedIn URL first, then enrich." },
        { status: 400 },
      );
    }

    const data = await getProvider().companyFromUrl(company.linkedin);

    const patch: CompanyInput = {
      enrichedAt: new Date().toISOString(),
      enrichmentSource: "LinkedIn (Bright Data)",
    };
    if (data.description) patch.description = data.description;
    if (data.sizeBand && (SIZE_BANDS as readonly string[]).includes(data.sizeBand)) {
      patch.sizeBand = data.sizeBand as SizeBand;
    }
    if (data.country && !company.country) patch.country = data.country;
    if (data.website && !company.website) patch.website = data.website;

    const updated = await updateCompany(id, patch);
    return NextResponse.json({ company: updated });
  } catch (e) {
    if (e instanceof IntelNotConfiguredError) {
      return NextResponse.json(
        { error: "Enrichment is not configured. Set BRIGHTDATA_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
