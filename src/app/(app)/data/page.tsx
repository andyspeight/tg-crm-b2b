import { Suspense } from "react";
import { DataHealth } from "@/components/data-health";

export const dynamic = "force-dynamic";

export default function DataPage() {
  // DataHealth reads the ?tab= query param via useSearchParams, so it needs a
  // Suspense boundary.
  return (
    <Suspense>
      <DataHealth />
    </Suspense>
  );
}
