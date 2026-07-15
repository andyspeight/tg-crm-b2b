import { Suspense } from "react";
import { SettingsView } from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  );
}
