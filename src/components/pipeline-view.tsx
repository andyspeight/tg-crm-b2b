"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CircleDashed, Link2, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { DEAL_STAGES } from "@/lib/crm/config";
import type { Deal, DealStage } from "@/lib/crm/types";
import { dealFlag } from "@/lib/deal-flags";
import {
  Button,
  IconButton,
  InlineAlert,
  Modal,
  Monogram,
  PageHeader,
  type BadgeColor,
} from "@/components/ui";
import { stageColor } from "@/components/badges";
import { DealForm, type CompanyOption } from "@/components/forms";
import { formatMoney } from "@/lib/format";

/** CSS-var token for each stage colour, so the lane dot matches the stage badge. */
const STAGE_DOT_TOKEN: Record<BadgeColor, string> = {
  neutral: "--color-fg-subtle",
  navy: "--color-navy",
  accent: "--color-accent-strong",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
  info: "--color-info",
};

function StageDot({ stage }: { stage: DealStage }) {
  const token = STAGE_DOT_TOKEN[stageColor(stage)];
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full"
      style={{
        backgroundColor: `var(${token})`,
        boxShadow: `0 0 0 3px color-mix(in srgb, var(${token}) 14%, transparent)`,
      }}
    />
  );
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
  const [editing, setEditing] = useState<Deal | null>(null);
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

  async function editDeal(payload: Record<string, unknown>) {
    if (!editing) return;
    await api(`/api/deals/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(null);
    // Re-fetch so the linked company name (and any stage move) is reflected.
    const data = await api<{ deals: Deal[] }>("/api/deals");
    setDeals(data.deals);
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`${deals.length} ${deals.length === 1 ? "deal" : "deals"} · drag a card or use the stage menu to move it`}
        actions={
          <Button variant="primary" onClick={() => setQuickAdd("New Lead")}>
            <Plus size={16} strokeWidth={2} /> New deal
          </Button>
        }
      />

      {error ? (
        <div className="mt-4">
          <InlineAlert variant="danger">{error}</InlineAlert>
        </div>
      ) : null}

      <div className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-3">
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
              className={`group/lane flex w-[272px] shrink-0 flex-col rounded-2xl border bg-muted/40 shadow-card transition-colors ${
                active ? "border-accent ring-1 ring-accent" : "border-border-soft"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2.5">
                <StageDot stage={stage} />
                <h2 className="text-[13px] font-semibold text-fg">{stage}</h2>
                <span className="tnum rounded-md bg-card px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
                  {items.length}
                </span>
                <span className="tnum ml-auto text-[13px] font-medium text-fg">
                  {total > 0 ? formatMoney(total) : <span className="text-fg-subtle">—</span>}
                </span>
                <IconButton
                  label={`Add deal to ${stage}`}
                  onClick={() => setQuickAdd(stage)}
                  className="opacity-0 transition-opacity group-hover/lane:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                >
                  <Plus size={16} strokeWidth={1.75} />
                </IconButton>
              </div>

              <div className="flex min-h-16 flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <p className="luna-fade px-1 py-6 text-center text-[12px] text-fg-subtle">
                    {active ? "Drop here" : "No deals"}
                  </p>
                ) : (
                  items.map((d, i) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      index={i}
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
                      onEdit={() => setEditing(d)}
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

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit deal">
        {editing !== null && (
          <DealForm
            initial={editing}
            companies={companies}
            onSave={editDeal}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>
    </div>
  );
}

function DealCard({
  deal,
  index,
  lastActivity,
  dragging,
  onDragStart,
  onDragEnd,
  onStageChange,
  onEdit,
}: {
  deal: Deal;
  index: number;
  lastActivity?: string;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onStageChange: (stage: DealStage) => void;
  onEdit: () => void;
}) {
  const flag = dealFlag(deal, lastActivity);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      className={`luna-rise group/card cursor-grab rounded-2xl border border-border bg-card p-3 shadow-card transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-raise active:translate-y-0 active:cursor-grabbing ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Monogram name={deal.companyName || deal.name} size="sm" tone="navy" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edit this deal"
            className="block w-full truncate text-left text-[13px] font-medium leading-snug text-fg hover:text-accent-strong focus-visible:outline-none focus-visible:text-accent-strong"
          >
            {deal.name || "Untitled"}
          </button>
          {deal.companyId ? (
            <Link
              href={`/companies/${deal.companyId}`}
              className="mt-0.5 block truncate text-[12px] text-fg-subtle hover:text-accent-strong"
            >
              {deal.companyName || "Company"}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-fg-subtle transition-colors hover:text-accent-strong"
            >
              <Link2 size={12} strokeWidth={2} /> Link company
            </button>
          )}
        </div>
        <IconButton
          label="Edit deal"
          onClick={onEdit}
          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="tnum text-[13px] font-medium text-fg">
          {deal.mrr ? formatMoney(deal.mrr) : <span className="text-fg-subtle">—</span>}
        </span>
        {flag ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
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

      <div className="relative mt-2 flex items-center gap-1.5">
        <StageDot stage={(deal.stage ?? "New Lead") as DealStage} />
        <select
          value={deal.stage ?? "New Lead"}
          onChange={(e) => onStageChange(e.target.value as DealStage)}
          aria-label={`Move ${deal.name} to a different stage`}
          className="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:border-border-soft hover:bg-surface focus-visible:border-border-soft focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
