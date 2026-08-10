import { activityRecency, getPipelineStages, listCompanies, listDeals } from "@/lib/crm/data";
import { computeForecast } from "@/lib/crm/pipeline";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
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
