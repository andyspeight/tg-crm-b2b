"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  HeartHandshake,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Task } from "@/lib/crm/types";
import type { NextAction } from "@/lib/crm/next-actions";
import { isPast } from "@/lib/deal-flags";
import { Button, EmptyState } from "@/components/ui";
import { QuickActions } from "@/components/quick-actions";
import { LogTouchModal } from "@/components/log-touch-modal";
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
  tasks: initialTasks,
  nextActions,
  careDue,
  vitals,
  nurture,
}: {
  tasks: Task[];
  nextActions: NextAction[];
  careDue: CareDueItem[];
  vitals: Vitals;
  nurture: NurtureItem[];
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

  const pulse = [
    `${vitals.customers} ${vitals.customers === 1 ? "customer" : "customers"}`,
    vitals.openMrr > 0 ? `${formatMoney(vitals.openMrr)}/mo in play` : null,
    nextActions.length > 0 ? `${nextActions.length} need${nextActions.length === 1 ? "s" : ""} you` : "all caught up",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-fg">{greeting}</h1>
        <p className="mt-1 text-[13px] text-fg-subtle">
          {dateStr} · {pulse}
        </p>
      </div>

      <QuickActions />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <VitalTile
          href="/companies"
          label="Customers"
          value={String(vitals.customers)}
          sub={`${vitals.leads} ${vitals.leads === 1 ? "lead" : "leads"}`}
          icon={<Users size={16} strokeWidth={2} />}
          live
        />
        <VitalTile
          href="/pipeline"
          label="Pipeline"
          value={formatMoney(vitals.openMrr)}
          sub={`${vitals.openDeals} open ${vitals.openDeals === 1 ? "deal" : "deals"}`}
          icon={<Wallet size={16} strokeWidth={2} />}
          tone="navy"
        />
        <VitalTile
          href="/care"
          label="Needs attention"
          value={String(vitals.needsAttention)}
          sub="Amber / Red"
          icon={<AlertTriangle size={16} strokeWidth={2} />}
          tone={vitals.needsAttention > 0 ? "warn" : undefined}
        />
        <VitalTile
          href="/care"
          label="Care due"
          value={String(careList.length)}
          sub="next 14 days"
          icon={<HeartHandshake size={16} strokeWidth={2} />}
          tone={careList.some((c) => c.overdue) ? "danger" : undefined}
        />
      </div>

      <Section title="Do next" count={nextActions.length} icon={<Zap size={14} strokeWidth={2.2} />}>
        {nextActions.length === 0 ? (
          <CaughtUp nurture={nurture} />
        ) : (
          <ul className="divide-y divide-border-soft">
            {nextActions.map((a) => (
              <NextActionRow key={`${a.companyId}:${a.kind}`} a={a} />
            ))}
          </ul>
        )}
      </Section>

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

      <p className="flex items-center gap-1.5 px-1 text-[12px] text-fg-subtle">
        <Sparkles size={13} strokeWidth={1.75} aria-hidden />
        Signal monitoring — watched accounts&rsquo; news and social — arrives next in Stage 5.
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

function VitalTile({
  href,
  label,
  value,
  sub,
  icon,
  tone,
  live,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "warn" | "danger" | "navy";
  live?: boolean;
}) {
  const chip =
    tone === "warn"
      ? "bg-warning/15 text-warning"
      : tone === "danger"
        ? "bg-danger/15 text-danger"
        : tone === "navy"
          ? "bg-navy/10 text-navy"
          : "bg-accent-soft text-accent-strong";
  const valueColor = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg";
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-card transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-raise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-xl transition-transform group-hover:scale-105 ${chip}`}>
          {icon}
        </span>
        {live ? (
          <span className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
        ) : null}
      </div>
      <p className={`tnum mt-2.5 text-[24px] font-semibold leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{sub}</p> : null}
    </Link>
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

function NextActionRow({ a }: { a: NextAction }) {
  const color =
    a.severity === "danger" ? "text-danger" : a.severity === "warn" ? "text-warning" : "text-accent-strong";
  const Icon = a.severity === "info" ? Clock : AlertTriangle;
  return (
    <li>
      <Link
        href={a.href}
        className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
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
