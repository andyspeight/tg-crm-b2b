import { notFound } from "next/navigation";
import { AirtableError } from "@/lib/airtable";
import {
  getCompany,
  listActivitiesByIds,
  listCareTouchesByCompany,
  listContactsByIds,
  listDealsByIds,
  listEmailTemplates,
  listSuggestedContactsForCompany,
  listTasksByIds,
  trackingByMessageIds,
} from "@/lib/crm/data";
import { CompanyView } from "@/components/company-view";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ angle?: string; email?: string }>;
}) {
  const { id } = await params;
  const { angle, email } = await searchParams;

  let company;
  try {
    company = await getCompany(id);
  } catch (e) {
    if (e instanceof AirtableError && e.status === 404) notFound();
    throw e;
  }

  const [contacts, deals, activities, tasks, careTouches, suggestedContacts, emailTemplates] =
    await Promise.all([
      listContactsByIds(company.contactIds),
      listDealsByIds(company.dealIds),
      listActivitiesByIds(company.activityIds),
      listTasksByIds(company.taskIds),
      listCareTouchesByCompany(company.id),
      listSuggestedContactsForCompany(company, company.contactIds),
      listEmailTemplates(),
    ]);

  // Open/download status for the sent emails on this timeline.
  const messageIds = activities.map((a) => a.gmailMessageId).filter((v): v is string => !!v);
  const openStatus = messageIds.length ? await trackingByMessageIds(messageIds) : {};

  return (
    <CompanyView
      company={company}
      initialContacts={contacts}
      initialSuggestedContacts={suggestedContacts}
      initialDeals={deals}
      initialActivities={activities}
      initialTasks={tasks}
      initialCareTouches={careTouches}
      emailTemplates={emailTemplates}
      draftAngle={angle}
      openStatus={openStatus}
      highlightMessageId={email}
    />
  );
}
