import { InboxLeads } from "@/components/inbox-leads";

// The scan hits Gmail live on each open, so never prerender/cache this route.
export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return <InboxLeads />;
}
