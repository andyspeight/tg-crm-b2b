import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompany } from "@/lib/crm/data";
import type { CompanyInput, SizeBand } from "@/lib/crm/types";
import { SIZE_BANDS } from "@/lib/crm/config";
import { IntelNotConfiguredError, getProvider } from "@/lib/intel/provider";
import type { EnrichedCompanyData } from "@/lib/intel/types";
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

    const provider = getProvider();
    let data: EnrichedCompanyData | null;
    if (company.linkedin) {
      data = await provider.companyFromUrl(company.linkedin);
    } else {
      // Name-only record: find it on LinkedIn from the name first.
      data = await provider.discoverCompany(company.name);
    }
    if (!data) {
      return NextResponse.json(
        { error: `Couldn't find "${company.name}" on LinkedIn. Add its LinkedIn URL and try again.` },
        { status: 404 },
      );
    }

    const patch: CompanyInput = {
      enrichedAt: new Date().toISOString(),
      enrichmentSource: company.linkedin ? "LinkedIn (Bright Data)" : "Discovered via Bright Data",
    };
    if (data.description) patch.description = data.description;
    if (data.sizeBand && (SIZE_BANDS as readonly string[]).includes(data.sizeBand)) {
      patch.sizeBand = data.sizeBand as SizeBand;
    }
    if (data.country && !company.country) patch.country = data.country;
    if (data.website && !company.website) patch.website = data.website;
    if (data.linkedin && !company.linkedin) patch.linkedin = data.linkedin;

    const updated = await updateCompany(id, patch);
    return NextResponse.json({ company: updated });
  } catch (e) {
    if (e instanceof IntelNotConfiguredError) {
      return NextResponse.json(
        { error: "Enrichment is not configured. Set BRIGHTDATA_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    if (e instanceof Error && /Bright Data/i.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return errorResponse(e);
  }
}
