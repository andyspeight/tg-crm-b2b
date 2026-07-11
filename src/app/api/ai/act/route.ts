import { NextRequest, NextResponse } from "next/server";
import { createActivity, createTask, getCompany, logCareTouchForCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

/**
 * Executes a single action that Ask Luna drafted and the user explicitly
 * confirmed. The write is deterministic here — the model never runs it.
 */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`act:${clientIp(req)}`, 40, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many actions. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const action = (body.action ?? {}) as { type?: unknown; params?: unknown };
    const type = typeof action.type === "string" ? action.type : "";
    const params = (action.params ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : undefined);

    if (type === "task") {
      const title = s("title");
      if (!title) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
      const task = await createTask({
        title,
        dueDate: s("dueDate"),
        companyId: s("companyId"),
        createdBy: "AI-Suggested",
      });
      const href = task.companyId ? `/companies/${task.companyId}` : "/today";
      return NextResponse.json({ ok: true, message: `Task created: ${task.title}`, record: { name: task.title, href } });
    }

    if (type === "care_touch") {
      const companyId = s("companyId");
      if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });
      await logCareTouchForCompany(companyId, { outcomeNotes: s("outcomeNotes"), touchType: s("touchType") });
      const company = await getCompany(companyId);
      return NextResponse.json({
        ok: true,
        message: `Care touch logged for ${company.name}`,
        record: { name: company.name, href: `/companies/${companyId}` },
      });
    }

    if (type === "note") {
      const companyId = s("companyId");
      const text = s("text");
      if (!companyId || !text) {
        return NextResponse.json({ error: "companyId and text are required." }, { status: 400 });
      }
      await createActivity({ type: "Note", summary: text, companyId, source: "AI" });
      const company = await getCompany(companyId);
      return NextResponse.json({
        ok: true,
        message: `Note added to ${company.name}`,
        record: { name: company.name, href: `/companies/${companyId}` },
      });
    }

    return NextResponse.json({ error: "Unknown action type." }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
