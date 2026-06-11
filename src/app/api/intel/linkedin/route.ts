import { NextRequest, NextResponse } from "next/server";
import { findCompanyByLinkedinOrName, findContactByLinkedin } from "@/lib/crm/data";
import {
  IntelNotConfiguredError,
  detectLinkedInKind,
  getProvider,
  normalizeLinkedInUrl,
} from "@/lib/intel/provider";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Bright Data trigger -> poll -> snapshot can take up to ~a minute.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`intel:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many lookups. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const raw = typeof body.url === "string" ? body.url : "";
    const url = normalizeLinkedInUrl(raw);
    const kind = detectLinkedInKind(url);
    if (!kind) {
      return NextResponse.json(
        { error: "Paste a LinkedIn profile (/in/) or company (/company/) URL." },
        { status: 400 },
      );
    }

    const provider = getProvider();

    if (kind === "profile") {
      const profile = await provider.profileFromUrl(url);
      const [existing, companyMatch] = await Promise.all([
        profile.linkedin ? findContactByLinkedin(profile.linkedin) : Promise.resolve(null),
        profile.companyName
          ? findCompanyByLinkedinOrName(profile.companyLinkedin ?? "", profile.companyName)
          : Promise.resolve(null),
      ]);
      return NextResponse.json({
        kind,
        profile,
        existingContactId: existing?.id ?? null,
        companyMatch: companyMatch ? { id: companyMatch.id, name: companyMatch.name } : null,
      });
    }

    const company = await provider.companyFromUrl(url);
    const existing = await findCompanyByLinkedinOrName(url, company.name);
    return NextResponse.json({ kind, company, existingCompanyId: existing?.id ?? null });
  } catch (e) {
    if (e instanceof IntelNotConfiguredError) {
      return NextResponse.json(
        { error: "LinkedIn import is not configured. Set BRIGHTDATA_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
