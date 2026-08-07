import { listEmailActivities, listEnrollments } from "@/lib/crm/data";
import { computeEmailPerformance } from "@/lib/crm/email-performance";
import { EmailPerformanceView } from "@/components/email-performance-view";

export const dynamic = "force-dynamic";

export default async function EmailPerformancePage() {
  const [emails, enrollments] = await Promise.all([listEmailActivities(), listEnrollments()]);
  const data = computeEmailPerformance(emails, enrollments, Date.now());
  return <EmailPerformanceView data={data} />;
}
