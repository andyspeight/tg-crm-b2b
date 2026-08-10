import type { Deal, PipelineStage, StageKind } from "./types";

/**
 * Pipeline classification + forecast — pure, no I/O, so it's unit-testable and
 * shared by the board, the digest and Ask Luna. Open/won/lost is derived from the
 * configured stage *kinds*, never from hard-coded "Won"/"Lost" names (this base's
 * stages are onboarding milestones like "Site Is Live" / "Dead Lead").
 */

const DAY = 86_400_000;
const STALE_DAYS = 14;

export interface StageClassifier {
  kindOf(stage?: string): StageKind;
  isOpen(stage?: string): boolean;
  isWon(stage?: string): boolean;
  isLost(stage?: string): boolean;
  /** Open stage names in pipeline order (used to ramp win-probability). */
  openOrder: string[];
}

/**
 * Build a classifier from the live stage config. An unknown or empty stage is
 * treated as open — that mirrors the board, which drops such deals into the first
 * (open) lane.
 */
export function stageClassifier(stages: PipelineStage[]): StageClassifier {
  const kindByName = new Map(stages.map((s) => [s.name, s.kind]));
  const openOrder = stages.filter((s) => s.kind === "open").map((s) => s.name);
  const kindOf = (stage?: string): StageKind => (stage && kindByName.get(stage)) || "open";
  return {
    kindOf,
    isOpen: (s) => kindOf(s) === "open",
    isWon: (s) => kindOf(s) === "won",
    isLost: (s) => kindOf(s) === "lost",
    openOrder,
  };
}

/**
 * Win-probability for each open stage, ramped by position so later stages weigh
 * more: index i of N open stages → (i+1)/(N+1), giving a monotonic value in (0,1).
 * Won = 1, Lost = 0. Used to weight the revenue forecast.
 */
export function stageProbability(stage: string | undefined, cls: StageClassifier): number {
  if (cls.isWon(stage)) return 1;
  if (cls.isLost(stage)) return 0;
  const n = cls.openOrder.length;
  if (n === 0) return 0;
  const i = cls.openOrder.indexOf(stage ?? "");
  const pos = i < 0 ? 0 : i; // unknown/empty stage sits at the first open lane
  return (pos + 1) / (n + 1);
}

export interface StageBreakdown {
  name: string;
  color: string;
  kind: StageKind;
  count: number;
  /** Σ MRR for deals in this stage. */
  value: number;
  /** How many deals in this stage have a value entered. */
  withValue: number;
  /** Open deals in this stage not touched in the last {STALE_DAYS} days. */
  stalled: number;
  /** Win-probability applied to this stage (open stages only; won=1, lost=0). */
  probability: number;
  /** value × probability (the stage's contribution to the weighted forecast). */
  weighted: number;
}

export interface ForecastMonth {
  /** YYYY-MM. */
  month: string;
  count: number;
  value: number;
  weighted: number;
}

export interface PipelineForecast {
  openCount: number;
  wonCount: number;
  lostCount: number;
  /** Σ MRR across open deals. */
  openValue: number;
  /** Σ (MRR × stage probability) across open deals. */
  weightedValue: number;
  /** Open deals that have a value entered. */
  dealsWithValue: number;
  /** dealsWithValue / openCount, 0..1 (0 when there are no open deals). */
  valueCoverage: number;
  /** Won ÷ (won + lost); null when nothing has closed yet. */
  winRate: number | null;
  /** Open deals not touched in the last {STALE_DAYS} days. */
  stalledCount: number;
  /** Per-stage rollup, in pipeline order. */
  stages: StageBreakdown[];
  /** Open, dated deals grouped by expected-close month (soonest first). */
  byMonth: ForecastMonth[];
}

export interface ForecastOptions {
  /** Last-touch lookup so we can flag stalled onboardings. */
  recency?: { byDeal: Record<string, string>; byCompany: Record<string, string> };
  /** Clock injection for tests. */
  now?: number;
  staleDays?: number;
}

function lastTouch(
  d: Deal,
  recency: ForecastOptions["recency"],
): string | undefined {
  return (
    recency?.byDeal[d.id] ||
    (d.companyId ? recency?.byCompany[d.companyId] : undefined) ||
    d.createdTime
  );
}

function isStale(d: Deal, recency: ForecastOptions["recency"], now: number, staleDays: number): boolean {
  const last = lastTouch(d, recency);
  if (!last) return false;
  const t = Date.parse(last);
  return !Number.isNaN(t) && now - t >= staleDays * DAY;
}

/** Compute the full pipeline forecast from the deals and the live stage config. */
export function computeForecast(
  deals: Deal[],
  stages: PipelineStage[],
  opts: ForecastOptions = {},
): PipelineForecast {
  const cls = stageClassifier(stages);
  const now = opts.now ?? Date.now();
  const staleDays = opts.staleDays ?? STALE_DAYS;
  const recency = opts.recency;

  const stageRows = new Map<string, StageBreakdown>();
  for (const s of stages) {
    stageRows.set(s.name, {
      name: s.name,
      color: s.color,
      kind: s.kind,
      count: 0,
      value: 0,
      withValue: 0,
      stalled: 0,
      probability: stageProbability(s.name, cls),
      weighted: 0,
    });
  }

  let openCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let openValue = 0;
  let weightedValue = 0;
  let dealsWithValue = 0;
  let stalledCount = 0;
  const months = new Map<string, ForecastMonth>();

  for (const d of deals) {
    const kind = cls.kindOf(d.stage);
    const value = d.mrr ?? 0;
    // Deals whose stage isn't in the config fall into the first stage lane.
    const row = (d.stage && stageRows.get(d.stage)) || stageRows.get(stages[0]?.name ?? "");
    if (row) {
      row.count += 1;
      row.value += value;
      if (value > 0) row.withValue += 1;
    }

    if (kind === "won") {
      wonCount += 1;
      continue;
    }
    if (kind === "lost") {
      lostCount += 1;
      continue;
    }

    // Open from here.
    openCount += 1;
    openValue += value;
    if (value > 0) dealsWithValue += 1;
    const weighted = value * stageProbability(d.stage, cls);
    weightedValue += weighted;
    if (row) row.weighted += weighted;

    if (isStale(d, recency, now, staleDays)) {
      stalledCount += 1;
      if (row) row.stalled += 1;
    }

    if (d.expectedCloseDate && /^\d{4}-\d{2}/.test(d.expectedCloseDate)) {
      const month = d.expectedCloseDate.slice(0, 7);
      const m = months.get(month) ?? { month, count: 0, value: 0, weighted: 0 };
      m.count += 1;
      m.value += value;
      m.weighted += weighted;
      months.set(month, m);
    }
  }

  const closed = wonCount + lostCount;
  return {
    openCount,
    wonCount,
    lostCount,
    openValue,
    weightedValue,
    dealsWithValue,
    valueCoverage: openCount > 0 ? dealsWithValue / openCount : 0,
    winRate: closed > 0 ? wonCount / closed : null,
    stalledCount,
    stages: stages.map((s) => stageRows.get(s.name)!),
    byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
