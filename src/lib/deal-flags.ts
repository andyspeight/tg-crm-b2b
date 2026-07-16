import type { Deal } from "@/lib/crm/types";

/** Date-only "is this in the past" check. */
export function isPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function daysSince(s?: string): number {
  if (!s) return Infinity;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/**
 * One priority flag for a deal, shared by the pipeline and the Today view.
 * Missing next step and 30-day staleness are red; overdue next step and
 * 14-day staleness are amber. Closed deals never flag — callers that know the
 * stage's kind (won/lost) pass isClosed; otherwise we fall back to the default
 * stage names.
 */
export function dealFlag(
  deal: Deal,
  lastActivity?: string,
  isClosed: boolean = deal.stage === "Won" || deal.stage === "Lost",
): { label: string; danger: boolean } | null {
  if (isClosed) return null;
  if (!deal.nextStep && !deal.nextStepDate) return { label: "No next step", danger: true };
  const stale = daysSince(lastActivity);
  if (stale >= 30) return { label: "Stale 30d+", danger: true };
  if (isPast(deal.nextStepDate)) return { label: "Overdue", danger: false };
  if (stale >= 14) return { label: "Stale 14d+", danger: false };
  return null;
}
