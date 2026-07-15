import { NextRequest, NextResponse } from "next/server";
import { applyContactLinks, planContactLinks } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Dry run: propose which orphaned contacts we can link, and to which company. */
export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`relink:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    const links = await planContactLinks();
    return NextResponse.json({ links, total: links.length });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Apply a batch of {contactId, companyId} links. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`relink:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    const body = await readJson(req);
    const raw = Array.isArray(body.pairs) ? body.pairs : [];
    const pairs = raw
      .filter((p): p is { contactId: string; companyId: string } =>
        !!p && typeof p === "object" &&
        typeof (p as Record<string, unknown>).contactId === "string" &&
        typeof (p as Record<string, unknown>).companyId === "string",
      )
      .slice(0, 200);
    const linked = await applyContactLinks(pairs);
    return NextResponse.json({ linked });
  } catch (e) {
    return errorResponse(e);
  }
}
