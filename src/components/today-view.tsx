"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { Building2, CheckCircle2, ChevronRight, Circle, HeartHandshake, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Task } from "@/lib/crm/types";
import type { NextAction } from "@/lib/crm/next-actions";
import { isPast } from "@/lib/deal-flags";
import { Button, EmptyState, cn } from "@/components/ui";
import { AskLunaBox } from "@/components/ask-luna-box";
import { SignalsFeed } from "@/components/signals-view";
import { SequencesFeed } from "@/components/sequences-feed";
import { OpensFeed } from "@/components/opens-feed";
import { AwaitingReplyFeed } from "@/components/awaiting-reply-feed";
import { LogTouchModal } from "@/components/log-touch-modal";
import { GettingStarted } from "@/components/getting-started";
import { useToast } from "@/components/feedback";
import { formatDate, formatMoney } from "@/lib/format";

export type CareDueItem = {
  touchId: string;
  companyId: string;
  companyName: string;
  dueDate: string;
  touchType?: string;
  overdue: boolean;
};

export type Vitals = {
  customers: number;
  leads: number;
  openDeals: number;
  openMrr: number;
  needsAttention: number;
  careDue: number;
};

export type NurtureItem = { id: string; name: string; last?: string };

export function TodayView({
  orgName,
  tasks: initialTasks,
  nextActions,
  careDue,
  vitals,
  nurture,
  newWorkspace,
}: {
  orgName?: string;
  tasks: Task[];
  nextActions: NextAction[];
  careDue: CareDueItem[];
  vitals: Vitals;
  nurture: NurtureItem[];
  newWorkspace?: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [careList, setCareList] = useState(careDue);
  const [logging, setLogging] = useState<CareDueItem | null>(null);
  const toast = useToast();

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

  const needCount = nextActions.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-fg">
          {greeting}
          {orgName ? `, ${orgName}` : ""}
        </h1>
        <p className="mt-1 text-[13px] text-fg-subtle">
          {dateStr}
          {needCount > 0 ? ` · ${needCount} ${needCount === 1 ? "thing needs" : "things need"} you today` : " · all caught up"}
        </p>
      </div>

      <AskLunaBox />

      {newWorkspace ? <GettingStarted /> : null}

      {/* The three attention feeds sit side by side on wide screens, stacked on
          mobile. Each returns null when empty, so present ones flex to fill. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
        <AwaitingReplyFeed className="lg:min-w-[300px] lg:flex-1" />
        <OpensFeed className="lg:min-w-[300px] lg:flex-1" />
        <SignalsFeed className="lg:min-w-[300px] lg:flex-1" />
      </div>

      <SequencesFeed />

      <NeedsYouToday actions={nextActions} nurture={nurture} />

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Tasks" count={openTasks} icon={<CheckCircle2 size={14} strokeWidth={2} />}>
          {tasks.length === 0 ? (
            <EmptyState title="No open tasks" hint="Use “Log note” or Quick add to capture one." />
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
                      <p className={`text-[14px] ${done ? "text-fg-subtle line-through" : "text-fg"}`}>{t.title}</p>
                      <p className="mt-0.5 text-[12px] text-fg-subtle">
                        {t.companyId ? (
                          <Link href={`/companies/${t.companyId}`} className="hover:text-accent-strong">
                            {t.companyName || "Company"}
                          </Link>
                        ) : (
                          "No company"
                        )}
                        {t.dueDate ? (
                          <span className={`tnum ${overdue ? "text-danger" : ""}`}> · Due {formatDate(t.dueDate)}</span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Care touches due" count={careList.length} icon={<HeartHandshake size={14} strokeWidth={2} />}>
          {careList.length === 0 ? (
            <EmptyState title="No care touches due" hint="Scheduled touches surface here as they approach." />
          ) : (
            <ul className="divide-y divide-border-soft">
              {careList.map((c) => (
                <li key={c.touchId} className="flex items-center gap-3 py-2.5">
                  <HeartHandshake
                    size={16}
                    strokeWidth={1.75}
                    className={`shrink-0 ${c.overdue ? "text-danger" : "text-fg-subtle"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/companies/${c.companyId}`} className="text-[14px] text-fg hover:text-accent-strong">
                      {c.companyName}
                    </Link>
                    <p className="text-[12px] text-fg-subtle">
                      {c.touchType ?? "Care touch"}
                      <span className={`tnum ${c.overdue ? "text-danger" : "text-fg-subtle"}`}>
                        {" · "}
                        {c.overdue ? "Overdue · " : ""}
                        {formatDate(c.dueDate)}
                      </span>
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setLogging(c)}>
                    <CheckCircle2 size={15} strokeWidth={1.75} /> Log
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Slim vitals strip — the dashboard's closing summary line. */}
      <p className="px-1 text-[13px] text-fg-subtle">
        {[
          `${vitals.customers} ${vitals.customers === 1 ? "customer" : "customers"}`,
          `${formatMoney(vitals.openMrr)} live pipeline`,
          `${vitals.openDeals} open ${vitals.openDeals === 1 ? "deal" : "deals"}`,
          `${vitals.needsAttention} need attention`,
          `${openTasks} open ${openTasks === 1 ? "task" : "tasks"}`,
          `${careList.length} care due`,
        ].join(" · ")}
      </p>

      <LogTouchModal
        open={!!logging}
        onClose={() => setLogging(null)}
        touchId={logging?.touchId}
        companyName={logging?.companyName}
        defaultTouchType={logging?.touchType}
        onLogged={() => {
          const id = logging?.touchId;
          setCareList((xs) => xs.filter((x) => x.touchId !== id));
          setLogging(null);
          toast.success("Touch logged", { description: "The next one is scheduled per cadence." });
        }}
      />
    </div>
  );
}


function CaughtUp({ nurture }: { nurture: NurtureItem[] }) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={18} strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-[14px] font-medium text-fg">You&rsquo;re all caught up</p>
          <p className="text-[12px] text-fg-subtle">Nothing overdue — a good moment to get ahead.</p>
        </div>
      </div>

      {nurture.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Nurture — longest since a meaningful touch
          </p>
          <ul className="divide-y divide-border-soft">
            {nurture.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/companies/${n.id}`}
                  className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Building2 size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                  <span className="flex-1 truncate text-[13px] text-fg">{n.name}</span>
                  <span className="shrink-0 text-[11px] text-fg-subtle">
                    {n.last ? `last ${formatDate(n.last)}` : "no contact yet"}
                  </span>
                  <ChevronRight
                    size={15}
                    strokeWidth={1.9}
                    className="shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// --- Needs you today --------------------------------------------------------

type NeedFilter = "all" | "urgent" | "care" | "deals";

const FILTERS: { id: NeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "care", label: "Care" },
  { id: "deals", label: "Deals" },
];

const TOP_N = 8;

function categoryOf(kind: string): "care" | "deals" | "account" {
  if (kind.includes("care")) return "care";
  if (kind.includes("deal") || kind.includes("stage") || kind.includes("stall")) return "deals";
  return "account";
}

function ctaFor(kind: string): string {
  if (kind.includes("care")) return "Log";
  if (kind.includes("health")) return "Reach out";
  return "Open";
}

function NeedsYouToday({ actions, nurture }: { actions: NextAction[]; nurture: NurtureItem[] }) {
  const [filter, setFilter] = useState<NeedFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const toast = useToast();

  const live = actions
    .filter((a) => !snoozed.has(`${a.companyId}:${a.kind}`))
    .slice()
    .sort((a, b) => b.score - a.score);

  const pastDue = live.filter((a) => a.severity === "danger").length;

  const filtered = live.filter((a) => {
    if (filter === "all") return true;
    if (filter === "urgent") return a.severity === "danger";
    return categoryOf(a.kind) === filter;
  });
  const shown = showAll ? filtered : filtered.slice(0, TOP_N);

  async function snooze(a: NextAction) {
    const key = `${a.companyId}:${a.kind}`;
    setSnoozed((s) => new Set(s).add(key));
    try {
      await api("/api/today/snooze", { method: "POST", body: JSON.stringify({ key }) });
    } catch {
      setSnoozed((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
      toast.error("Couldn't snooze that one");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Needs you today</h2>
          <p className="mt-0.5 text-[12px] text-fg-subtle">
            {live.length === 0
              ? "Nothing pressing"
              : `${pastDue} past their due time, ${live.length} to look at.`}
          </p>
        </div>
        {live.length > 0 ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setShowAll(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                  filter === f.id
                    ? "bg-accent-soft text-accent-strong"
                    : "text-fg-subtle hover:bg-muted hover:text-fg",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="p-4">
        {live.length === 0 ? (
          <CaughtUp nurture={nurture} />
        ) : filtered.length === 0 ? (
          <p className="py-2 text-[13px] text-fg-subtle">Nothing in this filter right now.</p>
        ) : (
          <>
            <ul className="divide-y divide-border-soft">
              {shown.map((a) => (
                <NeedRow key={`${a.companyId}:${a.kind}`} a={a} onSnooze={() => snooze(a)} />
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2.5 text-[12px] text-fg-subtle">
              <span>
                {filtered.length > TOP_N && !showAll
                  ? `Showing the ${shown.length} most pressing of ${filtered.length}. Snoozed items come back in 7 days.`
                  : "Snoozed items come back in 7 days."}
              </span>
              {filtered.length > TOP_N ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="shrink-0 font-medium text-accent-strong hover:underline"
                >
                  {showAll ? "Show less" : "Show all"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function NeedRow({ a, onSnooze }: { a: NextAction; onSnooze: () => void }) {
  const dot =
    a.severity === "danger" ? "bg-danger" : a.severity === "warn" ? "bg-warning" : "bg-accent";
  return (
    <li className="group flex items-start gap-3 py-2.5">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-fg">
          <Link href={a.href} className="font-semibold hover:text-accent-strong">
            {a.companyName}
          </Link>
          <span className="text-fg-muted"> {a.label}</span>
        </p>
        {a.detail ? <p className="mt-0.5 truncate text-[12px] text-fg-subtle">{a.detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onSnooze}
          aria-label={`Snooze ${a.companyName} for 7 days`}
          className="rounded-md p-1 text-fg-subtle opacity-0 transition-opacity hover:bg-muted hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={15} strokeWidth={1.9} />
        </button>
        <Link
          href={a.href}
          className="inline-flex items-center gap-0.5 whitespace-nowrap text-[13px] font-medium text-accent-strong hover:underline"
        >
          {ctaFor(a.kind)}
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        {icon ? (
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent-soft text-accent-strong">
            {icon}
          </span>
        ) : null}
        <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
        {typeof count === "number" && count > 0 ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">{count}</span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
