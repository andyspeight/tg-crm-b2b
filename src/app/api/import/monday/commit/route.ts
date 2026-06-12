import { NextRequest, NextResponse } from "next/server";
import { planCompanies } from "@/lib/monday/mapping";
import { createCompaniesBatch } from "@/lib/crm/data";
import { MondayError, MondayNotConfiguredError } from "@/lib/monday/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Writes up to ~1,500 records in batches of 10; allow headroom.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`monday-commit:${clientIp(req)}`, 6, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many import runs. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const target = typeof body.target === "string" ? body.target : "";
    if (!boardId) return NextResponse.json({ error: "Missing boardId" }, { status: 400 });
    if (target !== "companies") {
      return NextResponse.json({ error: "Only the Companies import is ready so far." }, { status: 400 });
    }

    const plan = await planCompanies(boardId);
    const created = await createCompaniesBatch(plan.toCreate);

    return NextResponse.json({
      target,
      created,
      duplicates: plan.duplicates,
      skipped: plan.skipped,
    });
  } catch (e) {
    if (e instanceof MondayNotConfiguredError) {
      return NextResponse.json(
        { error: "Monday import is not configured. Set MONDAY_API_TOKEN in Vercel." },
        { status: 503 },
      );
    }
    if (e instanceof MondayError) {
      const status = e.status >= 400 && e.status < 500 ? e.status : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return errorResponse(e);
  }
}
