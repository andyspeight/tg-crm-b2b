"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, MailOpen } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/components/ui";
import type { EmailTracking } from "@/lib/crm/types";

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/** Today panel: emails opened / attachments downloaded recently. They're warm. */
export function OpensFeed({ className }: { className?: string }) {
  const [opens, setOpens] = useState<EmailTracking[] | null>(null);

  useEffect(() => {
    api<{ opens: EmailTracking[] }>("/api/today/opens")
      .then((d) => setOpens(d.opens))
      .catch(() => setOpens([]));
  }, []);

  if (!opens || opens.length === 0) return null;

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <MailOpen size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Opened your email</h2>
        <span className="text-[12px] text-fg-subtle">they&apos;re warm — follow up</span>
      </div>
      <ul className="space-y-1.5">
        {opens.map((o) => {
          const who = o.contactName || o.recipient || "Someone";
          const isDownload = o.kind === "Attachment";
          const Icon = isDownload ? Download : MailOpen;
          return (
            <li key={o.id} className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2">
              <Icon size={15} strokeWidth={1.9} className="shrink-0 text-success" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-fg">
                  <span className="font-medium">{who}</span>
                  <span className="text-fg-muted">
                    {isDownload
                      ? ` downloaded ${o.filename || "an attachment"}`
                      : ` opened ${o.subject ? `“${o.subject}”` : "your email"}`}
                  </span>
                </p>
                <p className="truncate text-[12px] text-fg-subtle">
                  {o.opens > 1 ? `${o.opens}× · ` : ""}
                  {timeAgo(o.lastOpened)}
                  {o.companyName ? ` · ${o.companyName}` : ""}
                </p>
              </div>
              {o.companyId ? (
                <Link
                  href={
                    o.gmailMessageId
                      ? `/companies/${o.companyId}?email=${encodeURIComponent(o.gmailMessageId)}`
                      : `/companies/${o.companyId}`
                  }
                  className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-accent-strong hover:underline"
                >
                  Open email <ChevronRight size={14} strokeWidth={2} aria-hidden />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
