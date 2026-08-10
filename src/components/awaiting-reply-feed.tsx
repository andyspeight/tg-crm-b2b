"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Reply, X } from "lucide-react";
import { api } from "@/lib/client";
import { cn, IconButton } from "@/components/ui";
import type { AwaitingReply } from "@/lib/crm/types";

function waited(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** Where clicking the row goes — the email on the timeline, or the person in People. */
function emailHref(r: AwaitingReply): string {
  if (r.companyId) {
    return r.gmailMessageId
      ? `/companies/${r.companyId}?email=${encodeURIComponent(r.gmailMessageId)}`
      : `/companies/${r.companyId}`;
  }
  return `/contacts?q=${encodeURIComponent(r.contactName || "")}`;
}

/** Where "Reply" goes — opens the composer for this contact. */
function replyHref(r: AwaitingReply): string {
  if (r.companyId && r.contactId) {
    return `/companies/${r.companyId}?reply=${encodeURIComponent(r.contactId)}`;
  }
  return `/contacts?q=${encodeURIComponent(r.contactName || "")}`;
}

/** Today panel: contacts who emailed and are still waiting on a reply. */
export function AwaitingReplyFeed({ className }: { className?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<AwaitingReply[] | null>(null);

  useEffect(() => {
    api<{ awaiting: AwaitingReply[] }>("/api/today/awaiting-reply")
      .then((d) => setRows(d.awaiting))
      .catch(() => setRows([]));
  }, []);

  async function dismiss(r: AwaitingReply, mode: "ignore" | "pause") {
    setRows((rs) => (rs || []).filter((x) => x.key !== r.key));
    try {
      await api("/api/today/awaiting-reply/dismiss", {
        method: "POST",
        body: JSON.stringify({ key: r.key, mode }),
      });
    } catch {
      /* optimistic — a failed hide just reappears on next load */
    }
  }

  if (!rows || rows.length === 0) return null;

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <Reply size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Awaiting your reply</h2>
        <span className="hidden text-[12px] text-fg-subtle sm:inline">the ball&apos;s with you</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const overdue = r.ageDays >= 3;
          return (
            <li
              key={r.key}
              role="button"
              tabIndex={0}
              onClick={() => router.push(emailHref(r))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(emailHref(r));
                }
              }}
              className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border-soft bg-surface px-3 py-2 transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", overdue ? "bg-warning" : "bg-accent-strong")}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-fg">
                  <span className="font-medium">{r.contactName || "Someone"}</span>
                  {r.subject ? <span className="text-fg-muted"> — {r.subject}</span> : null}
                </p>
                <p className="truncate text-[12px] text-fg-subtle">
                  waiting {waited(r.ageDays)}
                  {r.companyName ? ` · ${r.companyName}` : ""}
                </p>
              </div>
              <div
                className="flex shrink-0 items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={replyHref(r)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-accent-strong hover:bg-accent/10"
                >
                  <Reply size={14} strokeWidth={2} aria-hidden /> Reply
                </Link>
                <IconButton
                  label="Snooze until tomorrow"
                  onClick={() => dismiss(r, "pause")}
                  className="h-7 w-7 opacity-60 transition-opacity group-hover:opacity-100"
                >
                  <Clock size={15} strokeWidth={1.9} />
                </IconButton>
                <IconButton
                  label="Ignore"
                  onClick={() => dismiss(r, "ignore")}
                  className="h-7 w-7 opacity-60 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <X size={15} strokeWidth={1.9} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
