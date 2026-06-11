"use client";

import { Badge, type BadgeColor } from "@/components/ui";
import type { AccountHealth, DealStage, LifecycleStage } from "@/lib/crm/types";

const HEALTH: Record<string, BadgeColor> = { Green: "green", Amber: "amber", Red: "red" };
export function HealthBadge({ value }: { value?: AccountHealth }) {
  if (!value) return null;
  return <Badge color={HEALTH[value] ?? "slate"}>{value}</Badge>;
}

const LIFECYCLE: Record<string, BadgeColor> = {
  Prospect: "slate",
  Engaged: "blue",
  Opportunity: "indigo",
  Customer: "green",
  "At Risk": "amber",
  "Lost / Churned": "red",
};
export function LifecycleBadge({ value }: { value?: LifecycleStage }) {
  if (!value) return null;
  return <Badge color={LIFECYCLE[value] ?? "slate"}>{value}</Badge>;
}

const STAGE: Record<string, BadgeColor> = {
  "New Lead": "slate",
  Contacted: "slate",
  "Demo Booked": "blue",
  "Demo Done": "blue",
  Proposal: "indigo",
  Negotiation: "purple",
  Won: "green",
  Lost: "red",
};
export function StageBadge({ value }: { value?: DealStage }) {
  if (!value) return null;
  return <Badge color={STAGE[value] ?? "slate"}>{value}</Badge>;
}
