"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, InlineAlert, PageHeader, Select, Spinner, StatTile } from "@/components/ui";
import { useToast } from "@/components/feedback";

type BrevoList = { id: number; name: string; totalSubscribers?: number };
type Counts = { all: number; customers: number; prospects: number; optedin: number };
type Status = { configured: boolean; lists: BrevoList[]; counts: Counts | null };
type Segment = "all" | "customers" | "prospects" | "optedin";
type OptSegment = "all" | "customers" | "prospects";
type OptStatus = "Opted In" | "Opted Out" | "Unknown";

const SYNC_SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "customers", label: "Customers" },
  { id: "prospects", label: "Prospects / leads" },
  { id: "optedin", label: "Opted-in only" },
];
const OPT_SEGMENTS: { id: OptSegment; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "customers", label: "Customers" },
  { id: "prospects", label: "Prospects / leads" },
];
const OPT_STATUSES: OptStatus[] = ["Opted In", "Opted Out", "Unknown"];

/**
 * Sync to Brevo + bulk marketing opt-in. The sync adds/updates contacts and list
 * membership only — it never sends email, so consent is enforced at send time.
 * The opt-in card records consent status across a segment (never un-doing an
 * explicit opt-out), so a broad send can later be narrowed to consented people.
 */
export function BrevoSync() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const toast = useToast();

  // sync controls
  const [segment, setSegment] = useState<Segment>("all");
  const [listId, setListId] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");

  // opt-in controls
  const [optSegment, setOptSegment] = useState<OptSegment>("customers");
  const [optStatus, setOptStatus] = useState<OptStatus>("Opted In");
  const [applying, setApplying] = useState(false);
  const [optResult, setOptResult] = useState("");

  async function load() {
    setState("loading");
    setError("");
    try {
      const s = await api<Status>("/api/brevo");
      setStatus(s);
      if (s.lists.length && !listId) setListId(String(s.lists[0].id));
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Brevo.");
      setState("error");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = status?.counts;
  const segmentCount = counts ? counts[segment] : 0;
  const optSegmentCount = counts ? counts[optSegment] : 0;
  const listName = useMemo(
    () => status?.lists.find((l) => String(l.id) === listId)?.name ?? "",
    [status, listId],
  );

  async function sync() {
    if (!listId) return;
    setSyncing(true);
    setError("");
    setSyncResult("");
    try {
      const r = await api<{ queued: number }>("/api/brevo", {
        method: "POST",
        body: JSON.stringify({ listId: Number(listId), segment }),
      });
      setSyncResult(`Queued ${r.queued} contact${r.queued === 1 ? "" : "s"} to “${listName}”.`);
      toast.success(`Synced ${r.queued} to ${listName}`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed.";
      setError(msg);
      toast.error("Sync failed", { description: msg });
    } finally {
      setSyncing(false);
    }
  }

  async function applyOptIn() {
    setApplying(true);
    setOptResult("");
    try {
      const r = await api<{ updated: number }>("/api/contacts/opt-in", {
        method: "POST",
        body: JSON.stringify({ segment: optSegment, status: optStatus }),
      });
      setOptResult(
        r.updated === 0
          ? "No contacts needed changing (already set, or opted out)."
          : `Marked ${r.updated} contact${r.updated === 1 ? "" : "s"} as “${optStatus}”.`,
      );
      toast.success(`${r.updated} marked ${optStatus}`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't update opt-in.";
      setOptResult("");
      toast.error("Couldn't update opt-in", { description: msg });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Sync to Brevo"
        description="Record marketing consent and push your CRM contacts into a Brevo list. Syncing only adds or updates contacts — it never sends email."
        actions={
          <Button variant="secondary" onClick={load} disabled={state === "loading"}>
            {state === "loading" ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.75} />} Refresh
          </Button>
        }
      />

      {state === "loading" ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-fg-subtle">
          <Spinner /> Loading…
        </div>
      ) : state === "error" ? (
        <div className="mt-4">
          <InlineAlert variant="danger">{error}</InlineAlert>
        </div>
      ) : status ? (
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Everyone" value={String(counts?.all ?? 0)} />
            <StatTile label="Customers" value={String(counts?.customers ?? 0)} />
            <StatTile label="Prospects" value={String(counts?.prospects ?? 0)} />
            <StatTile
              label="Opted-in"
              value={String(counts?.optedin ?? 0)}
              tone={counts?.optedin ? "success" : undefined}
            />
          </div>

          {/* Bulk opt-in capture */}
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                <BadgeCheck size={17} strokeWidth={1.9} className="text-accent-strong" /> Record marketing opt-in
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                Set a consent status across a segment so your “Opted-in” count reflects reality before you send. It
                never changes anyone already marked <span className="font-medium text-fg">Opted Out</span>.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Segment</span>
                <Select value={optSegment} onChange={(e) => setOptSegment(e.target.value as OptSegment)} disabled={applying}>
                  {OPT_SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({counts ? counts[s.id] : 0})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Mark as</span>
                <Select value={optStatus} onChange={(e) => setOptStatus(e.target.value as OptStatus)} disabled={applying}>
                  {OPT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <Button variant="secondary" onClick={applyOptIn} disabled={applying || optSegmentCount === 0}>
              {applying ? <Spinner /> : <BadgeCheck size={15} strokeWidth={1.9} />} Mark {optSegmentCount} as “{optStatus}”
            </Button>
            {optResult ? <InlineAlert variant="success">{optResult}</InlineAlert> : null}
          </Card>

          {/* Sync to Brevo, or connect prompt */}
          {status.configured ? (
            <Card className="space-y-4 p-5">
              <h2 className="text-[15px] font-semibold text-fg">Sync to a Brevo list</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Who to sync</span>
                  <Select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} disabled={syncing}>
                    {SYNC_SEGMENTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({counts ? counts[s.id] : 0})
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Into which Brevo list</span>
                  <Select value={listId} onChange={(e) => setListId(e.target.value)} disabled={syncing}>
                    {status.lists.length === 0 ? <option value="">No lists found in Brevo</option> : null}
                    {status.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {typeof l.totalSubscribers === "number" ? ` (${l.totalSubscribers})` : ""}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <Button onClick={sync} disabled={syncing || !listId || segmentCount === 0}>
                {syncing ? <Spinner /> : <Send size={15} strokeWidth={1.9} />} Sync {segmentCount} contact
                {segmentCount === 1 ? "" : "s"} to Brevo
              </Button>
              {syncResult ? <InlineAlert variant="success">{syncResult}</InlineAlert> : null}
              {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
            </Card>
          ) : (
            <Card className="space-y-3 p-5">
              <h2 className="text-[15px] font-semibold text-fg">Connect Brevo to sync</h2>
              <p className="text-[13.5px] leading-relaxed text-fg-muted">
                Add a <span className="font-medium text-fg">BREVO_API_KEY</span> in Vercel (Project → Settings →
                Environment Variables), using a v3 key from Brevo (Settings → SMTP &amp; API → API Keys). Redeploy,
                then Refresh — your lists will appear here. The opt-in tool above works without it.
              </p>
            </Card>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-[12.5px] leading-relaxed text-fg-muted">
            <ShieldAlert size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <span>
              Syncing adds people to a list — it doesn’t email them. When you <em>send</em>, target consented contacts
              (Opted-in / customers) to protect your sender reputation and stay on the right side of GDPR/PECR. Each
              contact’s opt-in status and lifecycle are written to Brevo as attributes, so you can segment there too.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
