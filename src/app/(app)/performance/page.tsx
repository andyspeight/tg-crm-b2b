import { listEmailActivities, listEnrollments, listTrackings } from "@/lib/crm/data";
import { computeEmailPerformance, summarizeOpens } from "@/lib/crm/email-performance";
import { EmailPerformanceView } from "@/components/email-performance-view";

export const dynamic = "force-dynamic";

export default async function EmailPerformancePage() {
  const [emails, enrollments, trackings] = await Promise.all([
    listEmailActivities(),
    listEnrollments(),
    listTrackings(),
  ]);
  const data = computeEmailPerformance(emails, enrollments, Date.now());
  const opens = summarizeOpens(trackings);
  return <EmailPerformanceView data={data} opens={opens} />;
}
