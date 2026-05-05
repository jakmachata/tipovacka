import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Natipovals?",
  description: "Tipování MS v hokeji 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
