"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp, Wallet, Trophy, Clock, Info } from "lucide-react";
import type { PipelineForecast } from "@/lib/crm/pipeline";
import { formatMoney } from "@/lib/format";
import { Card, StatTile, cn } from "@/components/ui";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Pipeline forecast: onboarding throughput (open/lost, stalled) plus a weighted
 * revenue projection once deals carry a value. Reads honestly when no values are
 * set yet — no misleading "£0", just a prompt to add them.
 */
export function PipelineForecastPanel({ forecast }: { forecast: PipelineForecast }) {
  const [open, setOpen] = useState(true);
  const hasValues = forecast.dealsWithValue > 0;
  const coveragePct =
    forecast.openCount > 0 ? Math.round(forecast.valueCoverage * 100) : 0;

  return (
    <Card className="mt-4 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <TrendingUp size={16} strokeWidth={1.9} className="text-accent-strong" />
        <h2 className="text-[14px] font-semibold text-fg">Forecast</h2>
        <span className="text-[12.5px] text-fg-subtle">
          {forecast.openCount} open
          {forecast.lostCount ? ` · ${forecast.lostCount} lost` : ""}
          {forecast.wonCount ? ` · ${forecast.wonCount} won` : ""}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn("ml-auto text-fg-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="border-t border-border-soft p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Weighted forecast"
              value={hasValues ? formatMoney(forecast.weightedValue) : "—"}
              sub={
                hasValues
                  ? `from ${formatMoney(forecast.openValue)} open`
                  : "add deal values to forecast"
              }
              tone={hasValues ? "success" : undefined}
              icon={<TrendingUp size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="Open value"
              value={hasValues ? `${formatMoney(forecast.openValue)}/mo` : "—"}
              sub={`${forecast.dealsWithValue} of ${forecast.openCount} priced`}
              icon={<Wallet size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="Win rate"
              value={forecast.winRate == null ? "—" : `${Math.round(forecast.winRate * 100)}%`}
              sub={
                forecast.winRate == null
                  ? "nothing closed yet"
                  : `${forecast.wonCount} won · ${forecast.lostCount} lost`
              }
              icon={<Trophy size={16} strokeWidth={1.9} />}
            />
            <StatTile
              label="Stalled"
              value={String(forecast.stalledCount)}
              sub="open, no touch 14d+"
              tone={forecast.stalledCount ? "warn" : undefined}
              icon={<Clock size={16} strokeWidth={1.9} />}
            />
          </div>

          {/* Value coverage — how much of the pipeline can actually be forecast. */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12.5px] font-medium text-fg">Deal values entered</p>
              <p className="tnum text-[12px] text-fg-subtle">
                {forecast.dealsWithValue} of {forecast.openCount} ({coveragePct}%)
              </p>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
              role="progressbar"
              aria-valuenow={coveragePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Open deals with a value entered"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  hasValues ? "bg-success" : "bg-border",
                )}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            {!hasValues ? (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-fg-subtle">
                <Info size={13} strokeWidth={1.9} className="mt-0.5 shrink-0" />
                Add an MRR to each deal (edit a card) to project revenue. Until then the
                forecast tracks onboarding throughput only.
              </p>
            ) : null}
          </div>

          {/* Expected closes by month — only when deals carry close dates. */}
          {forecast.byMonth.length ? (
            <div className="mt-4 border-t border-border-soft pt-3">
              <p className="mb-2 text-[12.5px] font-medium text-fg">Expected close</p>
              <ul className="flex flex-wrap gap-2">
                {forecast.byMonth.map((m) => (
                  <li
                    key={m.month}
                    className="rounded-lg border border-border-soft bg-surface px-2.5 py-1.5"
                  >
                    <span className="text-[12px] font-medium text-fg">{monthLabel(m.month)}</span>
                    <span className="tnum ml-1.5 text-[12px] text-fg-subtle">
                      {m.count} {m.count === 1 ? "deal" : "deals"}
                      {hasValues && m.value > 0 ? ` · ${formatMoney(m.value)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
