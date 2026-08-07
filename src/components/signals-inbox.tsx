"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Radar, RefreshCw, SearchX, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Signal, SignalStatus, SignalType } from "@/lib/crm/types";
import { SIGNAL_TYPES } from "@/lib/crm/config";
import {
  Badge,
  type BadgeColor,
  Button,
  cn,
  EmptyState,
  IconButton,
  InlineAlert,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { TabPills } from "@/components/list-kit";
import { useToast } from "@/components/feedback";

const TYPE_COLOR: Record<SignalType, BadgeColor> = {
  Funding: "success",
  Award: "accent",
  "Job Change": "info",
  News: "navy",
  "LinkedIn Post": "info",
  "Website Change": "warning",
  Other: "neutral",
};
const STATUS_COLOR: Record<SignalStatus, BadgeColor> = {
  New: "accent",
  Seen: "info",
  Actioned: "success",
  Dismissed: "neutral",
};

type StatusTab = SignalStatus | "all";

function whenLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function SignalsInbox({ initial }: { initial: Signal[] }) {
  const [signals, setSignals] = useState<Signal[]>(initial);
  const [status, setStatus] = useState<StatusTab>("New");
  const [type, setType] = useState<SignalType | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  async function refresh() {
    const data = await api<{ signals: Signal[] }>("/api/signals?limit=1000");
    setSignals(data.signals);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: signals.length, New: 0, Seen: 0, Actioned: 0, Dismissed: 0 };
    for (const s of signals) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [signals]);

  const shown = useMemo(() => {
    return signals.filter(
      (s) => (status === "all" || s.status === status) && (type === "all" || s.type === type),
    );
  }, [signals, status, type]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyLocal(ids: Set<string> | string[], newStatus: SignalStatus) {
    const set = ids instanceof Set ? ids : new Set(ids);
    setSignals((xs) => xs.map((s) => (set.has(s.id) ? { ...s, status: newStatus } : s)));
  }

  async function setOne(id: string, newStatus: SignalStatus) {
    applyLocal([id], newStatus);
    try {
      await api(`/api/signals/${id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
      await refresh();
    }
  }

  async function bulk(newStatus: SignalStatus) {
    const ids = [...selected];
    if (ids.length === 0) return;
    applyLocal(selected, newStatus);
    setSelected(new Set());
    try {
      await api("/api/signals/bulk", { method: "POST", body: JSON.stringify({ ids, status: newStatus }) });
      toast.success(`${ids.length} ${ids.length === 1 ? "signal" : "signals"} → ${newStatus}`);
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
      await refresh();
    }
  }

  async function runScan() {
    setScanning(true);
    setError("");
    try {
      const r = await api<{ ran: boolean; reason?: string; signalsCreated: number; backfilled: number }>(
        "/api/intel/monitor/run",
        { method: "POST" },
      );
      if (!r.ran) {
        setError(r.reason || "Bright Data isn't configured.");
      } else {
        toast.success(`Scan done · ${r.signalsCreated} new signal${r.signalsCreated === 1 ? "" : "s"}`, {
          description: r.backfilled ? `${r.backfilled} account${r.backfilled === 1 ? "" : "s"} enriched too.` : undefined,
        });
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  const STATUS_TABS: { id: StatusTab; label: string; n: number }[] = [
    { id: "New", label: "New", n: counts.New },
    { id: "Seen", label: "Seen", n: counts.Seen },
    { id: "Actioned", label: "Actioned", n: counts.Actioned },
    { id: "Dismissed", label: "Dismissed", n: counts.Dismissed },
    { id: "all", label: "All", n: counts.all },
  ];

  const allShownSelected = shown.length > 0 && shown.every((s) => selected.has(s.id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Signals"
        description="Buying and intent signals the daily scan finds across your accounts."
        actions={
          <Button variant="secondary" onClick={runScan} disabled={scanning}>
            {scanning ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.9} />} Run scan
          </Button>
        }
      />

      {scanning ? (
        <InlineAlert variant="info">Scanning accounts — this can take a few minutes. New signals appear as it finds them.</InlineAlert>
      ) : null}
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <TabPills tabs={STATUS_TABS} active={status} onChange={setStatus} />
        <Select value={type} onChange={(e) => setType(e.target.value as SignalType | "all")} className="w-auto">
          <option value="all">All types</option>
          {SIGNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 ? (
        <div className="luna-fade flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-soft bg-accent-soft/30 px-3 py-2">
          <span className="text-[13px] font-medium text-fg">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => bulk("Actioned")}>
              <Check size={15} strokeWidth={2} /> Mark actioned
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bulk("Dismissed")}>
              Dismiss
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X size={14} strokeWidth={1.9} /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          icon={signals.length === 0 ? <Radar size={20} strokeWidth={1.75} /> : <SearchX size={20} strokeWidth={1.75} />}
          title={signals.length === 0 ? "No signals yet" : "Nothing in this filter"}
          hint={
            signals.length === 0
              ? "The daily scan surfaces funding, hires, awards and news about your accounts. Run a scan or wait for the 6am run."
              : "Try a different status or type."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
            <input
              type="checkbox"
              aria-label="Select all shown"
              className="h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
              checked={allShownSelected}
              ref={(el) => {
                if (el) el.indeterminate = shown.some((s) => selected.has(s.id)) && !allShownSelected;
              }}
              onChange={(e) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) shown.forEach((s) => next.add(s.id));
                  else shown.forEach((s) => next.delete(s.id));
                  return next;
                });
              }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              {shown.length} signal{shown.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border-soft">
            {shown.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                  selected.has(s.id) && "bg-accent-soft/25",
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${s.headline}`}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {s.type ? <Badge color={TYPE_COLOR[s.type]}>{s.type}</Badge> : null}
                    {s.companyId ? (
                      <Link href={`/companies/${s.companyId}`} className="text-[12.5px] font-medium text-fg hover:text-accent-strong">
                        {s.companyName || "Company"}
                      </Link>
                    ) : null}
                    <span className="text-[11.5px] text-fg-subtle">{whenLabel(s.dateFound || s.createdTime)}</span>
                    {s.status !== "New" ? <Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge> : null}
                  </div>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[14px] text-fg hover:text-accent-strong">
                      <span className="line-clamp-2">{s.headline || s.url}</span>
                      <ExternalLink size={13} strokeWidth={1.9} className="mt-0.5 shrink-0 text-fg-subtle" />
                    </a>
                  ) : (
                    <span className="text-[14px] text-fg">{s.headline}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {s.status !== "Actioned" ? (
                    <IconButton label="Mark actioned" onClick={() => setOne(s.id, "Actioned")} className="hover:text-success">
                      <Check size={16} strokeWidth={2} />
                    </IconButton>
                  ) : null}
                  {s.status !== "Dismissed" ? (
                    <IconButton label="Dismiss" onClick={() => setOne(s.id, "Dismissed")} className="hover:text-danger">
                      <X size={16} strokeWidth={2} />
                    </IconButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
