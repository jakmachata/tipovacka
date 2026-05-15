import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ChunkReloadHandler } from "@/components/chunk-reload-handler";

export const metadata: Metadata = {
  title: "Natipovals?",
  description: "Tipování MS v hokeji 2026",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 0.6,
  maximumScale: 0.6,
  minimumScale: 0.6,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen font-sans">
        <ChunkReloadHandler />
        {children}
      </body>
    </html>
  );
}
