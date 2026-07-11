"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Clock, HeartHandshake } from "lucide-react";
import { api } from "@/lib/client";
import type { Task } from "@/lib/crm/types";
import type { NextAction } from "@/lib/crm/next-actions";
import { isPast } from "@/lib/deal-flags";
import { EmptyState } from "@/components/ui";
import { GettingStarted } from "@/components/getting-started";
import { formatDate } from "@/lib/format";

export type CareDueItem = {
  companyId: string;
  companyName: string;
  dueDate: string;
  touchType?: string;
  overdue: boolean;
};

export function TodayView({
  tasks: initialTasks,
  nextActions,
  careDue,
}: {
  tasks: Task[];
  nextActions: NextAction[];
  careDue: CareDueItem[];
}) {
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
    openTasks === 0 && nextActions.length === 0
      ? "You are all caught up. Nothing needs you right now."
      : [
          nextActions.length > 0
            ? `${nextActions.length} ${nextActions.length === 1 ? "priority" : "priorities"}`
            : null,
          openTasks > 0 ? `${openTasks} ${openTasks === 1 ? "task" : "tasks"} open` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <GettingStarted />

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{greeting}</h1>
        <p className="mt-0.5 text-[13px] text-fg-subtle">
          {dateStr} · {summary}
        </p>
      </div>

      <Section title="Do next" count={nextActions.length}>
        {nextActions.length === 0 ? (
          <EmptyState
            title="Nothing needs you right now"
            hint="Priorities appear here as deals go stale, health slips or care touches fall due."
          />
        ) : (
          <ul className="divide-y divide-border-soft">
            {nextActions.map((a) => (
              <NextActionRow key={`${a.companyId}:${a.kind}`} a={a} />
            ))}
          </ul>
        )}
      </Section>

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

      <Section title="Care touches due" count={careDue.length}>
        {careDue.length === 0 ? (
          <EmptyState
            title="No care touches due"
            hint="Scheduled customer touches appear here as they approach or fall overdue."
          />
        ) : (
          <ul className="divide-y divide-border-soft">
            {careDue.map((c) => (
              <li key={`${c.companyId}:${c.dueDate}`} className="flex items-center gap-3 py-2.5">
                <HeartHandshake
                  size={16}
                  strokeWidth={1.75}
                  className={`shrink-0 ${c.overdue ? "text-danger" : "text-fg-subtle"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/companies/${c.companyId}`}
                    className="text-[14px] text-fg hover:text-accent-strong"
                  >
                    {c.companyName}
                  </Link>
                  <p className="text-[12px] text-fg-subtle">{c.touchType ?? "Care touch"}</p>
                </div>
                <span className={`tnum shrink-0 text-[12px] ${c.overdue ? "text-danger" : "text-fg-muted"}`}>
                  {c.overdue ? "Overdue · " : ""}
                  {formatDate(c.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Signals">
        <EmptyState title="No signals" hint="Watchlist monitoring arrives next in Stage 5." />
      </Section>
    </div>
  );
}

function NextActionRow({ a }: { a: NextAction }) {
  const color =
    a.severity === "danger" ? "text-danger" : a.severity === "warn" ? "text-warning" : "text-accent-strong";
  const Icon = a.severity === "info" ? Clock : AlertTriangle;
  return (
    <li>
      <Link href={a.href} className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Icon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${color}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-fg">{a.label}</p>
          <p className="mt-0.5 truncate text-[12px] text-fg-subtle">
            {a.companyName}
            {a.detail ? ` · ${a.detail}` : ""}
          </p>
        </div>
        <ChevronRight
          size={16}
          strokeWidth={1.9}
          className="mt-0.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
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
