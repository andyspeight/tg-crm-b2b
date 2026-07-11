import { activityRecency, listCareBoard, listCompanies, listDeals, listOpenTasks } from "@/lib/crm/data";
import { computeNextActions } from "@/lib/crm/next-actions";
import type { CareTouch } from "@/lib/crm/types";
import { TodayView, type CareDueItem } from "@/components/today-view";

export const dynamic = "force-dynamic";

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

  // Care touches that are overdue or fall due within the next 14 days.
  const cutoff = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const careDue: CareDueItem[] = careBoard
    .filter(({ nextTouch }) => nextTouch?.dueDate && nextTouch.dueDate <= cutoff)
    .map(({ company, nextTouch }) => ({
      companyId: company.id,
      companyName: company.name,
      dueDate: nextTouch!.dueDate!,
      touchType: nextTouch!.touchType,
      overdue: (nextTouch!.dueDate as string) < today,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);

  return <TodayView tasks={tasks} nextActions={nextActions} careDue={careDue} />;
}
