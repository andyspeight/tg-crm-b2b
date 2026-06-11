"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CircleDashed, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { DEAL_STAGES } from "@/lib/crm/config";
import type { Deal, DealStage } from "@/lib/crm/types";
import { Button, ErrorText, IconButton, Modal } from "@/components/ui";
import { DealForm, type CompanyOption } from "@/components/forms";
import { formatMoney } from "@/lib/format";

const CLOSED: DealStage[] = ["Won", "Lost"];

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function PipelineView({
  initial,
  companies,
  recency,
}: {
  initial: Deal[];
  companies: CompanyOption[];
  recency: { byDeal: Record<string, string>; byCompany: Record<string, string> };
}) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<DealStage | null>(null);
  const [error, setError] = useState("");

  const byStage = useMemo(() => {
    const map = new Map<DealStage, Deal[]>();
    for (const stage of DEAL_STAGES) map.set(stage, []);
    for (const d of deals) {
      if (d.stage && map.has(d.stage)) map.get(d.stage)!.push(d);
      else map.get("New Lead")!.push(d);
    }
    return map;
  }, [deals]);

  async function moveDeal(id: string, stage: DealStage) {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    const prev = deals;
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d)));
    setError("");
    try {
      await api(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    } catch {
      setDeals(prev);
      setError("Could not move that deal. Please try again.");
    }
  }

  async function addDeal(payload: Record<string, unknown>) {
    await api("/api/deals", { method: "POST", body: JSON.stringify(payload) });
    setQuickAdd(null);
    const data = await api<{ deals: Deal[] }>("/api/deals");
    setDeals(data.deals);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Pipeline</h1>
          <p className="text-[13px] text-fg-subtle">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} · drag a card or use the stage
            menu to move it
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setQuickAdd("New Lead")}>
            <Plus size={16} strokeWidth={2} /> New deal
          </Button>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {DEAL_STAGES.map((stage) => {
          const items = byStage.get(stage) ?? [];
          const total = items.reduce((s, d) => s + (d.mrr ?? 0), 0);
          const active = dragOver === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOver(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveDeal(id, stage);
                setDragOver(null);
              }}
              className={`flex w-[264px] shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors ${
                active ? "border-accent ring-1 ring-accent" : "border-border-soft"
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <h2 className="text-[13px] font-semibold text-fg">{stage}</h2>
                <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
                  {items.length}
                </span>
                <span className="tnum ml-auto text-[12px] text-fg-subtle">{formatMoney(total)}</span>
                <IconButton label={`Add deal to ${stage}`} onClick={() => setQuickAdd(stage)}>
                  <Plus size={16} strokeWidth={1.75} />
                </IconButton>
              </div>

              <div className="flex min-h-16 flex-1 flex-col gap-2 px-2 pb-2">
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[12px] text-fg-subtle">
                    {active ? "Drop here" : "No deals"}
                  </p>
                ) : (
                  items.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      lastActivity={
                        recency.byDeal[d.id] ||
                        (d.companyId ? recency.byCompany[d.companyId] : undefined) ||
                        d.createdTime
                      }
                      dragging={dragging === d.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(d.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      onStageChange={(s) => moveDeal(d.id, s)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={quickAdd !== null}
        onClose={() => setQuickAdd(null)}
        title={`New deal${quickAdd ? ` · ${quickAdd}` : ""}`}
      >
        {quickAdd !== null && (
          <DealForm
            initial={{ stage: quickAdd }}
            companies={companies}
            onSave={addDeal}
            onCancel={() => setQuickAdd(null)}
            submitLabel="Create deal"
          />
        )}
      </Modal>
    </div>
  );
}

function daysSince(s?: string): number {
  if (!s) return Infinity;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function DealCard({
  deal,
  lastActivity,
  dragging,
  onDragStart,
  onDragEnd,
  onStageChange,
}: {
  deal: Deal;
  lastActivity?: string;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onStageChange: (stage: DealStage) => void;
}) {
  const closed = deal.stage ? CLOSED.includes(deal.stage) : false;
  const stale = closed ? 0 : daysSince(lastActivity);

  // One priority flag per card: missing next step and 30-day staleness are red,
  // overdue next step and 14-day staleness are amber.
  const flag: { label: string; danger: boolean } | null = closed
    ? null
    : !deal.nextStep && !deal.nextStepDate
      ? { label: "No next step", danger: true }
      : stale >= 30
        ? { label: "Stale 30d+", danger: true }
        : isOverdue(deal.nextStepDate)
          ? { label: "Overdue", danger: false }
          : stale >= 14
            ? { label: "Stale 14d+", danger: false }
            : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(8,15,30,0.04)] active:cursor-grabbing ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <p className="text-[13px] font-medium leading-snug text-fg">{deal.name || "Untitled"}</p>
      {deal.companyId ? (
        <Link
          href={`/companies/${deal.companyId}`}
          className="mt-0.5 block truncate text-[12px] text-fg-subtle hover:text-accent-strong"
        >
          {deal.companyName || "Company"}
        </Link>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="tnum text-[13px] font-medium text-fg">{formatMoney(deal.mrr)}</span>
        {flag ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              flag.danger ? "text-danger" : "text-warning"
            }`}
          >
            {flag.danger ? (
              <CircleDashed size={12} strokeWidth={2} />
            ) : (
              <AlertTriangle size={12} strokeWidth={2} />
            )}
            {flag.label}
          </span>
        ) : null}
      </div>

      <select
        value={deal.stage ?? "New Lead"}
        onChange={(e) => onStageChange(e.target.value as DealStage)}
        aria-label={`Move ${deal.name} to a different stage`}
        className="mt-2 w-full rounded-md border border-border-soft bg-surface px-2 py-1 text-[12px] text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {DEAL_STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
