import { activityRecency, listCareBoard, listCompanies, listDeals, listOpenTasks } from "@/lib/crm/data";
import { computeNextActions } from "@/lib/crm/next-actions";
import type { CareTouch } from "@/lib/crm/types";
import { TodayView, type CareDueItem, type NurtureItem, type Vitals } from "@/components/today-view";

export const dynamic = "force-dynamic";

const isOpen = (stage?: string) => stage !== "Won" && stage !== "Lost";

export default async function TodayPage() {
  const [tasks, companies, deals, recency, careBoard] = await Promise.all([
    listOpenTasks(),
    listCompanies(),
    listDeals(),
    activityRecency(),
    listCareBoard(),
  ]);

  const nextTouchByCompany = new Map<string, CareTouch>();
  for (const { company, nextTouch } of careBoard) {
    if (nextTouch && company.id) nextTouchByCompany.set(company.id, nextTouch);
  }

  const nextActions = computeNextActions({
    companies,
    deals,
    nextTouchByCompany,
    lastByCompany: recency.byCompany,
    lastByDeal: recency.byDeal,
  });

  // Care touches overdue or falling due within the next 14 days.
  const cutoff = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const careDue: CareDueItem[] = careBoard
    .filter(({ nextTouch }) => nextTouch?.dueDate && nextTouch.dueDate <= cutoff)
    .map(({ company, nextTouch }) => ({
      touchId: nextTouch!.id,
      companyId: company.id,
      companyName: company.name,
      dueDate: nextTouch!.dueDate!,
      touchType: nextTouch!.touchType,
      overdue: (nextTouch!.dueDate as string) < today,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);

  const customers = companies.filter((c) => c.lifecycleStage === "Customer");
  const leadStages = new Set(["Prospect", "Engaged", "Opportunity"]);
  const openDeals = deals.filter((d) => isOpen(d.stage));
  const vitals: Vitals = {
    customers: customers.length,
    leads: companies.filter((c) => leadStages.has(c.lifecycleStage ?? "")).length,
    openDeals: openDeals.length,
    openMrr: openDeals.reduce((t, d) => t + (d.mrr ?? 0), 0),
    needsAttention: customers.filter((c) => c.accountHealth === "Amber" || c.accountHealth === "Red").length,
    careDue: careDue.length,
  };

  // Customers longest without a meaningful touch — shown when nothing is urgent.
  const nurture: NurtureItem[] = customers
    .map((c) => ({ id: c.id, name: c.name, last: c.lastMeaningfulContact || recency.byCompany[c.id] || "" }))
    .sort((a, b) => (a.last || "0").localeCompare(b.last || "0"))
    .slice(0, 3)
    .map((n) => ({ id: n.id, name: n.name, last: n.last || undefined }));

  return (
    <TodayView tasks={tasks} nextActions={nextActions} careDue={careDue} vitals={vitals} nurture={nurture} />
  );
}
