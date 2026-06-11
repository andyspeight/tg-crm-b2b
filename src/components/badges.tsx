"use client";

import { Badge, type BadgeColor } from "@/components/ui";
import type { AccountHealth, DealStage, LifecycleStage } from "@/lib/crm/types";

const HEALTH: Record<string, BadgeColor> = { Green: "success", Amber: "warning", Red: "danger" };
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

const STAGE: Record<string, BadgeColor> = {
  "New Lead": "neutral",
  Contacted: "neutral",
  "Demo Booked": "info",
  "Demo Done": "info",
  Proposal: "accent",
  Negotiation: "navy",
  Won: "success",
  Lost: "danger",
};
export function StageBadge({ value }: { value?: DealStage }) {
  if (!value) return null;
  return <Badge color={STAGE[value] ?? "neutral"}>{value}</Badge>;
}
