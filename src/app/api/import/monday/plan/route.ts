import { NextRequest, NextResponse } from "next/server";
import { planCompanies } from "@/lib/monday/mapping";
import { MondayError, MondayNotConfiguredError } from "@/lib/monday/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`monday:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
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
    const sample = plan.toCreate.slice(0, 8).map((c) => ({
      name: c.name,
      website: c.website ?? null,
      country: c.country ?? null,
      sizeBand: c.sizeBand ?? null,
      lifecycleStage: c.lifecycleStage ?? null,
    }));

    return NextResponse.json({
      target,
      total: plan.total,
      willCreate: plan.toCreate.length,
      duplicates: plan.duplicates,
      skipped: plan.skipped,
      sample,
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
