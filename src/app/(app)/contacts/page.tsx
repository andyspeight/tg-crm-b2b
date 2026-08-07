import { listCompanies, listContacts, listEmailTemplates } from "@/lib/crm/data";
import { ContactsView } from "@/components/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, companies, templates] = await Promise.all([
    listContacts(),
    listCompanies(),
    listEmailTemplates(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  return <ContactsView initial={contacts} companies={companyOptions} templates={templates} />;
}
