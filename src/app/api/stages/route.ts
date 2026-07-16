import { NextRequest, NextResponse } from "next/server";
import { applyStageChanges, getPipelineStages } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The live pipeline columns. */
export async function GET() {
  try {
    return NextResponse.json({ stages: await getPipelineStages() });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Replace the pipeline. Body: { stages: PipelineStage[], renames?: [{from,to}],
 * removals?: [{name, moveTo}] }. Renames/removals cascade onto existing deals.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await readJson(req);
    const stages = await applyStageChanges({
      stages: body.stages,
      renames: Array.isArray(body.renames) ? (body.renames as { from: string; to: string }[]) : [],
      removals: Array.isArray(body.removals)
        ? (body.removals as { name: string; moveTo: string }[])
        : [],
    });
    return NextResponse.json({ stages });
  } catch (e) {
    return errorResponse(e);
  }
}
