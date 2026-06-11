import { notFound } from "next/navigation";
import { AirtableError } from "@/lib/airtable";
import { getCompany, listContactsByIds, listDealsByIds } from "@/lib/crm/data";
import { CompanyView } from "@/components/company-view";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let company;
  try {
    company = await getCompany(id);
  } catch (e) {
    if (e instanceof AirtableError && e.status === 404) notFound();
    throw e;
  }

  const [contacts, deals] = await Promise.all([
    listContactsByIds(company.contactIds),
    listDealsByIds(company.dealIds),
  ]);

  return <CompanyView company={company} initialContacts={contacts} initialDeals={deals} />;
}
