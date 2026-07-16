"use client";

import { Badge, type BadgeColor } from "@/components/ui";
import type { AccountHealth, DealStage, LifecycleStage } from "@/lib/crm/types";

const HEALTH: Record<string, BadgeColor> = { Green: "success", Amber: "warning", Red: "danger" };
export function healthColor(value?: string): BadgeColor {
  return HEALTH[value ?? ""] ?? "neutral";
}
export function HealthBadge({ value }: { value?: AccountHealth }) {
  if (!value) return null;
  return <Badge color={HEALTH[value] ?? "neutral"}>{value}</Badge>;
}

const LIFECYCLE: Record<string, BadgeColor> = {
  Prospect: "neutral",
  Engaged: "info",
  Opportunity: "accent",
  Customer: "success",
  "At Risk": "warning",
  "Lost / Churned": "danger",
};
export function LifecycleBadge({ value }: { value?: LifecycleStage }) {
  if (!value) return null;
  return <Badge color={LIFECYCLE[value] ?? "neutral"}>{value}</Badge>;
}

// A deliberate gradient so the pipeline reads as progress, not a grey wall.
const STAGE: Record<string, BadgeColor> = {
  "New Lead": "neutral",
  Contacted: "info",
  "Demo Booked": "info",
  "Demo Done": "info",
  Proposal: "accent",
  Negotiation: "navy",
  Won: "success",
  Lost: "danger",
};
/** Default stage colour by name (fallback for custom stages that pass their own). */
export function stageColor(value?: string): BadgeColor {
  return STAGE[value ?? ""] ?? "neutral";
}
export function StageBadge({ value, color }: { value?: DealStage; color?: BadgeColor }) {
  if (!value) return null;
  return <Badge color={color ?? STAGE[value] ?? "neutral"}>{value}</Badge>;
}
