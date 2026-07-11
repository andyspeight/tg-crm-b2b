import "server-only";
import { anthropic, parseJsonObject, textFrom } from "./client";
import { ACTIVITY_TYPES } from "@/lib/crm/config";

/** Fast model for a quick, interactive tidy. */
const MODEL = "claude-sonnet-5";

export interface ClassifiedNote {
  summary: string;
  type: string;
  tasks: { title: string; dueDate?: string }[];
}

/** Tidy a paste-dump note into a summary + activity type + any follow-up tasks. */
export async function classifyNote(text: string, companyName?: string): Promise<ClassifiedNote> {
  const today = new Date().toISOString().slice(0, 10);
  const system = `You tidy and file a note for Travelgenix's internal B2B CRM. Return ONLY a JSON object, no prose.
Today is ${today}. UK English. Be faithful to the note — never invent facts or people.

Shape:
{
  "summary": "one clear sentence capturing what happened",
  "type": "one of: ${ACTIVITY_TYPES.join(", ")}",
  "tasks": [ { "title": "a follow-up action", "dueDate": "YYYY-MM-DD (omit if none implied)" } ]
}

Rules:
- summary: a single, natural sentence. No throat-clearing, no "the user"; write as a colleague would.
- type: match what the note describes — a phone call is Call, a meeting is Meeting, an email is Email, a product demo is Demo, otherwise Note.
- tasks: only genuine follow-ups the note calls for (0–3). Resolve relative dates (e.g. "next Friday") against today. Empty array if there are none.`;

  const user = companyName ? `Company: ${companyName}\n\nNote:\n${text}` : `Note:\n${text}`;

  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw = parseJsonObject(textFrom(msg));
  const type =
    typeof raw.type === "string" && (ACTIVITY_TYPES as readonly string[]).includes(raw.type)
      ? raw.type
      : "Note";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .map((t) => ({
          title: typeof t.title === "string" ? t.title.trim() : "",
          dueDate: typeof t.dueDate === "string" && t.dueDate.trim() ? t.dueDate.trim() : undefined,
        }))
        .filter((t) => t.title)
        .slice(0, 3)
    : [];

  return { summary, type, tasks };
}
