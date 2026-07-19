import { NextRequest, NextResponse } from "next/server";
import { mergeCompanies, mergeContacts } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Merge a set of duplicate records into one kept "primary". */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`cleanup-merge:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    const body = await readJson(req);
    const type = body.type === "contacts" ? "contacts" : body.type === "companies" ? "companies" : null;
    const primaryId = typeof body.primaryId === "string" ? body.primaryId : "";
    const secondaryIds = (Array.isArray(body.secondaryIds) ? body.secondaryIds : [])
      .filter((x): x is string => typeof x === "string")
      .slice(0, 50);

    if (!type) return NextResponse.json({ error: "Unknown merge type" }, { status: 400 });
    if (!primaryId) return NextResponse.json({ error: "No primary record chosen" }, { status: 400 });
    if (secondaryIds.length === 0) {
      return NextResponse.json({ error: "Nothing to merge" }, { status: 400 });
    }

    const result =
      type === "companies"
        ? await mergeCompanies(primaryId, secondaryIds)
        : await mergeContacts(primaryId, secondaryIds);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
