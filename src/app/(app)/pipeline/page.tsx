import { listCompanies, listDeals } from "@/lib/crm/data";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [deals, companies] = await Promise.all([listDeals(), listCompanies()]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  return <PipelineView initial={deals} companies={companyOptions} />;
}
