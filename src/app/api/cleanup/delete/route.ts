import { NextRequest, NextResponse } from "next/server";
import { deleteCompanies, deleteContacts } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Bulk-delete reviewed junk records (companies or contacts). */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`cleanup-delete:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }
    const body = await readJson(req);
    const type = body.type === "contacts" ? "contacts" : body.type === "companies" ? "companies" : null;
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .filter((x): x is string => typeof x === "string")
      .slice(0, 500);

    if (!type) return NextResponse.json({ error: "Unknown record type" }, { status: 400 });
    if (ids.length === 0) return NextResponse.json({ deleted: 0 });

    const deleted = type === "companies" ? await deleteCompanies(ids) : await deleteContacts(ids);
    return NextResponse.json({ deleted });
  } catch (e) {
    return errorResponse(e);
  }
}
