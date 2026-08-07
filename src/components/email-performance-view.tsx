"use client";

import Link from "next/link";
import { AlertTriangle, Mail, MailOpen, MessageSquareReply, Send } from "lucide-react";
import type { EmailPerformance, OpensSummary } from "@/lib/crm/email-performance";
import { pct } from "@/lib/crm/email-performance";
import { Badge, type BadgeColor, EmptyState, InlineAlert, PageHeader, StatTile } from "@/components/ui";

function rateColor(rate: number): BadgeColor {
  if (rate >= 0.25) return "success";
  if (rate >= 0.1) return "info";
  if (rate > 0) return "warning";
  return "neutral";
}

/** Weekly send volume as simple, accessible bars (no chart lib). */
function VolumeChart({ weekly }: { weekly: EmailPerformance["weekly"] }) {
  const max = Math.max(1, ...weekly.map((w) => w.sent));
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Send size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Sends per week</h2>
        <span className="text-[12px] text-fg-subtle">last {weekly.length} weeks</span>
      </div>
      <div className="flex items-end gap-2" style={{ height: 132 }}>
        {weekly.map((w) => {
          const h = w.sent === 0 ? 3 : Math.max(6, Math.round((w.sent / max) * 112));
          return (
            <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="tnum text-[11px] font-medium text-fg-muted">{w.sent || ""}</span>
              <div
                className="w-full rounded-md bg-accent/70"
                style={{ height: h }}
                title={`Week of ${w.label}: ${w.sent} sent`}
                aria-label={`Week of ${w.label}: ${w.sent} sent`}
              />
              <span className="text-[10.5px] text-fg-subtle">{w.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function EmailPerformanceView({ data, opens }: { data: EmailPerformance; opens: OpensSummary }) {
  const { sent, reply, outcomes, sequences, failures, weekly } = data;
  const hasAny = sent.total > 0 || reply.enrolled > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email performance"
        description="How your outreach is landing — sends over time and the replies your sequences earn."
        actions={
          <Link href="/sequences" className="text-[13px] font-medium text-accent-strong hover:underline">
            Manage sequences →
          </Link>
        }
      />

      {!hasAny ? (
        <EmptyState
          icon={<Mail size={20} strokeWidth={1.75} />}
          title="No email activity yet"
          hint="Once you send emails and enrol people into sequences, this fills in — sends over time, reply rates, and anything that failed to send."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<Send size={16} strokeWidth={1.9} />}
              label="Sent · 30 days"
              value={String(sent.last30)}
              sub={`${sent.total} all time · ${sent.last7} this week`}
            />
            <StatTile
              icon={<MailOpen size={16} strokeWidth={1.9} />}
              label="Open rate"
              value={opens.tracked ? pct(opens.openRate) : "—"}
              sub={
                opens.tracked
                  ? `${opens.opened} of ${opens.tracked} opened${opens.downloads ? ` · ${opens.downloads} downloaded` : ""}`
                  : "no tracked sends yet"
              }
              tone={opens.tracked && opens.openRate >= 0.3 ? "success" : undefined}
            />
            <StatTile
              icon={<MessageSquareReply size={16} strokeWidth={1.9} />}
              label="Reply rate"
              value={reply.enrolled ? pct(reply.rate) : "—"}
              sub={reply.enrolled ? `${reply.replied} of ${reply.enrolled} replied · ${outcomes.active} in flight` : "no sequence sends yet"}
              tone={reply.enrolled && reply.rate >= 0.15 ? "success" : undefined}
            />
            <StatTile
              icon={<AlertTriangle size={16} strokeWidth={1.9} />}
              label="Failed to send"
              value={String(outcomes.failed)}
              sub={outcomes.failed ? "needs a look" : "all clear"}
              tone={outcomes.failed ? "danger" : undefined}
            />
          </div>

          <VolumeChart weekly={weekly} />

          {/* Per-sequence reply performance */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
              <MessageSquareReply size={16} strokeWidth={1.9} className="text-accent-strong" />
              <h2 className="text-[14px] font-semibold text-fg">By sequence</h2>
            </div>
            {sequences.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-fg-subtle sm:px-5">
                No sequence enrolments yet. Start one from{" "}
                <Link href="/sequences" className="font-medium text-accent-strong hover:underline">
                  Sequences
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border-soft text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                      <th className="px-4 py-2.5 sm:px-5">Sequence</th>
                      <th className="px-3 py-2.5 text-right">Enrolled</th>
                      <th className="px-3 py-2.5 text-right">Active</th>
                      <th className="px-3 py-2.5 text-right">Replied</th>
                      <th className="px-3 py-2.5 text-right">Completed</th>
                      <th className="px-3 py-2.5 text-right">Stopped</th>
                      <th className="px-3 py-2.5 text-right">Failed</th>
                      <th className="px-4 py-2.5 text-right sm:px-5">Reply rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {sequences.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-medium text-fg sm:px-5">{s.name}</td>
                        <td className="tnum px-3 py-2.5 text-right text-fg-muted">{s.enrolled}</td>
                        <td className="tnum px-3 py-2.5 text-right text-fg-muted">{s.active || "·"}</td>
                        <td className="tnum px-3 py-2.5 text-right font-medium text-fg">{s.replied || "·"}</td>
                        <td className="tnum px-3 py-2.5 text-right text-fg-muted">{s.completed || "·"}</td>
                        <td className="tnum px-3 py-2.5 text-right text-fg-muted">{s.stopped || "·"}</td>
                        <td className={s.failed ? "tnum px-3 py-2.5 text-right font-medium text-danger" : "tnum px-3 py-2.5 text-right text-fg-muted"}>
                          {s.failed || "·"}
                        </td>
                        <td className="px-4 py-2.5 text-right sm:px-5">
                          <Badge color={rateColor(s.replyRate)}>{s.enrolled ? pct(s.replyRate) : "—"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Delivery issues */}
          {failures.length > 0 ? (
            <section className="rounded-2xl border border-danger/25 bg-card p-4 shadow-card sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} strokeWidth={1.9} className="text-danger" />
                <h2 className="text-[14px] font-semibold text-fg">Didn&apos;t send</h2>
                <span className="text-[12px] text-fg-subtle">{failures.length} to look at</span>
              </div>
              <ul className="space-y-2">
                {failures.map((f, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                    <span className="font-medium text-fg">{f.contactName || f.contactEmail || "A contact"}</span>
                    {f.sequenceName ? <span className="text-[12px] text-fg-subtle">· {f.sequenceName}</span> : null}
                    <span className="w-full text-[12.5px] text-danger sm:w-auto sm:flex-1">
                      {f.lastError || "Send failed"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <InlineAlert variant="info">
            Opens are tracked with a pixel and attachments with tracked links, so a first open or download lands on the
            account timeline. Note that image-privacy features (e.g. Apple Mail) can pre-load the pixel and show an open
            the recipient didn&apos;t make — the reply is still the surest signal, and a sequence auto-stops on reply.
          </InlineAlert>
        </>
      )}
    </div>
  );
}
