import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSS News",
  description: "Government RSS feeds",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
