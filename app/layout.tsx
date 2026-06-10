import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "WC 2026 Gordas Quiniela",
  description: "World Cup 2026 prediction pool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-20">
        <header className="sticky top-0 z-50 bg-[#0a0f1e] border-b border-yellow-500/30 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold tracking-widest text-yellow-400 uppercase">⚽ WC 2026</span>
            <h1 className="text-lg font-black leading-tight gold-text">Gordas Quiniela</h1>
          </div>
          <div className="text-2xl">🏆</div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-4">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
