"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, ShieldAlert } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, InlineAlert, PageHeader, Select, Spinner, StatTile } from "@/components/ui";
import { useToast } from "@/components/feedback";

type BrevoList = { id: number; name: string; totalSubscribers?: number };
type Counts = { all: number; customers: number; prospects: number; optedin: number };
type Status = { configured: boolean; lists: BrevoList[]; counts: Counts | null };
type Segment = "all" | "customers" | "prospects" | "optedin";

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "customers", label: "Customers" },
  { id: "prospects", label: "Prospects / leads" },
  { id: "optedin", label: "Opted-in only" },
];

/**
 * Sync to Brevo — push CRM contacts into a Brevo list. Adds/updates contacts and
 * list membership only; it never sends email, so consent is enforced at send time
 * inside Brevo, not here.
 */
export function BrevoSync() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [segment, setSegment] = useState<Segment>("all");
  const [listId, setListId] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string>("");
  const toast = useToast();

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
  const listName = useMemo(
    () => status?.lists.find((l) => String(l.id) === listId)?.name ?? "",
    [status, listId],
  );

  async function sync() {
    if (!listId) return;
    setSyncing(true);
    setError("");
    setResult("");
    try {
      const r = await api<{ queued: number }>("/api/brevo", {
        method: "POST",
        body: JSON.stringify({ listId: Number(listId), segment }),
      });
      setResult(`Queued ${r.queued} contact${r.queued === 1 ? "" : "s"} to “${listName}”.`);
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

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Sync to Brevo"
        description="Push your CRM contacts into a Brevo list for marketing. This only adds or updates contacts — it never sends email."
        actions={
          status?.configured ? (
            <Button variant="secondary" onClick={load} disabled={state === "loading"}>
              {state === "loading" ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.75} />} Refresh
            </Button>
          ) : undefined
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
      ) : status && !status.configured ? (
        <Card className="mt-4 space-y-3 p-5">
          <h2 className="text-[15px] font-semibold text-fg">Connect Brevo first</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-muted">
            Add a <span className="font-medium text-fg">BREVO_API_KEY</span> environment variable in Vercel
            (Project → Settings → Environment Variables), using a v3 API key from Brevo (Settings → SMTP &amp; API
            → API Keys). Redeploy, then refresh this page — your Brevo lists will appear here.
          </p>
          <p className="text-[12.5px] text-fg-subtle">The key is stored server-side only and never reaches the browser.</p>
        </Card>
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

          <Card className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Who to sync</span>
                <Select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} disabled={syncing}>
                  {SEGMENTS.map((s) => (
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

            {result ? <InlineAlert variant="success">{result}</InlineAlert> : null}
            {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
          </Card>

          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-[12.5px] leading-relaxed text-fg-muted">
            <ShieldAlert size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <span>
              Syncing adds people to the list — it doesn’t email them. Only <b className="font-medium text-fg">8</b> of
              your contacts are marked Opted-in, so when you <em>send</em> to a broad list, narrow it to consented
              contacts or existing customers to protect your sender reputation and stay on the right side of GDPR/PECR.
              Each contact’s opt-in status and lifecycle are written to Brevo as attributes, so you can build those
              segments there.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
