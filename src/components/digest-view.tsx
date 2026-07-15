"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  HeartPulse,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/client";
import {
  Button,
  Card,
  InlineAlert,
  PageHeader,
  Skeleton,
  Spinner,
  StatTile,
} from "@/components/ui";
import { HealthBadge } from "@/components/badges";
import type { AccountHealth } from "@/lib/crm/types";
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
      <PageHeader
        title="Weekly digest"
        description={digest ? `Generated ${digest.generatedFor}` : "Your Monday-morning briefing"}
        actions={
          <Button variant="primary" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={15} strokeWidth={1.9} />} Regenerate
          </Button>
        }
      />

      {error ? (
        <InlineAlert variant="danger">
          <span className="block">{error}</span>
          <span className="mt-1 block text-fg-subtle">
            If AI isn&apos;t configured, set <code>ANTHROPIC_API_KEY</code> in Vercel.
          </span>
        </InlineAlert>
      ) : loading && !digest ? (
        <div className="luna-fade space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
          </Card>
        </div>
      ) : digest ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Open pipeline"
              value={`${formatMoney(digest.facts.openMrr)}/mo`}
              icon={<TrendingUp size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="Open deals"
              value={String(digest.facts.openDeals)}
              icon={<ArrowUpRight size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="At risk"
              value={String(digest.facts.atRisk.length)}
              tone={digest.facts.atRisk.length ? "warn" : undefined}
              icon={<AlertTriangle size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="Overdue care"
              value={String(digest.facts.overdueCare)}
              tone={digest.facts.overdueCare ? "danger" : undefined}
              icon={<HeartPulse size={16} strokeWidth={1.9} />}
            />
          </div>

          <Card className="rail-accent luna-rise overflow-hidden p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                <Sparkles size={15} strokeWidth={1.9} aria-hidden />
              </span>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">
                Your briefing
              </h2>
            </div>
            <div className="space-y-2 text-[14px] leading-relaxed text-fg">
              {digest.narrative.split(/\n+/).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            {digest.facts.topPriorities.length ? (
              <div className="mt-5 border-t border-border-soft pt-4">
                <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  <Target size={13} strokeWidth={2} className="text-accent-strong" aria-hidden />
                  Top priorities
                </h3>
                <ol className="space-y-1.5">
                  {digest.facts.topPriorities.map((p, i) => (
                    <li
                      key={i}
                      className="luna-rise flex items-start gap-2.5 text-[13px] text-fg"
                      style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                    >
                      <span className="tnum mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-fg-muted">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium">{p.label}</span>
                        {p.company ? <span className="text-fg-subtle"> · {p.company}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {digest.facts.atRisk.length ? (
              <div className="mt-5 border-t border-border-soft pt-4">
                <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  <AlertTriangle size={13} strokeWidth={2} className="text-warning" aria-hidden />
                  Accounts at risk
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {digest.facts.atRisk.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-[13px] text-fg"
                    >
                      <span className="min-w-0 truncate font-medium">{a.name}</span>
                      <HealthBadge value={a.health as AccountHealth} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
