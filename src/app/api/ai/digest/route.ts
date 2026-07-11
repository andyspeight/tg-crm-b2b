import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/ai/digest";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    return NextResponse.json(await generateDigest());
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
