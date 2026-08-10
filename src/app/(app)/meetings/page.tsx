import { getMeetingConfig } from "@/lib/crm/data";
import { MeetingsView } from "@/components/meetings-view";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const config = await getMeetingConfig();
  return <MeetingsView initial={config} />;
}
