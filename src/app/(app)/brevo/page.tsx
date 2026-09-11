import { BrevoSync } from "@/components/brevo-sync";

// Reads live Brevo lists + contact counts on each open — never prerender/cache.
export const dynamic = "force-dynamic";

export default function BrevoPage() {
  return <BrevoSync />;
}
