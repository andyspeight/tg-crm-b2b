import { NextRequest, NextResponse } from "next/server";
import { planCompanies, planContacts, planDeals } from "@/lib/monday/mapping";
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
    let total = 0;
    let duplicates = 0;
    let skipped = 0;
    let willCreate = 0;
    let sample: { primary: string; detail: string }[] = [];

    if (target === "companies") {
      const plan = await planCompanies(boardId);
      ({ total, duplicates, skipped } = plan);
      willCreate = plan.toCreate.length;
      sample = plan.toCreate.slice(0, 8).map((c) => ({
        primary: c.name ?? "(no name)",
        detail: [c.website, c.country, c.sizeBand].filter(Boolean).join(" · ") || "name only",
      }));
    } else if (target === "contacts") {
      const plan = await planContacts(boardId);
      ({ total, duplicates, skipped } = plan);
      willCreate = plan.toCreate.length;
      sample = plan.toCreate.slice(0, 8).map((c) => ({
        primary: c.name ?? "(no name)",
        detail: [c.email, c.companyId ? "→ company" : null].filter(Boolean).join(" · ") || "no email",
      }));
    } else if (target === "deals") {
      const plan = await planDeals(boardId);
      ({ total, duplicates, skipped } = plan);
      willCreate = plan.toCreate.length;
      sample = plan.toCreate.slice(0, 8).map((c) => ({
        primary: c.name ?? "(no name)",
        detail:
          [c.stage, c.mrr != null ? `£${c.mrr}` : null, c.companyId ? "→ company" : null]
            .filter(Boolean)
            .join(" · ") || "—",
      }));
    } else {
      return NextResponse.json({ error: "This board's import isn't ready yet." }, { status: 400 });
    }

    return NextResponse.json({ target, total, willCreate, duplicates, skipped, sample });
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
