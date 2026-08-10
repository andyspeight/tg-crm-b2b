"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, History, Inbox, Mail, Plug, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { Button, InlineAlert, PageHeader, Spinner } from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";
import { formatDate } from "@/lib/format";
import type { InboxBackfillStatus, InboxSyncStatus } from "@/lib/crm/types";

type Status = {
  configured: boolean;
  connected: boolean;
  email?: string;
  name?: string;
  connectedAt?: string;
  canRead?: boolean;
  canSyncInbox?: boolean;
};

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "never";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/** Progress readout for the inbox sync — how much is done, how far it reaches. */
function SyncProgress({ s }: { s: InboxSyncStatus }) {
  const pct = s.contactsTotal > 0 ? Math.round((s.contactsSynced / s.contactsTotal) * 100) : 0;
  return (
    <div className="mt-3 rounded-xl border border-border-soft bg-surface p-3.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium text-fg">
          {s.contactsSynced.toLocaleString()} of {s.contactsTotal.toLocaleString()} contacts synced
        </p>
        <p className="text-[12px] tabular-nums text-fg-subtle">
          {s.contactsRemaining > 0 ? `${s.contactsRemaining.toLocaleString()} left` : "all caught up"}
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Contacts synced"
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Reaches back</dt>
          <dd className="text-[13px] font-medium tabular-nums text-fg">{s.windowDays} days</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Emails on file</dt>
          <dd className="text-[13px] font-medium tabular-nums text-fg">{s.emailsLogged.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Oldest email</dt>
          <dd className="text-[13px] font-medium text-fg">
            {s.oldestEmail ? formatDate(s.oldestEmail) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Last checked</dt>
          <dd className="text-[13px] font-medium text-fg">{timeAgo(s.lastSyncedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Progress readout for the one-off deep-history backfill. */
function BackfillProgress({ s, note }: { s: InboxBackfillStatus; note?: string }) {
  const pct = s.contactsTotal > 0 ? Math.round((s.contactsBackfilled / s.contactsTotal) * 100) : 0;
  const done = s.contactsRemaining === 0 && s.contactsTotal > 0;
  return (
    <div className="mt-3 rounded-xl border border-border-soft bg-surface p-3.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium text-fg">
          {s.contactsBackfilled.toLocaleString()} of {s.contactsTotal.toLocaleString()} contacts backfilled
        </p>
        <p className="text-[12px] tabular-nums text-fg-subtle">
          {done ? "complete" : `${s.contactsRemaining.toLocaleString()} left`}
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Contacts backfilled"
      >
        <div
          className="h-full rounded-full bg-accent-strong transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Reaches back</dt>
          <dd className="text-[13px] font-medium tabular-nums text-fg">
            {Math.round(s.windowDays / 365)} years
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Emails on file</dt>
          <dd className="text-[13px] font-medium tabular-nums text-fg">{s.emailsLogged.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Oldest email</dt>
          <dd className="text-[13px] font-medium text-fg">
            {s.oldestEmail ? formatDate(s.oldestEmail) : "—"}
          </dd>
        </div>
      </dl>
      {note ? <p className="mt-2.5 text-[12px] text-fg-subtle">{note}</p> : null}
    </div>
  );
}

export function SettingsView() {
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InboxSyncStatus | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<InboxBackfillStatus | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string>("");

  const flag = params.get("google"); // connected | error | denied (from the OAuth callback)

  async function load() {
    try {
      setStatus(await api<Status>("/api/google/status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load settings");
    }
  }

  async function loadSyncStatus() {
    try {
      setSyncStatus(await api<InboxSyncStatus>("/api/inbox/sync/status"));
    } catch {
      /* non-critical — the readout just won't show */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadBackfillStatus() {
    try {
      setBackfillStatus(await api<InboxBackfillStatus>("/api/inbox/backfill/status"));
    } catch {
      /* non-critical — the readout just won't show */
    }
  }

  // Fetch the sync progress once we know read access is on (kept separate from the
  // frequently-polled google/status so the contact scan doesn't slow the composer).
  useEffect(() => {
    if (status?.canSyncInbox) {
      loadSyncStatus();
      loadBackfillStatus();
    }
  }, [status?.canSyncInbox]);

  // "Backfill history" drives the bounded server passes in a loop until the whole
  // base is done, refreshing the progress bar after each pass so it fills live.
  async function runBackfill() {
    setBackfilling(true);
    setBackfillNote("Starting…");
    let logged = 0;
    let fails = 0; // consecutive failed passes — a blip shouldn't kill the run
    try {
      for (let pass = 0; pass < 1000; pass++) {
        let r: {
          ran: boolean;
          reason?: string;
          contactsScanned: number;
          messagesLogged: number;
          contactsRemaining: number;
        };
        try {
          r = await api("/api/inbox/backfill/run", { method: "POST" });
        } catch {
          // A single pass timing out or dropping shouldn't stop the whole backfill.
          if (++fails >= 4) {
            setBackfillNote("");
            toast.error("Backfill paused", {
              description: "A few passes failed in a row. It keeps running in the background — reopen to resume.",
            });
            break;
          }
          setBackfillNote("A pass hiccupped — retrying…");
          await new Promise((res) => setTimeout(res, 4000));
          continue;
        }
        fails = 0;
        if (!r.ran) {
          toast.error("Couldn't back-fill", { description: r.reason });
          break;
        }
        logged += r.messagesLogged;
        await loadBackfillStatus();
        if (r.contactsRemaining <= 0) {
          setBackfillNote("");
          toast.success("Backfill complete", {
            description: `${logged.toLocaleString()} email${logged === 1 ? "" : "s"} added to timelines`,
          });
          break;
        }
        setBackfillNote(`${logged.toLocaleString()} emails added so far · ${r.contactsRemaining} contacts to go…`);
      }
    } catch (e) {
      toast.error("Backfill failed", { description: (e as Error).message });
    } finally {
      setBackfilling(false);
      setBackfillNote("");
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    try {
      const r = await api<{ ran: boolean; reason?: string; contactsScanned: number; messagesLogged: number }>(
        "/api/inbox/sync/run",
        { method: "POST" },
      );
      if (!r.ran) {
        toast.error("Couldn't sync", { description: r.reason });
      } else {
        toast.success(`Synced · ${r.messagesLogged} email${r.messagesLogged === 1 ? "" : "s"} logged`, {
          description: `${r.contactsScanned} ${r.contactsScanned === 1 ? "contact" : "contacts"} checked`,
        });
      }
      await loadSyncStatus();
    } catch (e) {
      toast.error("Sync failed", { description: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect Gmail?",
      message: "You won't be able to send email from Luna Desk until you reconnect.",
      confirmLabel: "Disconnect",
    });
    if (!ok) return;
    setWorking(true);
    setError("");
    try {
      await api("/api/google/disconnect", { method: "POST" });
      await load();
      toast.success("Gmail disconnected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disconnect");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Settings" description="Connections and preferences for Luna Desk." />

      {flag === "connected" ? (
        <InlineAlert variant="success">Gmail connected. You can now send email from any company or contact.</InlineAlert>
      ) : flag === "denied" ? (
        <InlineAlert variant="info">Gmail connection was cancelled.</InlineAlert>
      ) : flag === "error" ? (
        <InlineAlert variant="danger">Something went wrong connecting Gmail. Please try again.</InlineAlert>
      ) : null}
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border-soft px-5 py-3.5">
          <Mail size={16} strokeWidth={1.9} className="text-accent-strong" />
          <h2 className="text-[14px] font-semibold text-fg">Email — Gmail</h2>
        </div>
        <div className="p-5">
          {status === null ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-subtle">
              <Spinner /> Checking connection…
            </div>
          ) : !status.configured ? (
            <div className="space-y-1.5">
              <p className="text-[14px] text-fg">Gmail sending isn&apos;t set up yet.</p>
              <p className="text-[13px] text-fg-subtle">
                It needs Google credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in the deployment.
                Once those are in, this is where you&apos;ll connect your mailbox.
              </p>
            </div>
          ) : status.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/12 text-success">
                  <CheckCircle2 size={20} strokeWidth={1.9} />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-fg">
                    Connected{status.name ? ` as ${status.name}` : ""}
                  </p>
                  <p className="text-[13px] text-fg-subtle">
                    {status.email}
                    {status.connectedAt ? ` · since ${formatDate(status.connectedAt)}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={disconnect} disabled={working}>
                {working ? <Spinner /> : null} Disconnect
              </Button>

              {/* Inbox sync */}
              <div className="w-full border-t border-border-soft pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Inbox size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-accent-strong" />
                    <div>
                      <p className="text-[13.5px] font-medium text-fg">Inbox sync</p>
                      <p className="max-w-md text-[12.5px] text-fg-subtle">
                        Logs emails to and from people already in your CRM onto their timeline — sent or received,
                        from your own mailbox — every hour. It only reads correspondence with your contacts.
                      </p>
                    </div>
                  </div>
                  {status.canSyncInbox ? (
                    <Button variant="secondary" size="sm" onClick={syncNow} disabled={syncing}>
                      {syncing ? <Spinner /> : <RefreshCw size={15} strokeWidth={1.9} />} Sync now
                    </Button>
                  ) : null}
                </div>
                {!status.canSyncInbox ? (
                  <div className="mt-3">
                    <InlineAlert variant="info">
                      To turn inbox sync on (and let sequences auto-stop on a reply), reconnect Gmail to grant read
                      access. Luna only reads messages to and from people already in your CRM.{" "}
                      <a href="/api/google/connect" className="font-medium underline">
                        Reconnect Gmail
                      </a>
                    </InlineAlert>
                  </div>
                ) : syncStatus ? (
                  <SyncProgress s={syncStatus} />
                ) : null}
              </div>

              {/* Deep-history backfill — one-off, pulls each contact's full history */}
              {status.canSyncInbox ? (
                <div className="w-full border-t border-border-soft pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <History size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-accent-strong" />
                      <div>
                        <p className="text-[13.5px] font-medium text-fg">Backfill full history</p>
                        <p className="max-w-md text-[12.5px] text-fg-subtle">
                          A one-off deep pass that pulls each contact&apos;s entire Gmail history — not just the
                          rolling window — so every timeline reads back to the first email. It keeps running on a
                          background schedule even if you close this page; click below to push it along faster while
                          you watch.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={runBackfill} disabled={backfilling}>
                      {backfilling ? <Spinner /> : <History size={15} strokeWidth={1.9} />}
                      {backfillStatus && backfillStatus.contactsRemaining === 0 && backfillStatus.contactsTotal > 0
                        ? "Backfill again"
                        : "Backfill history"}
                    </Button>
                  </div>
                  {backfillStatus ? (
                    <BackfillProgress s={backfillStatus} note={backfilling ? backfillNote : undefined} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-fg">Send email as yourself</p>
                <p className="mt-0.5 max-w-md text-[13px] text-fg-subtle">
                  Connect your Google account to send 1:1 emails straight from a company or contact. They go
                  from your own mailbox, land in your Sent, and replies come back to you.
                </p>
              </div>
              {/* Full navigation (not fetch) — the route redirects to Google. */}
              <a href="/api/google/connect" className="shrink-0">
                <Button size="sm">
                  <Plug size={15} strokeWidth={1.9} /> Connect Gmail
                </Button>
              </a>
            </div>
          )}
        </div>
      </section>

      <p className="px-1 text-[12px] text-fg-subtle">
        Bulk and automated email will run through Luna Marketing, not your personal mailbox — this connection
        is for personal 1:1 sending only.
      </p>
    </div>
  );
}
