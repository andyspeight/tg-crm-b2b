import { NextRequest, NextResponse } from "next/server";
import { classifyNote } from "@/lib/ai/classify";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

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
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const companyName = typeof body.companyName === "string" ? body.companyName : undefined;
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
    if (text.length > 5000) {
      return NextResponse.json({ error: "That note is too long to tidy." }, { status: 400 });
    }

    return NextResponse.json(await classifyNote(text, companyName));
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
