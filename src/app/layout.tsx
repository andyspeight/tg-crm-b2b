import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luna Desk",
  description: "Travelgenix B2B CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
