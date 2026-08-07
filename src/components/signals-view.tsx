"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, ListPlus, Radar, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Signal, SignalType } from "@/lib/crm/types";
import { Badge, type BadgeColor, IconButton, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

/** The outreach angle Luna drafts from when you act on a signal. */
export function draftAngleFor(s: Signal): string {
  return `Following up on this: "${s.headline || "recent news"}"${s.url ? ` — ${s.url}` : ""}`;
}

const TYPE_COLOR: Record<SignalType, BadgeColor> = {
  Funding: "success",
  Award: "accent",
  "Job Change": "info",
  News: "navy",
  "LinkedIn Post": "info",
  "Website Change": "warning",
  Other: "neutral",
};

function whenLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function SignalRow({
  s,
  showCompany,
  onDraft,
  onActioned,
  onDismissed,
}: {
  s: Signal;
  showCompany?: boolean;
  /** Open the outreach composer in-page, seeded from this signal. When absent, the
   *  Draft button deep-links to the account instead (e.g. on the Today feed). */
  onDraft?: (angle: string, contactId?: string) => void;
  onActioned: (id: string) => void;
  onDismissed: (id: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const angle = draftAngleFor(s);

  async function setStatus(status: "Actioned" | "Dismissed") {
    setBusy(true);
    try {
      await api(`/api/signals/${s.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (status === "Actioned") onActioned(s.id);
      else onDismissed(s.id);
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
      setBusy(false);
    }
  }

  async function createTask() {
    setBusy(true);
    try {
      await api(`/api/signals/${s.id}/task`, { method: "POST" });
      toast.success("Task created", { description: "A follow-up task is on the account, due in 3 days." });
      onActioned(s.id);
    } catch (e) {
      toast.error("Couldn't create task", { description: (e as Error).message });
      setBusy(false);
    }
  }

  const draftBtnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {s.type ? <Badge color={TYPE_COLOR[s.type]}>{s.type}</Badge> : null}
          {showCompany && s.companyId ? (
            <Link href={`/companies/${s.companyId}`} className="text-[12px] font-medium text-fg hover:text-accent-strong">
              {s.companyName || "Company"}
            </Link>
          ) : null}
          <span className="text-[11.5px] text-fg-subtle">{whenLabel(s.dateFound || s.createdTime)}</span>
        </div>
        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-start gap-1 text-[13.5px] text-fg hover:text-accent-strong"
          >
            <span className="line-clamp-2">{s.headline || s.url}</span>
            <ExternalLink size={13} strokeWidth={1.9} className="mt-0.5 shrink-0 text-fg-subtle" />
          </a>
        ) : (
          <span className="text-[13.5px] text-fg">{s.headline}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onDraft ? (
          <IconButton label="Draft email" onClick={() => onDraft(angle)} className="hover:text-accent-strong" disabled={busy}>
            <Sparkles size={15} strokeWidth={1.9} />
          </IconButton>
        ) : s.companyId ? (
          <Link
            href={`/companies/${s.companyId}?angle=${encodeURIComponent(angle)}`}
            aria-label="Draft email"
            title="Draft email"
            className={draftBtnClass}
          >
            <Sparkles size={15} strokeWidth={1.9} />
          </Link>
        ) : null}
        <IconButton label="Create follow-up task" onClick={createTask} className="hover:text-accent-strong" disabled={busy}>
          {busy ? <Spinner /> : <ListPlus size={15} strokeWidth={1.9} />}
        </IconButton>
        <IconButton label="Mark actioned" onClick={() => setStatus("Actioned")} className="hover:text-success" disabled={busy}>
          <Check size={15} strokeWidth={2} />
        </IconButton>
        <IconButton label="Dismiss" onClick={() => setStatus("Dismissed")} className="hover:text-danger" disabled={busy}>
          <X size={15} strokeWidth={2} />
        </IconButton>
      </div>
    </li>
  );
}

/** Today feed: recent New signals across the whole base. Renders nothing if empty. */
export function SignalsFeed() {
  const [signals, setSignals] = useState<Signal[] | null>(null);

  useEffect(() => {
    api<{ signals: Signal[] }>("/api/signals?status=New&limit=8")
      .then((d) => setSignals(d.signals))
      .catch(() => setSignals([]));
  }, []);

  const remove = (id: string) => setSignals((xs) => (xs ? xs.filter((s) => s.id !== id) : xs));

  if (!signals || signals.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2.5 flex items-center gap-2">
        <Radar size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Signals</h2>
        <span className="text-[12px] text-fg-subtle">{signals.length} new to review</span>
      </div>
      <ul className="space-y-1.5">
        {signals.map((s) => (
          <SignalRow key={s.id} s={s} showCompany onActioned={remove} onDismissed={remove} />
        ))}
      </ul>
    </section>
  );
}

/** Company 360 panel: all live signals for one account. */
export function CompanySignals({
  companyId,
  onDraft,
}: {
  companyId: string;
  onDraft?: (angle: string, contactId?: string) => void;
}) {
  const [signals, setSignals] = useState<Signal[] | null>(null);

  useEffect(() => {
    api<{ signals: Signal[] }>(`/api/signals?companyId=${encodeURIComponent(companyId)}`)
      .then((d) => setSignals(d.signals))
      .catch(() => setSignals([]));
  }, [companyId]);

  const remove = (id: string) => setSignals((xs) => (xs ? xs.filter((s) => s.id !== id) : xs));

  if (!signals) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-fg-subtle">
        <Spinner /> Loading signals…
      </div>
    );
  }
  // Hide already-handled signals from the panel; keep New + Seen.
  const live = signals.filter((s) => s.status === "New" || s.status === "Seen");
  if (live.length === 0) {
    return <p className="py-1 text-[13px] text-fg-subtle">No signals yet — the daily scan will surface news as it finds it.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {live.map((s) => (
        <SignalRow key={s.id} s={s} onDraft={onDraft} onActioned={remove} onDismissed={remove} />
      ))}
    </ul>
  );
}
