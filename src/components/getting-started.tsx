"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Columns3, Download, HeartHandshake, ListChecks, MessageSquareText, X } from "lucide-react";
import { cn, IconButton } from "@/components/ui";

type Step = {
  id: string;
  title: string;
  hint: string;
  href: string;
  icon: typeof Download;
};

const STEPS: Step[] = [
  {
    id: "import",
    title: "Bring your data across",
    hint: "Import companies, contacts, deals and client health from Monday. Tip: your Airtable token needs write access first.",
    href: "/import",
    icon: Download,
  },
  {
    id: "health",
    title: "Triage client health",
    hint: "Spot who's Amber or Red on the Care board so no customer wilts after go-live.",
    href: "/care",
    icon: HeartHandshake,
  },
  {
    id: "care",
    title: "Log your first care touch",
    hint: "One tap records the outcome and schedules the next one on cadence.",
    href: "/care",
    icon: MessageSquareText,
  },
  {
    id: "pipeline",
    title: "Clear your pipeline",
    hint: "Chase any deal with no next step, or one that's gone stale (amber at 14 days).",
    href: "/pipeline",
    icon: Columns3,
  },
];

const DONE_KEY = "luna.onboarding.done";
const DISMISS_KEY = "luna.onboarding.dismissed";

export function GettingStarted() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      const raw = localStorage.getItem(DONE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // localStorage unavailable (private mode) — just show the card
    }
    setMounted(true);
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  // Avoid a hydration flash: render nothing until we've read localStorage.
  if (!mounted || dismissed) return null;

  const count = done.filter((id) => STEPS.some((s) => s.id === id)).length;
  const pct = count / STEPS.length;
  const allDone = count === STEPS.length;

  return (
    <section
      aria-label="Getting started"
      className="luna-fade rounded-xl border border-accent-soft bg-accent-soft/40 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent-strong">
            <ListChecks size={16} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-fg">
              {allDone ? "You're all set" : "Getting started"}
            </h2>
            <p className="text-[12px] text-fg-subtle">
              {allDone
                ? "Luna Desk is ready — dismiss this when you like."
                : `${count} of ${STEPS.length} done · your first few minutes with Luna Desk`}
            </p>
          </div>
        </div>
        <IconButton label="Dismiss getting started" onClick={dismiss}>
          <X size={16} strokeWidth={1.9} />
        </IconButton>
      </div>

      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-card"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-label="Setup progress"
      >
        <div
          className="h-full origin-left rounded-full bg-accent-strong transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${pct})` }}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {STEPS.map((step) => {
          const isDone = done.includes(step.id);
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toggle(step.id)}
                aria-pressed={isDone}
                aria-label={isDone ? `Mark "${step.title}" not done` : `Mark "${step.title}" done`}
                className={cn(
                  "-m-1.5 grid shrink-0 cursor-pointer rounded-full p-1.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border transition-colors",
                    isDone
                      ? "border-accent-strong bg-accent-strong text-white"
                      : "border-border bg-card text-transparent",
                  )}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>

              <Link
                href={step.href}
                className="group flex flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 self-start text-fg-subtle"
                  aria-hidden
                />
                <span className="flex-1">
                  <span
                    className={cn(
                      "block text-[13px] font-medium",
                      isDone ? "text-fg-subtle line-through" : "text-fg",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="block text-[12px] text-fg-subtle">{step.hint}</span>
                </span>
                <ArrowRight
                  size={15}
                  strokeWidth={1.9}
                  className="shrink-0 self-center text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
