import { NextRequest, NextResponse } from "next/server";
import { createTask, getSignal, updateSignalStatus } from "@/lib/crm/data";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Turn a signal into a follow-up task on its account, and mark the signal actioned. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const signal = await getSignal(id);

    const headline = (signal.headline || "this signal").slice(0, 180);
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const task = await createTask({
      title: `Follow up: ${headline}`,
      companyId: signal.companyId,
      dueDate: due,
      status: "Open",
      createdBy: "AI-Suggested",
    });

    const updated = await updateSignalStatus(id, "Actioned").catch(() => signal);
    return NextResponse.json({ task, signal: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
