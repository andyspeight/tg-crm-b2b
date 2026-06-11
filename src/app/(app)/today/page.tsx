import { activityRecency, listDeals, listOpenTasks } from "@/lib/crm/data";
import { dealFlag } from "@/lib/deal-flags";
import type { Deal } from "@/lib/crm/types";
import { TodayView, type AttentionItem } from "@/components/today-view";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [tasks, deals, recency] = await Promise.all([
    listOpenTasks(),
    listDeals(),
    activityRecency(),
  ]);

  const attention: AttentionItem[] = deals
    .map((deal: Deal) => {
      const last =
        recency.byDeal[deal.id] ||
        (deal.companyId ? recency.byCompany[deal.companyId] : undefined) ||
        deal.createdTime;
      const flag = dealFlag(deal, last);
      return flag ? { deal, label: flag.label, danger: flag.danger } : null;
    })
    .filter((x): x is AttentionItem => x !== null)
    .sort((a, b) => Number(b.danger) - Number(a.danger));

  return <TodayView tasks={tasks} attention={attention} />;
}
