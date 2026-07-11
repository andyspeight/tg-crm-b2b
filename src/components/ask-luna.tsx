"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  Check,
  CornerDownLeft,
  HeartHandshake,
  ListPlus,
  Sparkles,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn, Spinner } from "@/components/ui";

type AskResult = {
  type: "company" | "contact" | "deal";
  id: string;
  name: string;
  sub?: string;
  href: string;
};
type AskProposal = {
  type: "task" | "care_touch" | "note";
  summary: string;
  params: Record<string, unknown>;
};
type AskResponse = { answer: string; results: AskResult[]; proposals: AskProposal[] };

const EXAMPLES = [
  "How's my pipeline looking?",
  "Which customers are Amber or Red?",
  "Deals with no next step",
  "UK tour operators we haven't spoken to in 60 days",
];

const RESULT_ICON = { company: Building2, contact: User, deal: Briefcase } as const;
const PROPOSAL_ICON = { task: ListPlus, care_touch: HeartHandshake, note: StickyNote } as const;

export function AskLuna() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<AskResponse | null>(null);
  const [asked, setAsked] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const run = useCallback(async (question: string) => {
    const query = question.trim();
    if (!query) return;
    setAsked(query);
    setLoading(true);
    setError(null);
    setRes(null);
    try {
      const data = await api<AskResponse>("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: query }),
      });
      setRes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(q);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Luna"
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent-soft bg-accent-soft/40 px-2.5 text-[13px] font-medium text-accent-strong transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Sparkles size={15} strokeWidth={1.9} />
        <span className="hidden sm:inline">Ask Luna</span>
        <kbd className="ml-0.5 hidden rounded border border-accent-soft bg-card/60 px-1 text-[10px] font-medium text-accent-strong lg:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Ask Luna">
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="luna-fade relative mx-auto mt-[9vh] flex w-[92%] max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-15px_rgba(8,15,30,0.45)]">
            <form onSubmit={submit} className="flex items-center gap-2 border-b border-border-soft px-3">
              <Sparkles size={17} strokeWidth={1.9} className="shrink-0 text-accent-strong" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask about any client, deal or trend…"
                aria-label="Ask Luna a question"
                className="h-12 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus-visible:outline-none"
              />
              {q.trim() && (
                <button
                  type="submit"
                  aria-label="Ask"
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-btn px-2 text-[12px] font-medium text-btn-fg transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <CornerDownLeft size={13} strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={16} strokeWidth={1.9} />
              </button>
            </form>

            <div className="max-h-[62vh] overflow-y-auto p-4">
              {loading ? (
                <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
                  <Spinner /> Luna is thinking…
                </p>
              ) : error ? (
                <div className="space-y-1">
                  <p className="text-[13px] text-danger">{error}</p>
                  <p className="text-[12px] text-fg-subtle">
                    If this says AI isn&apos;t configured, set <code>ANTHROPIC_API_KEY</code> in Vercel.
                  </p>
                </div>
              ) : res ? (
                <Answer res={res} asked={asked} onNavigate={() => setOpen(false)} />
              ) : (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Try asking
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => {
                          setQ(ex);
                          run(ex);
                        }}
                        className="rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:border-border hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-fg-subtle">
                    Luna reads your CRM to answer — it never changes anything.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Answer({
  res,
  asked,
  onNavigate,
}: {
  res: AskResponse;
  asked: string;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-3">
      {asked ? <p className="text-[12px] text-fg-subtle">“{asked}”</p> : null}

      <div className="space-y-2 text-[14px] leading-relaxed text-fg">
        {res.answer.split(/\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {res.proposals.length > 0 ? (
        <div className="space-y-1.5">
          {res.proposals.map((p, i) => (
            <ProposalCard key={i} proposal={p} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}

      {res.results.length > 0 ? (
        <div className="border-t border-border-soft pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Mentioned
          </p>
          <div className="space-y-1">
            {res.results.map((r) => {
              const Icon = RESULT_ICON[r.type];
              return (
                <Link
                  key={`${r.type}:${r.id}`}
                  href={r.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                  <span className="truncate text-[13px] font-medium text-fg">{r.name}</span>
                  {r.sub ? <span className="truncate text-[12px] text-fg-subtle">{r.sub}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProposalCard({ proposal, onNavigate }: { proposal: AskProposal; onNavigate: () => void }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [href, setHref] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const Icon = PROPOSAL_ICON[proposal.type];

  async function confirm() {
    setStatus("saving");
    try {
      const data = await api<{ ok: boolean; message: string; record?: { name: string; href: string } }>(
        "/api/ai/act",
        { method: "POST", body: JSON.stringify({ action: { type: proposal.type, params: proposal.params } }) },
      );
      setMessage(data.message || "Done.");
      setHref(data.record?.href ?? null);
      setStatus("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't do that.");
      setStatus("error");
    }
  }

  if (dismissed) return null;

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-[13px]">
        <Check size={15} strokeWidth={2.2} className="shrink-0 text-success" aria-hidden />
        <span className="flex-1 text-fg">{message}</span>
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="shrink-0 text-[12px] font-medium text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent-soft bg-accent-soft/30 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Icon size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
        <p className="flex-1 text-[13px] text-fg">{proposal.summary}</p>
      </div>
      {status === "error" ? <p className="mt-1 pl-6 text-[12px] text-danger">{message}</p> : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={status === "saving"}
          className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={status === "saving"}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-btn px-3 text-[12px] font-medium text-btn-fg transition-[filter] hover:brightness-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
        >
          {status === "saving" ? <Spinner /> : <Check size={13} strokeWidth={2.2} />}
          {status === "error" ? "Retry" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
