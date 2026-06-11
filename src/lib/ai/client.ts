import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Default to the latest, most capable model (claude-api skill). */
export const AI_MODEL = "claude-opus-4-8";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "AiNotConfiguredError";
  }
}

let cached: Anthropic | null = null;

/** Server-side Anthropic client. The key is read from the env and never reaches the client. */
export function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  if (!cached) cached = new Anthropic({ apiKey });
  return cached;
}

/** Extract concatenated text from a messages response, ignoring thinking blocks. */
export function textFrom(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Parse a JSON object from model output, tolerating ```json fences. */
export function parseJsonObject(text: string): Record<string, unknown> {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t) as Record<string, unknown>;
}
