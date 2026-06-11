import { listCompanies, listDeals } from "@/lib/crm/data";
import { DealsView } from "@/components/deals-view";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, companies] = await Promise.all([listDeals(), listCompanies()]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  return <DealsView initial={deals} companies={companyOptions} />;
}
