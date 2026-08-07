"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Inbox, Mail, Plug, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { Button, InlineAlert, PageHeader, Spinner } from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";
import { formatDate } from "@/lib/format";

type Status = {
  configured: boolean;
  connected: boolean;
  email?: string;
  name?: string;
  connectedAt?: string;
  canRead?: boolean;
  canSyncInbox?: boolean;
};

export function SettingsView() {
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const flag = params.get("google"); // connected | error | denied (from the OAuth callback)

  async function load() {
    try {
      setStatus(await api<Status>("/api/google/status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load settings");
    }
  }

  useEffect(() => {
    load();
  }, []);

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
                ) : null}
              </div>
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
