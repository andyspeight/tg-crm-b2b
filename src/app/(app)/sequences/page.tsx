import { listSequences, listEmailTemplates, listEnrollments } from "@/lib/crm/data";
import { SequencesView } from "@/components/sequences-view";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const [sequences, templates, enrollments] = await Promise.all([
    listSequences(),
    listEmailTemplates(),
    listEnrollments(),
  ]);
  return (
    <SequencesView
      initialSequences={sequences}
      templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject }))}
      initialEnrollments={enrollments}
    />
  );
}
