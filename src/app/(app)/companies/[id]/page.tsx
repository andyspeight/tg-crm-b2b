import { notFound } from "next/navigation";
import { AirtableError } from "@/lib/airtable";
import {
  getCompany,
  listActivitiesByIds,
  listContactsByIds,
  listDealsByIds,
  listTasksByIds,
} from "@/lib/crm/data";
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

  const [contacts, deals, activities, tasks] = await Promise.all([
    listContactsByIds(company.contactIds),
    listDealsByIds(company.dealIds),
    listActivitiesByIds(company.activityIds),
    listTasksByIds(company.taskIds),
  ]);

  return (
    <CompanyView
      company={company}
      initialContacts={contacts}
      initialDeals={deals}
      initialActivities={activities}
      initialTasks={tasks}
    />
  );
}
