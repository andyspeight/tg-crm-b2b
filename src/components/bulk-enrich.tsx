"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles, Square } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import { Button, Card, InlineAlert, Input, PageHeader, Select, StatTile } from "@/components/ui";

type Row = { key: string; id: string; name: string; ok: boolean; detail: string };

const CONCURRENCY = 3;

export function BulkEnrich() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [scope, setScope] = useState<"customers" | "all">("customers");
  const [cap, setCap] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const stopRef = useRef(false);
  const seq = useRef(0);

  useEffect(() => {
    api<{ companies: Company[] }>("/api/companies")
      .then((d) => setCompanies(d.companies))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load companies"));
  }, []);

  const all = companies ?? [];
  const customers = all.filter((c) => c.lifecycleStage === "Customer");
  const enrichedCount = all.filter((c) => c.enrichedAt).length;
  const targets = (scope === "customers" ? customers : all).filter((c) => !c.enrichedAt);
  const remaining = targets.length;
  const willDo = cap.trim() ? Math.min(Math.max(parseInt(cap, 10) || 0, 0), remaining) : remaining;

  async function start() {
    stopRef.current = false;
    setRunning(true);
    setRows([]);
    setDone(0);
    setFailed(0);
    const queue = targets.slice(0, willDo);
    setTotal(queue.length);

    let idx = 0;
    async function worker() {
      while (idx < queue.length && !stopRef.current) {
        const c = queue[idx++];
        try {
          const { company } = await api<{ company: Company }>(`/api/intel/enrich/company/${c.id}`, {
            method: "POST",
          });
          const bits = [
            company.website && "website",
            company.linkedin && "LinkedIn",
            company.sizeBand && "size",
            company.description && "description",
          ]
            .filter(Boolean)
            .join(" · ");
          setRows((r) => [{ key: `${c.id}-${seq.current++}`, id: c.id, name: c.name, ok: true, detail: bits || "enriched" }, ...r].slice(0, 80));
          setDone((d) => d + 1);
        } catch (e) {
          setRows((r) =>
            [{ key: `${c.id}-${seq.current++}`, id: c.id, name: c.name, ok: false, detail: e instanceof Error ? e.message : "failed" }, ...r].slice(0, 80),
          );
          setFailed((f) => f + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  const processed = done + failed;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  const mins = Math.max(1, Math.ceil((willDo * 7) / 60));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Enrich data"
        description="Fill company profiles from Bright Data — website, LinkedIn, size and a description, from the name alone."
      />

      {loadError ? <InlineAlert variant="danger">{loadError}</InlineAlert> : null}

      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Customers" value={String(customers.length)} />
          <StatTile label="Enriched" value={String(enrichedCount)} tone={enrichedCount ? "success" : undefined} />
          <StatTile label="To enrich" value={String(remaining)} tone={remaining ? "warn" : undefined} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Scope</span>
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value as "customers" | "all")}
              disabled={running}
            >
              <option value="customers">Customers only ({customers.length})</option>
              <option value="all">All companies ({all.length})</option>
            </Select>
          </label>
          <label className="block w-full sm:w-40">
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Limit (optional)</span>
            <Input
              type="number"
              min={1}
              placeholder={`All ${remaining}`}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              disabled={running}
            />
          </label>
          {running ? (
            <Button variant="danger" onClick={() => (stopRef.current = true)}>
              <Square size={15} strokeWidth={2} /> Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={start} disabled={!companies || willDo === 0}>
              <Sparkles size={15} strokeWidth={2} /> Enrich {willDo}
            </Button>
          )}
        </div>

        {running || processed > 0 ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-fg-subtle">
              <span className="tnum">
                {processed} / {total}
                {failed ? ` · ${failed} failed` : ""}
              </span>
              <span>{running ? "Enriching…" : "Finished"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent-strong transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </Card>

      {rows.length ? (
        <Card className="p-4">
          <ul className="divide-y divide-border-soft">
            {rows.map((r) => (
              <li key={r.key} className="flex items-start gap-2.5 py-2">
                {r.ok ? (
                  <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-success" aria-hidden />
                ) : (
                  <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/companies/${r.id}`}
                    className="text-[13px] font-medium text-fg hover:text-accent-strong"
                  >
                    {r.name}
                  </Link>
                  <p className={`truncate text-[12px] ${r.ok ? "text-fg-subtle" : "text-danger"}`}>{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="px-1 text-[12px] text-fg-subtle">
        Runs in your browser — keep this tab open while it works ({CONCURRENCY} at a time, roughly {mins} min for {willDo}).
        Bright Data bills per record; start with a small limit to sanity-check quality, then run the rest.
      </p>
    </div>
  );
}
