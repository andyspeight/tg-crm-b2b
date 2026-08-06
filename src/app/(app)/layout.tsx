import { AppFrame } from "@/components/app-frame";
import { FeedbackProvider } from "@/components/feedback";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <AppFrame>{children}</AppFrame>
    </FeedbackProvider>
  );
}
