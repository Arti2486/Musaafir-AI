import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Musaafir AI - Your India trip planner",
  description:
    "AI itinerary planner for 20+ Indian destinations with grounded destination context, voice search in Hindi and English, PDF exports and trip history.",
};

export const viewport: Viewport = {
  themeColor: "#050b11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-ink-950 font-sans text-sand-100 antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
