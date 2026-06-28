"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const POOL_PIN = process.env.NEXT_PUBLIC_POOL_PIN ?? "9876";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("gq_player");
    if (stored) router.replace("/matches");
  }, [router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name."); return; }

    if (pin && pin !== POOL_PIN) {
      setError("Wrong PIN — try again or leave it blank.");
      return;
    }

    setLoading(true);
    // upsert player — if DB fails, still let them in
    try {
      await supabase.from("players").upsert({ name: trimmed }, { onConflict: "name" });
    } catch (_) {
      // non-fatal — player stored locally
    }

    localStorage.setItem("gq_player", trimmed);
    localStorage.setItem("gq_can_edit", pin === POOL_PIN ? "true" : "false");
    router.push("/matches");
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8">
      {/* Hero */}
      <div className="text-center">
        <div className="text-7xl mb-4">⚽🏆⚽</div>
        <h2 className="text-4xl font-black gold-text mb-1">Gordas Quiniela</h2>
        <p className="text-slate-400 text-sm">FIFA World Cup 2026 · Group Stage Predictions</p>
        <p className="text-yellow-400 text-xs mt-1 font-semibold">🗓 Jun 11 – Jun 27</p>
      </div>

      {/* Join card */}
      <form
        onSubmit={handleJoin}
        className="w-full max-w-sm bg-slate-800/70 border border-yellow-500/20 rounded-2xl p-6 flex flex-col gap-4"
      >
        <h3 className="text-lg font-bold text-center text-white">Join the Pool</h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Diego"
            maxLength={30}
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-base placeholder-slate-500
              focus:outline-none focus:border-yellow-400 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Pool PIN <span className="text-slate-500 normal-case font-normal">(optional — ask the organizer)</span>
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 4))}
            placeholder="••••"
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-base placeholder-slate-500
              focus:outline-none focus:border-yellow-400 transition-colors tracking-widest"
          />
          <p className="text-xs text-slate-500">Without the PIN you can view picks but not submit them.</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 rounded-xl text-base
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Joining…" : "Let's Go! 🚀"}
        </button>
      </form>

      <p className="text-slate-600 text-xs text-center">
        No account needed · Picks lock at kickoff · 48 teams · 72 matches
      </p>
    </div>
  );
}
