"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Reply, RotateCcw, Send, X } from "lucide-react";
import { api } from "@/lib/client";
import type { SequenceEnrollment } from "@/lib/crm/types";
import { IconButton, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

type Feed = { replied: SequenceEnrollment[]; failed: SequenceEnrollment[] };

/** Today panel: sequence replies to follow up, and enrollments that failed. */
export function SequencesFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api<Feed>("/api/today/sequences")
      .then(setFeed)
      .catch(() => setFeed({ replied: [], failed: [] }));
  }, []);

  function drop(list: "replied" | "failed", id: string) {
    setFeed((f) => (f ? { ...f, [list]: f[list].filter((e) => e.id !== id) } : f));
  }

  async function dismiss(list: "replied" | "failed", id: string) {
    setBusy(id);
    drop(list, id);
    try {
      await api("/api/today/sequences/dismiss", { method: "POST", body: JSON.stringify({ id }) });
    } catch {
      /* best-effort; it reappears on next load if the write failed */
    } finally {
      setBusy(null);
    }
  }

  async function retry(id: string) {
    setBusy(id);
    try {
      await api(`/api/sequences/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "retry" }),
      });
      drop("failed", id);
      toast.success("Re-armed — it'll send again on the next run.");
    } catch (e) {
      toast.error("Couldn't retry", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!feed || (feed.replied.length === 0 && feed.failed.length === 0)) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2.5 flex items-center gap-2">
        <Send size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">From your sequences</h2>
      </div>

      {feed.replied.length > 0 ? (
        <div className="mb-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Replied — follow up ({feed.replied.length})
          </p>
          <ul className="space-y-1.5">
            {feed.replied.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2">
                <Reply size={15} strokeWidth={1.9} className="shrink-0 text-info" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-fg">
                    <span className="font-medium">{e.contactName || "Contact"}</span>
                    <span className="text-fg-muted"> replied · {e.sequenceName || "sequence"} stopped</span>
                  </p>
                </div>
                {e.companyId ? (
                  <Link
                    href={`/companies/${e.companyId}`}
                    className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-accent-strong hover:underline"
                  >
                    Open <ChevronRight size={14} strokeWidth={2} aria-hidden />
                  </Link>
                ) : null}
                <IconButton label="Dismiss" onClick={() => dismiss("replied", e.id)} disabled={busy === e.id}>
                  {busy === e.id ? <Spinner /> : <X size={15} strokeWidth={1.9} />}
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feed.failed.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Needs attention ({feed.failed.length})
          </p>
          <ul className="space-y-1.5">
            {feed.failed.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2">
                <AlertTriangle size={15} strokeWidth={1.9} className="shrink-0 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-fg">
                    <span className="font-medium">{e.contactName || "Contact"}</span>
                    <span className="text-fg-muted"> · {e.sequenceName || "sequence"}</span>
                  </p>
                  {e.lastError ? <p className="truncate text-[12px] text-fg-subtle">{e.lastError}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => retry(e.id)}
                  disabled={busy === e.id}
                  className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline disabled:opacity-50"
                >
                  {busy === e.id ? <Spinner /> : <RotateCcw size={14} strokeWidth={2} aria-hidden />} Retry
                </button>
                <IconButton label="Dismiss" onClick={() => dismiss("failed", e.id)} disabled={busy === e.id}>
                  <X size={15} strokeWidth={1.9} />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
