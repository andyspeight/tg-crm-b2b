"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { ACCOUNT_HEALTH, CARE_CADENCES, TOUCH_TYPES } from "@/lib/crm/config";
import type { CareTouch, Company } from "@/lib/crm/types";
import { isPast } from "@/lib/deal-flags";
import { Button, EmptyState, Field, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { HealthBadge } from "@/components/badges";
import { formatDate } from "@/lib/format";

type CareRow = { company: Company; nextTouch?: CareTouch };

export function CareBoardView({ initial }: { initial: CareRow[] }) {
  const [rows, setRows] = useState<CareRow[]>(initial);
  const [health, setHealth] = useState("");
  const [cadence, setCadence] = useState("");
  const [generating, setGenerating] = useState(false);
  const [logging, setLogging] = useState<CareRow | null>(null);

  async function refresh() {
    const data = await api<{ rows: CareRow[] }>("/api/care");
    setRows(data.rows);
  }

  async function generate() {
    setGenerating(true);
    try {
      const data = await api<{ created: number }>("/api/care/generate", { method: "POST" });
      await refresh();
      alert(
        data.created > 0
          ? `Scheduled ${data.created} care ${data.created === 1 ? "touch" : "touches"}.`
          : "Every customer already has a scheduled touch.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!health || r.company.accountHealth === health) &&
          (!cadence || (r.company.careCadence ?? "None") === cadence),
      ),
    [rows, health, cadence],
  );

  const overdueCount = filtered.filter((r) => r.nextTouch && isPast(r.nextTouch.dueDate)).length;
  const unscheduled = filtered.filter((r) => !r.nextTouch && r.company.careCadence && r.company.careCadence !== "None").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Customer care</h1>
          <p className="text-[13px] text-fg-subtle">
            {filtered.length} customers
            {overdueCount > 0 ? <span className="text-danger"> · {overdueCount} overdue</span> : null}
            {unscheduled > 0 ? <span className="text-warning"> · {unscheduled} unscheduled</span> : null}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value)}
            aria-label="Filter by health"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">All health</option>
            {ACCOUNT_HEALTH.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            aria-label="Filter by cadence"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">All cadences</option>
            {CARE_CADENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={generate} disabled={generating}>
            {generating ? <Spinner /> : <CalendarPlus size={16} strokeWidth={1.75} />}
            Generate schedule
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No customers in this view"
          hint="Customers (lifecycle = Customer) appear here. Adjust the filters or import them first."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[12px] font-medium text-fg-subtle">
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Health</th>
                <th className="px-4 py-2.5">Cadence</th>
                <th className="px-4 py-2.5">Next touch</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const t = r.nextTouch;
                const overdue = t ? isPast(t.dueDate) : false;
                return (
                  <tr key={r.company.id} className="border-b border-border-soft last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/companies/${r.company.id}`}
                        className="font-medium text-fg hover:text-accent-strong"
                      >
                        {r.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <HealthBadge value={r.company.accountHealth} />
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">{r.company.careCadence ?? "None"}</td>
                    <td className="px-4 py-2.5">
                      {t ? (
                        <span className={`tnum ${overdue ? "text-danger" : "text-fg-muted"}`}>
                          {overdue ? "Overdue · " : ""}
                          {formatDate(t.dueDate)}
                          <span className="ml-2 text-[12px] text-fg-subtle">{t.touchType}</span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-warning">Not scheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {t ? (
                        <Button variant="ghost" size="sm" onClick={() => setLogging(r)}>
                          <CheckCircle2 size={15} strokeWidth={1.75} /> Log touch
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
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
