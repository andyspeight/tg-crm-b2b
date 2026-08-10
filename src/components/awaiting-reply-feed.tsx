"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Reply } from "lucide-react";
import { api } from "@/lib/client";
import type { AwaitingReply } from "@/lib/crm/types";

function waited(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** Today panel: contacts who emailed and are still waiting on a reply. */
export function AwaitingReplyFeed() {
  const [rows, setRows] = useState<AwaitingReply[] | null>(null);

  useEffect(() => {
    api<{ awaiting: AwaitingReply[] }>("/api/today/awaiting-reply")
      .then((d) => setRows(d.awaiting))
      .catch(() => setRows([]));
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2.5 flex items-center gap-2">
        <Reply size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Awaiting your reply</h2>
        <span className="text-[12px] text-fg-subtle">they emailed — the ball&apos;s with you</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const who = r.contactName || "Someone";
          const href = r.companyId
            ? r.gmailMessageId
              ? `/companies/${r.companyId}?email=${encodeURIComponent(r.gmailMessageId)}`
              : `/companies/${r.companyId}`
            : null;
          const overdue = r.ageDays >= 3;
          return (
            <li
              key={`${r.contactId}-${r.date}`}
              className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2"
            >
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${overdue ? "bg-warning" : "bg-accent-strong"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-fg">
                  <span className="font-medium">{who}</span>
                  {r.subject ? <span className="text-fg-muted"> — {r.subject}</span> : null}
                </p>
                <p className="truncate text-[12px] text-fg-subtle">
                  waiting {waited(r.ageDays)}
                  {r.companyName ? ` · ${r.companyName}` : ""}
                </p>
              </div>
              {href ? (
                <Link
                  href={href}
                  className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-accent-strong hover:underline"
                >
                  Reply <ChevronRight size={14} strokeWidth={2} aria-hidden />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
