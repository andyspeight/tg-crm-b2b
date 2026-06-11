import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luna Desk",
  description: "Travelgenix B2B CRM",
};

// Apply the saved theme before paint to avoid a flash. Light is the default.
const themeInit = `try{if(localStorage.getItem('luna-theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
