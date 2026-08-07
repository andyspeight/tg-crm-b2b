import { NextRequest, NextResponse } from "next/server";
import { composeTemplate } from "@/lib/ai/template";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Draft an email template (subject + body) from a short brief. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const b = await readJson(req);
    const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Describe the email you want." }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: "That brief is too long." }, { status: 400 });
    }

    return NextResponse.json(await composeTemplate(prompt));
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
