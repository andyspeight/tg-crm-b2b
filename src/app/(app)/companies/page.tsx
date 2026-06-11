import { listCompanies } from "@/lib/crm/data";
import { CompaniesView } from "@/components/companies-view";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return <CompaniesView initial={companies} />;
}
