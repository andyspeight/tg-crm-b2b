import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/ai/digest-email";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual "email me this digest" — session-gated by the middleware. */
export async function POST() {
  try {
    return NextResponse.json(await sendWeeklyDigest());
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
