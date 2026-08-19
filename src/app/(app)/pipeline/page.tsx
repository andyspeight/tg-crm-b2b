import { activityRecency, getPipelineStages, listCompanies, listDeals } from "@/lib/crm/data";
import { computeForecast } from "@/lib/crm/pipeline";
import { bustCache } from "@/lib/cache";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  // The board is drag-and-drop: a stale read (a deal in its pre-move column, or a
  // stage list without a just-added lane) is very visible. Read fresh every load
  // rather than risk the ~20s instance cache; correctness beats the small cost here.
  bustCache();
  const [deals, companies, recency, stages] = await Promise.all([
    listDeals(),
    listCompanies(),
    activityRecency(),
    getPipelineStages(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  const forecast = computeForecast(deals, stages, { recency });
  return (
    <PipelineView
      initial={deals}
      companies={companyOptions}
      recency={recency}
      initialStages={stages}
      forecast={forecast}
    />
  );
}
