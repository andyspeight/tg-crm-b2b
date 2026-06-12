import { NextRequest, NextResponse } from "next/server";
import { getBoardItems } from "@/lib/monday/boards";
import { MondayError, MondayNotConfiguredError } from "@/lib/monday/client";
import type { BoardPreview, BoardValueBreakdown } from "@/lib/monday/types";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

// Monday column types whose values are worth tallying so the mapping can target them.
const BREAKDOWN_TYPES = new Set(["status", "dropdown", "color"]);

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
    if (!boardId) return NextResponse.json({ error: "Missing boardId" }, { status: 400 });

    const { columns, items, capped } = await getBoardItems(boardId);

    const sample = items.slice(0, 12).map((it) => ({
      id: it.id,
      name: it.name,
      cells: columns
        .map((c) => ({ title: c.title, value: it.values[(c.title ?? "").toLowerCase().trim()] ?? "" }))
        .filter((cell) => cell.value)
        .slice(0, 10),
    }));

    const breakdown: BoardValueBreakdown[] = [];
    for (const c of columns) {
      if (!BREAKDOWN_TYPES.has(c.type)) continue;
      const key = (c.title ?? "").toLowerCase().trim();
      const tally = new Map<string, number>();
      for (const it of items) {
        const v = it.values[key];
        if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
      }
      if (tally.size === 0) continue;
      breakdown.push({
        title: c.title,
        type: c.type,
        values: [...tally.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([value, count]) => ({ value, count })),
      });
    }

    const preview: BoardPreview = { itemCount: items.length, capped, sample, breakdown };
    return NextResponse.json(preview);
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
