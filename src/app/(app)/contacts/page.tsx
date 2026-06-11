import { listCompanies, listContacts } from "@/lib/crm/data";
import { ContactsView } from "@/components/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, companies] = await Promise.all([listContacts(), listCompanies()]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  return <ContactsView initial={contacts} companies={companyOptions} />;
}
