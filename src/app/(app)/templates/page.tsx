import { listEmailTemplates } from "@/lib/crm/data";
import { TemplatesView } from "@/components/templates-view";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await listEmailTemplates();
  return <TemplatesView initial={templates} />;
}
