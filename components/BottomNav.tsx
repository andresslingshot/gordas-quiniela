"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/matches", label: "Picks", icon: "⚽" },
  { href: "/leaderboard", label: "Table", icon: "🏆" },
  { href: "/my-picks", label: "Mine", icon: "👤" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0f1e] border-t border-yellow-500/30 flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-bold transition-colors
            ${path === l.href ? "text-yellow-400" : "text-slate-400 hover:text-yellow-300"}`}
        >
          <span className="text-xl mb-0.5">{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
