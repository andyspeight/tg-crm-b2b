"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Spinner } from "@/components/ui";
import { formatMoney } from "@/lib/format";

type Digest = {
  generatedFor: string;
  facts: {
    openDeals: number;
    openMrr: number;
    closingThisWeek: { count: number; mrr: number };
    atRisk: { name: string; health: string }[];
    overdueCare: number;
    careDueThisWeek: number;
    tasksDueThisWeek: number;
    staleDeals: number;
    topPriorities: { label: string; company: string }[];
  };
  narrative: string;
};

export function DigestView() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDigest(await api<Digest>("/api/ai/digest"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the digest.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-fg">
            <Sparkles size={18} strokeWidth={1.9} className="text-accent-strong" aria-hidden />
            Weekly digest
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-subtle">
            {digest ? `Generated ${digest.generatedFor}` : "Your Monday-morning briefing"}
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw size={15} strokeWidth={1.9} />} Regenerate
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] text-danger">{error}</p>
          <p className="mt-1 text-[12px] text-fg-subtle">
            If AI isn&apos;t configured, set <code>ANTHROPIC_API_KEY</code> in Vercel.
          </p>
        </div>
      ) : loading && !digest ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="flex items-center justify-center gap-2 text-[13px] text-fg-subtle">
            <Spinner /> Writing your briefing…
          </p>
        </div>
      ) : digest ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Open pipeline" value={`${formatMoney(digest.facts.openMrr)}/mo`} />
            <Stat label="Open deals" value={String(digest.facts.openDeals)} />
            <Stat
              label="At risk"
              value={String(digest.facts.atRisk.length)}
              tone={digest.facts.atRisk.length ? "warn" : undefined}
            />
            <Stat
              label="Overdue care"
              value={String(digest.facts.overdueCare)}
              tone={digest.facts.overdueCare ? "danger" : undefined}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="space-y-2 text-[14px] leading-relaxed text-fg">
              {digest.narrative.split(/\n+/).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg";
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className={`tnum mt-0.5 text-[18px] font-semibold ${color}`}>{value}</p>
    </div>
  );
}
