"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ROUNDS, ROUND_LABELS, ROUND_PICK_COUNT, ROUND_POINTS,
  isBracketLocked, BRACKET_LOCK_UTC,
  QualifiedTeam, BracketPick, KnockoutRound,
} from "@/lib/bracket";
import { formatKickoff } from "@/lib/timezones";

type PickMap = Record<KnockoutRound, Set<string>>;

function emptyPickMap(): PickMap {
  return { r16: new Set(), qf: new Set(), sf: new Set(), final: new Set(), champion: new Set() };
}

export default function BracketPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [teams, setTeams] = useState<QualifiedTeam[]>([]);
  const [picks, setPicks] = useState<PickMap>(emptyPickMap());
  const [activeRound, setActiveRound] = useState<KnockoutRound>("r16");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const locked = isBracketLocked();

  useEffect(() => {
    const stored = localStorage.getItem("gq_player");
    if (!stored) { router.replace("/"); return; }
    setPlayer(stored);
    setCanEdit(localStorage.getItem("gq_can_edit") === "true");

    async function load() {
      // Fetch qualified teams
      const { data: teamData } = await supabase
        .from("qualified_teams")
        .select("name, flag, group_letter")
        .order("group_letter", { ascending: true });
      setTeams((teamData ?? []) as QualifiedTeam[]);

      // Fetch existing bracket picks
      const { data: pickData } = await supabase
        .from("bracket_picks")
        .select("team_name, round")
        .eq("player_name", stored);

      const map = emptyPickMap();
      (pickData ?? []).forEach((p: { team_name: string; round: KnockoutRound }) => {
        map[p.round].add(p.team_name);
      });
      setPicks(map);
      setLoading(false);
    }
    load();
  }, [router]);

  const [teamsError, setTeamsError] = useState("");

  async function refreshTeams() {
    setLoadingTeams(true);
    setTeamsError("");
    try {
      const res = await fetch("/api/qualified-teams");
      const json = await res.json();
      if (!res.ok || json.error) {
        setTeamsError(`API said: ${json.error ?? res.status}. Log: ${(json.log ?? []).join(" | ")}`);
        setLoadingTeams(false);
        return;
      }
      const { data } = await supabase
        .from("qualified_teams")
        .select("name, flag, group_letter")
        .order("group_letter", { ascending: true });
      setTeams((data ?? []) as QualifiedTeam[]);
      if ((data ?? []).length === 0) {
        setTeamsError(`API responded (${json.method}) but returned 0 teams. Log: ${(json.log ?? []).join(" | ")}`);
      }
    } catch (e) {
      setTeamsError(String(e));
    }
    setLoadingTeams(false);
  }

  function toggleTeam(team: string) {
    if (locked || !canEdit) return;
    setPicks((prev) => {
      const updated = { ...prev, [activeRound]: new Set(prev[activeRound]) };
      const pool = getPool(activeRound, prev);

      if (!pool.has(team)) return prev; // not in eligible pool

      if (updated[activeRound].has(team)) {
        updated[activeRound].delete(team);
        // Remove from later rounds too
        const laterRounds = ROUNDS.slice(ROUNDS.indexOf(activeRound) + 1);
        laterRounds.forEach((r) => {
          const s = new Set(prev[r]);
          s.delete(team);
          updated[r] = s;
        });
      } else if (updated[activeRound].size < ROUND_PICK_COUNT[activeRound]) {
        updated[activeRound].add(team);
      }
      return updated;
    });
    setSaved(false);
  }

  // Eligible teams for a round = picks from previous round (or all 32 for r16)
  function getPool(round: KnockoutRound, currentPicks: PickMap): Set<string> {
    const idx = ROUNDS.indexOf(round);
    if (idx === 0) return new Set(teams.map((t) => t.name));
    return currentPicks[ROUNDS[idx - 1]];
  }

  const savePicks = useCallback(async () => {
    if (!player || !canEdit) return;
    setSaving(true);

    // Delete existing and re-insert
    await supabase.from("bracket_picks").delete().eq("player_name", player);

    const rows: BracketPick[] = [];
    ROUNDS.forEach((round) => {
      picks[round].forEach((team) => {
        rows.push({ player_name: player, team_name: team, round });
      });
    });

    if (rows.length > 0) {
      await supabase.from("bracket_picks").insert(rows);
    }
    setSaving(false);
    setSaved(true);
  }, [player, canEdit, picks]);

  const totalPicked = ROUNDS.reduce((acc, r) => acc + picks[r].size, 0);
  const totalNeeded = ROUNDS.reduce((acc, r) => acc + ROUND_PICK_COUNT[r], 0); // 31

  if (!player) return null;

  // ── Coming soon / manual entry ────────────────────────────────────────────
  if (!loading && teams.length === 0) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🔜</div>
          <h2 className="text-2xl font-black gold-text mb-1">Bracket Coming Soon</h2>
          <p className="text-slate-400 text-sm">
            Picks lock: {formatKickoff(BRACKET_LOCK_UTC, "ET")} ET
          </p>
        </div>

        {canEdit && (
          <>
            <button
              onClick={refreshTeams}
              disabled={loadingTeams}
              className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-full text-sm disabled:opacity-50 mx-auto"
            >
              {loadingTeams ? "Checking API…" : "🔄 Auto-fetch qualified teams"}
            </button>
            {teamsError && (
              <p className="text-xs text-orange-400 text-center">{teamsError.split("Log:")[0]}</p>
            )}

            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm font-bold text-white mb-1">Or select manually:</p>
              <p className="text-xs text-slate-400 mb-3">
                Tick the 32 teams that qualified, then tap Save.
              </p>
              <ManualTeamSelector onSave={(selected) => setTeams(selected)} />
            </div>
          </>
        )}

        {!canEdit && (
          <p className="text-center text-slate-400 text-sm">
            The organizer will unlock the bracket once all 32 teams are confirmed.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-black gold-text">Bracket</h2>
          <p className="text-slate-400 text-xs">
            {locked
              ? "🔒 Picks locked"
              : `Picks lock ${formatKickoff(BRACKET_LOCK_UTC, "ET")} ET`}
          </p>
        </div>
        {!locked && canEdit && (
          <button
            onClick={savePicks}
            disabled={saving || saved}
            className={`px-4 py-2 rounded-full font-bold text-sm transition-all
              ${saved
                ? "bg-green-800/50 text-green-300"
                : "bg-yellow-400 text-black hover:bg-yellow-300"}`}
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : `Save All (${totalPicked}/${totalNeeded})`}
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!locked && (
        <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-yellow-400 h-2 rounded-full transition-all"
            style={{ width: `${(totalPicked / totalNeeded) * 100}%` }}
          />
        </div>
      )}

      {/* Round tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ROUNDS.map((r) => {
          const count = picks[r].size;
          const needed = ROUND_PICK_COUNT[r];
          const complete = count === needed;
          return (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-bold transition-all
                ${activeRound === r
                  ? "bg-yellow-400 text-black"
                  : complete
                    ? "bg-green-800/60 text-green-300"
                    : "bg-slate-700 text-slate-300"}`}
            >
              <span>{r === "champion" ? "🏆" : r.toUpperCase()}</span>
              <span className="text-xs opacity-75">{count}/{needed}</span>
            </button>
          );
        })}
      </div>

      {/* Round info */}
      <div className="bg-slate-800/60 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-white">{ROUND_LABELS[activeRound]}</p>
          <p className="text-xs text-slate-400">
            Pick {ROUND_PICK_COUNT[activeRound]} team{ROUND_PICK_COUNT[activeRound] !== 1 ? "s" : ""} ·{" "}
            <span className="text-yellow-400 font-semibold">{ROUND_POINTS[activeRound]} pts each</span> if correct
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-yellow-400">{picks[activeRound].size}</p>
          <p className="text-xs text-slate-500">of {ROUND_PICK_COUNT[activeRound]}</p>
        </div>
      </div>

      {/* Team grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <TeamGrid
          teams={teams}
          pool={getPool(activeRound, picks)}
          selected={picks[activeRound]}
          maxPicks={ROUND_PICK_COUNT[activeRound]}
          locked={locked || !canEdit}
          onToggle={toggleTeam}
        />
      )}

      {/* Round navigation */}
      <div className="flex justify-between mt-2">
        <button
          onClick={() => setActiveRound(ROUNDS[ROUNDS.indexOf(activeRound) - 1])}
          disabled={activeRound === "r16"}
          className="text-sm text-slate-400 hover:text-white disabled:opacity-30 px-3 py-1.5 rounded-lg"
        >
          ← Previous
        </button>
        <button
          onClick={() => setActiveRound(ROUNDS[ROUNDS.indexOf(activeRound) + 1])}
          disabled={activeRound === "champion"}
          className="text-sm text-yellow-400 hover:text-yellow-300 disabled:opacity-30 px-3 py-1.5 rounded-lg font-semibold"
        >
          Next →
        </button>
      </div>

      {!canEdit && (
        <p className="text-center text-xs text-orange-400 mt-2">
          👁 View only — enter the PIN on the home page to submit picks
        </p>
      )}
    </div>
  );
}

// ── Manual Team Selector ──────────────────────────────────────────────────────

const ALL_48: { name: string; flag: string; group: string }[] = [
  { name: "Mexico", flag: "🇲🇽", group: "A" }, { name: "South Korea", flag: "🇰🇷", group: "A" },
  { name: "Czechia", flag: "🇨🇿", group: "A" }, { name: "South Africa", flag: "🇿🇦", group: "A" },
  { name: "Canada", flag: "🇨🇦", group: "B" }, { name: "Qatar", flag: "🇶🇦", group: "B" },
  { name: "Switzerland", flag: "🇨🇭", group: "B" }, { name: "Bosnia & Herzegovina", flag: "🇧🇦", group: "B" },
  { name: "Brazil", flag: "🇧🇷", group: "C" }, { name: "Morocco", flag: "🇲🇦", group: "C" },
  { name: "Haiti", flag: "🇭🇹", group: "C" }, { name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  { name: "USA", flag: "🇺🇸", group: "D" }, { name: "Paraguay", flag: "🇵🇾", group: "D" },
  { name: "Australia", flag: "🇦🇺", group: "D" }, { name: "Türkiye", flag: "🇹🇷", group: "D" },
  { name: "Germany", flag: "🇩🇪", group: "E" }, { name: "Ivory Coast", flag: "🇨🇮", group: "E" },
  { name: "Ecuador", flag: "🇪🇨", group: "E" }, { name: "Curaçao", flag: "🇨🇼", group: "E" },
  { name: "Netherlands", flag: "🇳🇱", group: "F" }, { name: "Japan", flag: "🇯🇵", group: "F" },
  { name: "Sweden", flag: "🇸🇪", group: "F" }, { name: "Tunisia", flag: "🇹🇳", group: "F" },
  { name: "Belgium", flag: "🇧🇪", group: "G" }, { name: "Egypt", flag: "🇪🇬", group: "G" },
  { name: "Iran", flag: "🇮🇷", group: "G" }, { name: "New Zealand", flag: "🇳🇿", group: "G" },
  { name: "Spain", flag: "🇪🇸", group: "H" }, { name: "Uruguay", flag: "🇺🇾", group: "H" },
  { name: "Saudi Arabia", flag: "🇸🇦", group: "H" }, { name: "Cape Verde", flag: "🇨🇻", group: "H" },
  { name: "France", flag: "🇫🇷", group: "I" }, { name: "Senegal", flag: "🇸🇳", group: "I" },
  { name: "Norway", flag: "🇳🇴", group: "I" }, { name: "Iraq", flag: "🇮🇶", group: "I" },
  { name: "Argentina", flag: "🇦🇷", group: "J" }, { name: "Algeria", flag: "🇩🇿", group: "J" },
  { name: "Austria", flag: "🇦🇹", group: "J" }, { name: "Jordan", flag: "🇯🇴", group: "J" },
  { name: "Portugal", flag: "🇵🇹", group: "K" }, { name: "Colombia", flag: "🇨🇴", group: "K" },
  { name: "Congo DR", flag: "🇨🇩", group: "K" }, { name: "Uzbekistan", flag: "🇺🇿", group: "K" },
  { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" }, { name: "Croatia", flag: "🇭🇷", group: "L" },
  { name: "Ghana", flag: "🇬🇭", group: "L" }, { name: "Panama", flag: "🇵🇦", group: "L" },
];

function ManualTeamSelector({ onSave }: { onSave: (teams: QualifiedTeam[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < 32) next.add(name);
      return next;
    });
  }

  async function save() {
    if (selected.size !== 32) return;
    setSaving(true);
    const rows = ALL_48
      .filter((t) => selected.has(t.name))
      .map((t) => ({ name: t.name, flag: t.flag, group_letter: t.group }));

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await sb.from("qualified_teams").upsert(rows, { onConflict: "name" });
    onSave(rows as QualifiedTeam[]);
    setSaving(false);
  }

  const grouped = ["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => ({
    group: g,
    teams: ALL_48.filter((t) => t.group === g),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${selected.size === 32 ? "text-green-400" : "text-yellow-400"}`}>
          {selected.size}/32 selected
        </span>
        <button
          onClick={save}
          disabled={selected.size !== 32 || saving}
          className="bg-yellow-400 text-black font-bold px-4 py-1.5 rounded-full text-sm disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save & Open Bracket"}
        </button>
      </div>

      {grouped.map(({ group, teams }) => (
        <div key={group}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Group {group}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {teams.map((t) => {
              const isOn = selected.has(t.name);
              const full = selected.size >= 32 && !isOn;
              return (
                <button
                  key={t.name}
                  onClick={() => toggle(t.name)}
                  disabled={full}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-xs
                    ${isOn
                      ? "bg-yellow-400/20 border-yellow-400 text-white font-bold"
                      : full
                        ? "bg-slate-800/20 border-slate-700/20 text-slate-600 cursor-not-allowed"
                        : "bg-slate-800/60 border-slate-700/40 text-slate-200 hover:border-slate-500"}`}
                >
                  <span className="text-xl">{t.flag}</span>
                  <span className="truncate">{t.name}</span>
                  {isOn && <span className="ml-auto text-yellow-400">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Team Grid ─────────────────────────────────────────────────────────────────

interface GridProps {
  teams: QualifiedTeam[];
  pool: Set<string>;
  selected: Set<string>;
  maxPicks: number;
  locked: boolean;
  onToggle: (name: string) => void;
}

function TeamGrid({ teams, pool, selected, maxPicks, locked, onToggle }: GridProps) {
  const full = selected.size >= maxPicks;

  if (pool.size === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Pick teams in the previous round first.
      </div>
    );
  }

  const poolTeams = teams.filter((t) => pool.has(t.name));

  return (
    <div className="grid grid-cols-2 gap-2">
      {poolTeams.map((team) => {
        const isSelected = selected.has(team.name);
        const isDisabled = locked || (!isSelected && full);
        return (
          <button
            key={team.name}
            onClick={() => onToggle(team.name)}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all
              ${isSelected
                ? "bg-yellow-400/20 border-yellow-400 text-white"
                : isDisabled
                  ? "bg-slate-800/30 border-slate-700/30 text-slate-600 cursor-not-allowed"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-200 hover:border-slate-500"}`}
          >
            <span className="text-2xl shrink-0">{team.flag}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">{team.name}</p>
              {team.group_letter && (
                <p className="text-xs text-slate-500">Group {team.group_letter}</p>
              )}
            </div>
            {isSelected && <span className="ml-auto shrink-0 text-yellow-400">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
