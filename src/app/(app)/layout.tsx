import { TopBar } from "@/components/top-bar";
import { FeedbackProvider } from "@/components/feedback";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </FeedbackProvider>
  );
}
