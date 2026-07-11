import { NextRequest, NextResponse } from "next/server";
import { askLuna } from "@/lib/ai/ask";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// The tool-use loop makes several model round-trips; give it room.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
    if (question.length > 500) {
      return NextResponse.json({ error: "Question is too long." }, { status: 400 });
    }

    const result = await askLuna(question);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured. Set ANTHROPIC_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
