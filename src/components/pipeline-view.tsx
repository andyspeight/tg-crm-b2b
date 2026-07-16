"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Link2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/client";
import { STAGE_COLORS, STAGE_KINDS } from "@/lib/crm/config";
import type { Deal, DealStage, PipelineStage, StageKind } from "@/lib/crm/types";
import { dealFlag } from "@/lib/deal-flags";
import {
  Button,
  IconButton,
  InlineAlert,
  Modal,
  Monogram,
  PageHeader,
  Select,
  Spinner,
  type BadgeColor,
} from "@/components/ui";
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

function asColor(c: string): BadgeColor {
  return (STAGE_COLORS as readonly string[]).includes(c) ? (c as BadgeColor) : "neutral";
}

function StageDot({ color }: { color: BadgeColor }) {
  const token = STAGE_DOT_TOKEN[color];
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

const KIND_LABEL: Record<StageKind, string> = { open: "Open", won: "Won", lost: "Lost" };

export function PipelineView({
  initial,
  companies,
  recency,
  initialStages,
}: {
  initial: Deal[];
  companies: CompanyOption[];
  recency: { byDeal: Record<string, string>; byCompany: Record<string, string> };
  initialStages: PipelineStage[];
}) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState("");

  const stageNames = useMemo(() => stages.map((s) => s.name), [stages]);
  const colorByName = useMemo(() => new Map(stages.map((s) => [s.name, asColor(s.color)])), [stages]);
  const kindByName = useMemo(() => new Map(stages.map((s) => [s.name, s.kind])), [stages]);

  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of stages) map.set(s.name, []);
    const first = stages[0]?.name;
    for (const d of deals) {
      if (d.stage && map.has(d.stage)) map.get(d.stage)!.push(d);
      else if (first) map.get(first)!.push(d);
    }
    return map;
  }, [deals, stages]);

  async function moveDeal(id: string, stage: string) {
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

  async function refreshDeals() {
    const data = await api<{ deals: Deal[] }>("/api/deals");
    setDeals(data.deals);
  }

  async function addDeal(payload: Record<string, unknown>) {
    await api("/api/deals", { method: "POST", body: JSON.stringify(payload) });
    setQuickAdd(null);
    await refreshDeals();
  }

  async function editDeal(payload: Record<string, unknown>) {
    if (!editing) return;
    await api(`/api/deals/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(null);
    await refreshDeals();
  }

  async function saveStages(payload: {
    stages: PipelineStage[];
    renames: { from: string; to: string }[];
    removals: { name: string; moveTo: string }[];
  }) {
    const data = await api<{ stages: PipelineStage[] }>("/api/stages", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setStages(data.stages);
    setManaging(false);
    // Renames/removals moved deals server-side — reflect it.
    await refreshDeals();
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`${deals.length} ${deals.length === 1 ? "deal" : "deals"} · drag a card, edit it, or manage your stages`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setManaging(true)}>
              <Settings2 size={16} strokeWidth={1.75} /> Manage stages
            </Button>
            <Button variant="primary" onClick={() => setQuickAdd(stages[0]?.name ?? "New Lead")}>
              <Plus size={16} strokeWidth={2} /> New deal
            </Button>
          </>
        }
      />

      {error ? (
        <div className="mt-4">
          <InlineAlert variant="danger">{error}</InlineAlert>
        </div>
      ) : null}

      <div className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-3">
        {stages.map((stage) => {
          const items = byStage.get(stage.name) ?? [];
          const total = items.reduce((s, d) => s + (d.mrr ?? 0), 0);
          const active = dragOver === stage.name;
          const color = asColor(stage.color);
          return (
            <div
              key={stage.name}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOver(stage.name);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveDeal(id, stage.name);
                setDragOver(null);
              }}
              className={`group/lane flex w-[272px] shrink-0 flex-col rounded-2xl border bg-muted/40 shadow-card transition-colors ${
                active ? "border-accent ring-1 ring-accent" : "border-border-soft"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2.5">
                <StageDot color={color} />
                <h2 className="truncate text-[13px] font-semibold text-fg">{stage.name}</h2>
                <span className="tnum rounded-md bg-card px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
                  {items.length}
                </span>
                <span className="tnum ml-auto text-[13px] font-medium text-fg">
                  {total > 0 ? formatMoney(total) : <span className="text-fg-subtle">—</span>}
                </span>
                <IconButton
                  label={`Add deal to ${stage.name}`}
                  onClick={() => setQuickAdd(stage.name)}
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
                  items.map((d, i) => {
                    const k = kindByName.get(d.stage ?? "");
                    return (
                      <DealCard
                        key={d.id}
                        deal={d}
                        index={i}
                        color={colorByName.get(d.stage ?? "") ?? "neutral"}
                        stageNames={stageNames}
                        isClosed={k === "won" || k === "lost"}
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
                    );
                  })
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
            stageNames={stageNames}
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
            stageNames={stageNames}
            onSave={editDeal}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <ManageStagesModal
        open={managing}
        stages={stages}
        onClose={() => setManaging(false)}
        onSave={saveStages}
      />
    </div>
  );
}

function DealCard({
  deal,
  index,
  color,
  stageNames,
  isClosed,
  lastActivity,
  dragging,
  onDragStart,
  onDragEnd,
  onStageChange,
  onEdit,
}: {
  deal: Deal;
  index: number;
  color: BadgeColor;
  stageNames: string[];
  isClosed: boolean;
  lastActivity?: string;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onStageChange: (stage: string) => void;
  onEdit: () => void;
}) {
  const flag = dealFlag(deal, lastActivity, isClosed);

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
            className="block w-full truncate text-left text-[13px] font-medium leading-snug text-fg hover:text-accent-strong focus-visible:text-accent-strong focus-visible:outline-none"
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
        <StageDot color={color} />
        <select
          value={stageNames.includes(deal.stage ?? "") ? deal.stage : stageNames[0]}
          onChange={(e) => onStageChange(e.target.value)}
          aria-label={`Move ${deal.name} to a different stage`}
          className="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:border-border-soft hover:bg-surface focus-visible:border-border-soft focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {stageNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// --- manage stages ----------------------------------------------------------

type StageRow = { id: string; origName: string | null; name: string; color: string; kind: StageKind };

function ManageStagesModal({
  open,
  stages,
  onClose,
  onSave,
}: {
  open: boolean;
  stages: PipelineStage[];
  onClose: () => void;
  onSave: (payload: {
    stages: PipelineStage[];
    renames: { from: string; to: string }[];
    removals: { name: string; moveTo: string }[];
  }) => Promise<void>;
}) {
  const [rows, setRows] = useState<StageRow[]>([]);
  const [removing, setRemoving] = useState<{ origName: string; moveTo: string }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const idc = useRef(0);

  useEffect(() => {
    if (open) {
      setRows(
        stages.map((s) => ({ id: s.name, origName: s.name, name: s.name, color: s.color, kind: s.kind })),
      );
      setRemoving([]);
      setError("");
      setSaving(false);
    }
  }, [open, stages]);

  function patch(id: string, p: Partial<StageRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  function move(id: string, dir: -1 | 1) {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addRow() {
    const id = `new-${idc.current++}`;
    setRows((rs) => [...rs, { id, origName: null, name: "", color: "accent", kind: "open" }]);
  }
  function removeRow(row: StageRow) {
    const next = rows.filter((r) => r.id !== row.id);
    setRows(next);
    if (row.origName) {
      const moveTo = next[0]?.name.trim() || "";
      setRemoving((rm) => [...rm, { origName: row.origName!, moveTo }]);
    }
  }

  const liveNames = rows.map((r) => r.name.trim()).filter(Boolean);

  async function save() {
    const finalStages: PipelineStage[] = rows.map((r) => ({
      name: r.name.trim(),
      color: r.color,
      kind: r.kind,
    }));
    if (finalStages.length === 0) return setError("Keep at least one stage.");
    if (finalStages.some((s) => !s.name)) return setError("Every stage needs a name.");
    const lower = finalStages.map((s) => s.name.toLowerCase());
    if (new Set(lower).size !== lower.length) return setError("Stage names must be unique.");

    const names = new Set(finalStages.map((s) => s.name));
    const removals = removing.map((rm) => ({
      name: rm.origName,
      moveTo: names.has(rm.moveTo) ? rm.moveTo : finalStages[0].name,
    }));
    for (const rm of removals) {
      if (!rm.moveTo) return setError(`Choose where to move deals from "${rm.name}".`);
    }
    const renames = rows
      .filter((r) => r.origName && r.name.trim() && r.name.trim() !== r.origName)
      .map((r) => ({ from: r.origName!, to: r.name.trim() }));

    setSaving(true);
    setError("");
    try {
      await onSave({ stages: finalStages, renames, removals });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your stages");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage pipeline stages">
      <div className="space-y-3">
        <p className="text-[13px] text-fg-subtle">
          Rename, recolour, reorder, add or remove your pipeline columns. Mark a stage as Won or Lost so
          closed deals are handled correctly.
        </p>

        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <StageDot color={asColor(r.color)} />
                <input
                  value={r.name}
                  onChange={(e) => patch(r.id, { name: e.target.value })}
                  placeholder="Stage name"
                  className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-[14px] text-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <div className="flex items-center">
                  <IconButton label="Move up" onClick={() => move(r.id, -1)} className="h-8 w-8" disabled={i === 0}>
                    <ChevronUp size={15} strokeWidth={1.9} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    onClick={() => move(r.id, 1)}
                    className="h-8 w-8"
                    disabled={i === rows.length - 1}
                  >
                    <ChevronDown size={15} strokeWidth={1.9} />
                  </IconButton>
                  <IconButton label="Remove stage" onClick={() => removeRow(r)} className="h-8 w-8 hover:text-danger">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-4">
                <label className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
                  Colour
                  <Select value={r.color} onChange={(e) => patch(r.id, { color: e.target.value })} className="h-8 w-28 text-[13px]">
                    {STAGE_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
                  Type
                  <Select
                    value={r.kind}
                    onChange={(e) => patch(r.id, { kind: e.target.value as StageKind })}
                    className="h-8 w-24 text-[13px]"
                  >
                    {STAGE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </li>
          ))}
        </ul>

        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus size={15} strokeWidth={2} /> Add stage
        </Button>

        {removing.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
            <p className="mb-2 text-[12px] font-medium text-fg">Move deals from removed stages</p>
            <ul className="space-y-2">
              {removing.map((rm, idx) => (
                <li key={rm.origName} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-fg-muted">{rm.origName} →</span>
                  <Select
                    value={liveNames.includes(rm.moveTo) ? rm.moveTo : liveNames[0] ?? ""}
                    onChange={(e) =>
                      setRemoving((list) => list.map((x, j) => (j === idx ? { ...x, moveTo: e.target.value } : x)))
                    }
                    className="h-8 w-40 text-[13px]"
                  >
                    {liveNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2 border-t border-border-soft pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : null} Save stages
          </Button>
        </div>
      </div>
    </Modal>
  );
}
