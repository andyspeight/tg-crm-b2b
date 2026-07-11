import { formatDate } from "@/lib/format";
import type { CareTouch, Company, Deal } from "./types";

export type Severity = "danger" | "warn" | "info";

/** The single most important thing to do on one account, ranked across all accounts. */
export interface NextAction {
  companyId: string;
  companyName: string;
  kind: string;
  label: string;
  detail?: string;
  severity: Severity;
  score: number;
  href: string;
}

const DAY = 86_400_000;

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY);
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / DAY);
}

const isOpen = (d: Deal) => d.stage !== "Won" && d.stage !== "Lost";

export interface NbaInputs {
  companies: Company[];
  deals: Deal[];
  nextTouchByCompany: Map<string, CareTouch>;
  lastByCompany: Record<string, string>;
  lastByDeal: Record<string, string>;
}

/**
 * The highest-priority action for one account, or null if nothing needs doing.
 * Rules are ordered by urgency; the first that matches wins. Post-go-live
 * "wilting" (overdue care, red health) is weighted hardest, per the brief.
 */
function actionForCompany(
  c: Company,
  deals: Deal[],
  nextTouch: CareTouch | undefined,
  lastContact: string | undefined,
  lastByDeal: Record<string, string>,
): NextAction | null {
  const base = { companyId: c.id, companyName: c.name, href: `/companies/${c.id}` };
  const openDeals = deals.filter(isOpen);

  // 1. Overdue care touch — the #1 churn lever.
  const careOverdue = nextTouch?.dueDate ? -(daysUntil(nextTouch.dueDate) ?? 0) : 0;
  if (careOverdue > 0) {
    return {
      ...base,
      kind: "care-overdue",
      severity: "danger",
      score: 900 + Math.min(careOverdue, 90),
      label: "Log the overdue care touch",
      detail: `${nextTouch?.touchType ?? "Check-in"} · was due ${formatDate(nextTouch?.dueDate)}`,
    };
  }

  // 2. Red health.
  if (c.accountHealth === "Red") {
    return {
      ...base,
      kind: "health-red",
      severity: "danger",
      score: 850,
      label: "Health is Red — reach out today",
      detail: lastContact ? `Last contact ${formatDate(lastContact)}` : "No recent contact",
    };
  }

  // 3. Open deal with no next step.
  const noNext = openDeals.find((d) => !d.nextStep || !d.nextStepDate);
  if (noNext) {
    return {
      ...base,
      kind: "deal-no-next-step",
      severity: "warn",
      score: 700,
      label: `Set a next step on ${noNext.name}`,
      detail: noNext.stage,
    };
  }

  // 4. Stale open deal (no activity 14+ days = warn, 30+ = danger).
  let stalest: { deal: Deal; age: number } | null = null;
  for (const d of openDeals) {
    const age = daysSince(lastByDeal[d.id] || lastContact || d.createdTime);
    if (age != null && age >= 14 && (!stalest || age > stalest.age)) stalest = { deal: d, age };
  }
  if (stalest) {
    const danger = stalest.age >= 30;
    return {
      ...base,
      kind: "deal-stale",
      severity: danger ? "danger" : "warn",
      score: (danger ? 650 : 500) + Math.min(stalest.age, 90),
      label: `Chase ${stalest.deal.name}`,
      detail: `No activity in ${stalest.age} days`,
    };
  }

  // 5. Amber health with no upcoming touch scheduled.
  if (c.accountHealth === "Amber" && !nextTouch) {
    return { ...base, kind: "health-amber", severity: "warn", score: 450, label: "Health is Amber — schedule a check-in" };
  }

  // 6. Renewal approaching (customer, within 45 days).
  if (c.lifecycleStage === "Customer" && c.renewalDate) {
    const until = daysUntil(c.renewalDate);
    if (until != null && until >= 0 && until <= 45) {
      return {
        ...base,
        kind: "renewal",
        severity: "warn",
        score: 400 + (45 - until),
        label: "Start the renewal conversation",
        detail: `Renews ${formatDate(c.renewalDate)} · ${until}d`,
      };
    }
  }

  // 7. Care touch due soon (within 7 days).
  const careUntil = nextTouch?.dueDate ? daysUntil(nextTouch.dueDate) : null;
  if (careUntil != null && careUntil >= 0 && careUntil <= 7) {
    return {
      ...base,
      kind: "care-soon",
      severity: "info",
      score: 200 + (7 - careUntil),
      label: `${nextTouch?.touchType ?? "Care touch"} due soon`,
      detail: `Due ${formatDate(nextTouch?.dueDate)}`,
    };
  }

  return null;
}

/** Rank the single next-best action for every account, most urgent first. */
export function computeNextActions(inp: NbaInputs, limit = 12): NextAction[] {
  const dealsByCompany = new Map<string, Deal[]>();
  for (const d of inp.deals) {
    if (!d.companyId) continue;
    const arr = dealsByCompany.get(d.companyId);
    if (arr) arr.push(d);
    else dealsByCompany.set(d.companyId, [d]);
  }

  const out: NextAction[] = [];
  for (const c of inp.companies) {
    const action = actionForCompany(
      c,
      dealsByCompany.get(c.id) || [],
      inp.nextTouchByCompany.get(c.id),
      inp.lastByCompany[c.id],
      inp.lastByDeal,
    );
    if (action) out.push(action);
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
