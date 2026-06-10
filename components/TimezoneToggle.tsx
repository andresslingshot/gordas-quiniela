"use client";
import { TZ, TZ_LABELS } from "@/lib/timezones";

interface Props {
  value: TZ;
  onChange: (tz: TZ) => void;
}

const ALL: TZ[] = ["PT", "CT", "ET", "BST"];

export default function TimezoneToggle({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-slate-800 rounded-full p-1">
      {ALL.map((tz) => (
        <button
          key={tz}
          onClick={() => onChange(tz)}
          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all
            ${value === tz
              ? "bg-yellow-400 text-black"
              : "text-slate-400 hover:text-white"
            }`}
        >
          {TZ_LABELS[tz]}
        </button>
      ))}
    </div>
  );
}
