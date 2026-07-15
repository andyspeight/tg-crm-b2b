"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  CircleCheck,
  Download,
} from "lucide-react";
import { api } from "@/lib/client";
import { ACCOUNT_HEALTH, CARE_CADENCES, TOUCH_TYPES } from "@/lib/crm/config";
import type { CareTouch, Company } from "@/lib/crm/types";
import { isPast } from "@/lib/deal-flags";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  InlineAlert,
  Modal,
  Monogram,
  PageHeader,
  Select,
  Spinner,
  StatTile,
  Textarea,
} from "@/components/ui";
import { HealthBadge, healthColor } from "@/components/badges";
import { formatDate } from "@/lib/format";

type CareRow = { company: Company; nextTouch?: CareTouch };
type View = "all" | "overdue" | "unscheduled" | "ontrack";

/** Health colour rail down the left edge of every row. */
function railClass(health?: string): string {
  const c = healthColor(health);
  return c === "success"
    ? "border-l-success"
    : c === "warning"
      ? "border-l-warning"
      : c === "danger"
        ? "border-l-danger"
        : "border-l-border";
}

function categoryOf(r: CareRow): View {
  if (r.nextTouch && isPast(r.nextTouch.dueDate)) return "overdue";
  if (!r.nextTouch && r.company.careCadence && r.company.careCadence !== "None")
    return "unscheduled";
  if (r.nextTouch) return "ontrack";
  return "all";
}

const CATEGORY_RANK: Record<View, number> = { overdue: 0, unscheduled: 1, ontrack: 2, all: 3 };

export function CareBoardView({ initial }: { initial: CareRow[] }) {
  const [rows, setRows] = useState<CareRow[]>(initial);
  const [health, setHealth] = useState("");
  const [cadence, setCadence] = useState("");
  const [view, setView] = useState<View>("all");
  const [generating, setGenerating] = useState(false);
  const [logging, setLogging] = useState<CareRow | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "info"; message: string } | null>(null);

  async function refresh() {
    const data = await api<{ rows: CareRow[] }>("/api/care");
    setRows(data.rows);
  }

  async function generate() {
    setGenerating(true);
    try {
      const data = await api<{ created: number }>("/api/care/generate", { method: "POST" });
      await refresh();
      setNotice(
        data.created > 0
          ? {
              variant: "success",
              message: `Scheduled ${data.created} care ${data.created === 1 ? "touch" : "touches"}.`,
            }
          : { variant: "info", message: "Every customer already has a scheduled touch." },
      );
    } finally {
      setGenerating(false);
    }
  }

  // Health + cadence filter drives the counts; the tile view narrows what shows.
  const scoped = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!health || r.company.accountHealth === health) &&
          (!cadence || (r.company.careCadence ?? "None") === cadence),
      ),
    [rows, health, cadence],
  );

  const overdueCount = scoped.filter((r) => categoryOf(r) === "overdue").length;
  const unscheduledCount = scoped.filter((r) => categoryOf(r) === "unscheduled").length;
  const onTrackCount = scoped.filter((r) => categoryOf(r) === "ontrack").length;

  const visible = useMemo(() => {
    const list = view === "all" ? scoped : scoped.filter((r) => categoryOf(r) === view);
    return [...list].sort((a, b) => {
      const rank = CATEGORY_RANK[categoryOf(a)] - CATEGORY_RANK[categoryOf(b)];
      if (rank !== 0) return rank;
      const ad = a.nextTouch?.dueDate ?? "";
      const bd = b.nextTouch?.dueDate ?? "";
      return ad.localeCompare(bd);
    });
  }, [scoped, view]);

  function toggleView(next: View) {
    setView((v) => (v === next ? "all" : next));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer care"
        description={`${scoped.length} ${scoped.length === 1 ? "customer" : "customers"} · keeping every account watered`}
        actions={
          <Button variant="primary" onClick={generate} disabled={generating}>
            {generating ? <Spinner /> : <CalendarPlus size={16} strokeWidth={1.75} />}
            Generate schedule
          </Button>
        }
      />

      {notice ? <InlineAlert variant={notice.variant}>{notice.message}</InlineAlert> : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="luna-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <StatTile
            label="Overdue"
            value={String(overdueCount)}
            sub="Touch date passed"
            tone="danger"
            icon={<AlertTriangle size={16} strokeWidth={1.75} />}
            onClick={() => toggleView("overdue")}
            active={view === "overdue"}
          />
        </div>
        <div className="luna-rise" style={{ "--i": 1 } as React.CSSProperties}>
          <StatTile
            label="Unscheduled"
            value={String(unscheduledCount)}
            sub="No touch booked"
            tone="warn"
            icon={<CalendarX2 size={16} strokeWidth={1.75} />}
            onClick={() => toggleView("unscheduled")}
            active={view === "unscheduled"}
          />
        </div>
        <div className="luna-rise" style={{ "--i": 2 } as React.CSSProperties}>
          <StatTile
            label="On track"
            value={String(onTrackCount)}
            sub="Touch upcoming"
            tone="success"
            icon={<CircleCheck size={16} strokeWidth={1.75} />}
            onClick={() => toggleView("ontrack")}
            active={view === "ontrack"}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={health}
          onChange={(e) => setHealth(e.target.value)}
          aria-label="Filter by health"
          className="w-full sm:w-44"
        >
          <option value="">All health</option>
          {ACCOUNT_HEALTH.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          aria-label="Filter by cadence"
          className="w-full sm:w-44"
        >
          <option value="">All cadences</option>
          {CARE_CADENCES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus size={20} strokeWidth={1.75} />}
          title={view === "all" ? "No customers in this view" : "Nothing in this bucket"}
          hint={
            view === "all"
              ? "Customers (lifecycle = Customer) appear here. Adjust the filters, or import them from Monday to get started."
              : "Clear the tile filter to see the rest of your customers."
          }
          action={
            view === "all" ? (
              <ButtonLink href="/import">
                <Download size={16} strokeWidth={2} /> Import from Monday
              </ButtonLink>
            ) : (
              <Button variant="ghost" onClick={() => setView("all")}>
                Clear filter
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="luna-fade hidden overflow-hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card sm:block">
            <table className="w-full min-w-[680px] text-[14px]">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Health
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Cadence
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Next touch
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const t = r.nextTouch;
                  const overdue = t ? isPast(t.dueDate) : false;
                  return (
                    <tr
                      key={r.company.id}
                      className={`group border-b border-b-border-soft border-l-2 ${railClass(r.company.accountHealth)} transition-colors last:border-b-0 hover:bg-muted/50`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Monogram name={r.company.name} size="sm" tone="navy" />
                          <Link
                            href={`/companies/${r.company.id}`}
                            className="font-medium text-fg hover:text-accent-strong"
                          >
                            {r.company.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <HealthBadge value={r.company.accountHealth} />
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{r.company.careCadence ?? "None"}</td>
                      <td className="px-4 py-3">
                        {t ? (
                          <span className="flex items-center gap-2">
                            <span
                              className={`tnum font-medium ${overdue ? "text-danger" : "text-fg"}`}
                            >
                              {overdue ? "Overdue · " : ""}
                              {formatDate(t.dueDate)}
                            </span>
                            <span className="text-[12px] text-fg-subtle">{t.touchType}</span>
                          </span>
                        ) : (
                          <span className="text-[13px] font-medium text-warning">Not scheduled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t ? (
                          <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                            <Button variant="ghost" size="sm" onClick={() => setLogging(r)}>
                              <CheckCircle2 size={15} strokeWidth={1.75} /> Log touch
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {visible.map((r, i) => {
              const t = r.nextTouch;
              const overdue = t ? isPast(t.dueDate) : false;
              return (
                <div key={r.company.id} className="luna-rise" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <Card className={`border-l-2 ${railClass(r.company.accountHealth)} p-3.5`}>
                    <div className="flex items-center gap-2.5">
                      <Monogram name={r.company.name} size="sm" tone="navy" />
                      <Link
                        href={`/companies/${r.company.id}`}
                        className="min-w-0 flex-1 truncate font-medium text-fg"
                      >
                        {r.company.name}
                      </Link>
                      <HealthBadge value={r.company.accountHealth} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
                      {t ? (
                        <span className="min-w-0 truncate">
                          <span className={`tnum font-medium ${overdue ? "text-danger" : "text-fg"}`}>
                            {overdue ? "Overdue · " : ""}
                            {formatDate(t.dueDate)}
                          </span>
                          <span className="ml-2 text-fg-subtle">{t.touchType}</span>
                        </span>
                      ) : (
                        <span className="font-medium text-warning">Not scheduled</span>
                      )}
                      {t ? (
                        <Button variant="ghost" size="sm" onClick={() => setLogging(r)}>
                          <CheckCircle2 size={15} strokeWidth={1.75} /> Log
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!logging}
        onClose={() => setLogging(null)}
        title={logging ? `Log touch · ${logging.company.name}` : "Log touch"}
      >
        {logging?.nextTouch ? (
          <LogTouchForm
            row={logging}
            onDone={async () => {
              setLogging(null);
              await refresh();
            }}
            onCancel={() => setLogging(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function LogTouchForm({
  row,
  onDone,
  onCancel,
}: {
  row: CareRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const touch = row.nextTouch!;
  const [touchType, setTouchType] = useState(touch.touchType ?? "Check-In Call");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/care/log", {
        method: "POST",
        body: JSON.stringify({ touchId: touch.id, touchType, outcomeNotes: outcome }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log touch");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[13px] text-fg-muted">
        Marks this touch done and schedules the next one per the {row.company.careCadence ?? "set"}{" "}
        cadence.
      </p>
      <Field label="Touch type">
        <Select value={touchType} onChange={(e) => setTouchType(e.target.value as typeof touchType)}>
          {TOUCH_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Outcome notes">
        <Textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          autoFocus
          placeholder="How did it go? Anything to follow up?"
        />
      </Field>
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Log and reschedule"}
        </Button>
      </div>
    </form>
  );
}
