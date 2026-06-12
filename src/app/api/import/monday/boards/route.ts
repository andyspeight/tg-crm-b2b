import { NextRequest, NextResponse } from "next/server";
import { listBoards } from "@/lib/monday/boards";
import { MondayError, MondayNotConfiguredError } from "@/lib/monday/client";
import { errorResponse } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`monday:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const boards = await listBoards();
    return NextResponse.json({ boards });
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
