"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { api } from "@/lib/client";
import type { Deal, Task } from "@/lib/crm/types";
import { isPast } from "@/lib/deal-flags";
import { EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";

export type AttentionItem = { deal: Deal; label: string; danger: boolean };

export function TodayView({ tasks: initialTasks, attention }: { tasks: Task[]; attention: AttentionItem[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  async function toggle(t: Task) {
    const next = t.status === "Done" ? "Open" : "Done";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    } catch {
      setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
    }
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const openTasks = tasks.filter((t) => t.status !== "Done").length;
  const summary =
    openTasks === 0 && attention.length === 0
      ? "You are all caught up. Nothing needs you right now."
      : [
          openTasks > 0 ? `${openTasks} ${openTasks === 1 ? "task" : "tasks"} open` : null,
          attention.length > 0 ? `${attention.length} ${attention.length === 1 ? "deal needs" : "deals need"} attention` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{greeting}</h1>
        <p className="mt-0.5 text-[13px] text-fg-subtle">
          {dateStr} · {summary}
        </p>
      </div>

      <Section title="Tasks" count={tasks.length}>
        {tasks.length === 0 ? (
          <EmptyState title="No open tasks" hint="Use Quick add (the + up top) to capture one." />
        ) : (
          <ul className="divide-y divide-border-soft">
            {tasks.map((t) => {
              const done = t.status === "Done";
              const overdue = !done && isPast(t.dueDate);
              return (
                <li key={t.id} className="flex items-start gap-3 py-2.5">
                  <button
                    onClick={() => toggle(t)}
                    aria-label={done ? "Mark not done" : "Mark done"}
                    className="mt-0.5 rounded-full text-fg-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {done ? (
                      <CheckCircle2 size={18} strokeWidth={1.75} className="text-success" />
                    ) : (
                      <Circle size={18} strokeWidth={1.75} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] ${done ? "text-fg-subtle line-through" : "text-fg"}`}>
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-fg-subtle">
                      {t.companyId ? (
                        <Link href={`/companies/${t.companyId}`} className="hover:text-accent-strong">
                          {t.companyName || "Company"}
                        </Link>
                      ) : (
                        "No company"
                      )}
                      {t.dueDate ? (
                        <span className={`tnum ${overdue ? "text-danger" : ""}`}>
                          {" · Due "}
                          {formatDate(t.dueDate)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Deals needing attention" count={attention.length}>
        {attention.length === 0 ? (
          <EmptyState title="Every deal has a clear next step" />
        ) : (
          <ul className="divide-y divide-border-soft">
            {attention.map(({ deal, label, danger }) => (
              <li key={deal.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-fg">{deal.name}</p>
                  {deal.companyId ? (
                    <Link
                      href={`/companies/${deal.companyId}`}
                      className="text-[12px] text-fg-subtle hover:text-accent-strong"
                    >
                      {deal.companyName || "Company"}
                    </Link>
                  ) : null}
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-[11px] ${
                    danger ? "text-danger" : "text-warning"
                  }`}
                >
                  {danger ? <CircleDashed size={12} strokeWidth={2} /> : <AlertTriangle size={12} strokeWidth={2} />}
                  {label}
                </span>
                <span className="tnum w-16 shrink-0 text-right text-[13px] text-fg-muted">
                  {formatMoney(deal.mrr)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Care touches due">
        <EmptyState title="The care board arrives next" hint="Scheduled customer touches will surface here." />
      </Section>

      <Section title="Signals">
        <EmptyState title="No signals" hint="Watchlist monitoring arrives in Stage 5." />
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
        {typeof count === "number" && count > 0 ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
            {count}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
