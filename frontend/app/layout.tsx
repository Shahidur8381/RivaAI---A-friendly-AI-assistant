import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Riva AI — Come here whenever you need me",
  description: "Riva is your intelligent, warm AI assistant. Ask anything, explore ideas, or just have a conversation.",
  keywords: ["AI assistant", "Riva AI", "chatbot", "intelligent assistant"],
  authors: [{ name: "Riva AI" }],
  openGraph: {
    title: "Riva AI",
    description: "Come here whenever you need me",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#070511",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased h-[100dvh] flex flex-col relative overflow-hidden">
        <div className="riva-bg" />
        <div className="relative z-10 flex flex-col h-full w-full">
          <Navbar />
          <main className="flex-1 flex flex-col relative overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
