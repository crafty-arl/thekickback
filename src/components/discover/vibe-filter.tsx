"use client";

import { VibeLevel, getVibeColor, getVibeLabel } from "@/lib/venues";

const VIBES: (VibeLevel | "all")[] = ["all", "quiet", "moderate", "busy", "lit"];

interface VibeFilterProps {
  selected: VibeLevel | "all";
  onSelect: (vibe: VibeLevel | "all") => void;
}

export function VibeFilter({ selected, onSelect }: VibeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VIBES.map((vibe) => (
        <button
          key={vibe}
          onClick={() => onSelect(vibe)}
          className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-sm transition-colors ${
            selected === vibe
              ? "bg-black/[0.08] text-black"
              : "text-black/40 hover:text-black/60"
          }`}
        >
          {vibe !== "all" && (
            <div className={`h-2 w-2 rounded-full ${getVibeColor(vibe)}`} />
          )}
          <span>{vibe === "all" ? "Any vibe" : getVibeLabel(vibe)}</span>
        </button>
      ))}
    </div>
  );
}
