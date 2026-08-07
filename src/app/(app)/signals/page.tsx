import { listRecentSignals } from "@/lib/crm/data";
import { SignalsInbox } from "@/components/signals-inbox";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const signals = await listRecentSignals({ limit: 1000 });
  return <SignalsInbox initial={signals} />;
}
