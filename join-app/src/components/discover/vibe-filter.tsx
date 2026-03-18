"use client";

import { VibeLevel, getVibeHexColor, getVibeLabel } from "@/lib/venues";

const VIBES: (VibeLevel | "all")[] = ["all", "quiet", "moderate", "busy", "lit"];

interface VibeFilterProps {
  selected: VibeLevel | "all";
  onSelect: (vibe: VibeLevel | "all") => void;
}

export function VibeFilter({ selected, onSelect }: VibeFilterProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {VIBES.map((vibe) => (
        <button
          key={vibe}
          onClick={() => onSelect(vibe)}
          className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-sm transition-colors ${
            selected === vibe
              ? "bg-white text-black"
              : "bg-white/[0.08] text-white/50 hover:bg-white/[0.12]"
          }`}
        >
          {vibe !== "all" && (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: getVibeHexColor(vibe) }}
            />
          )}
          <span>{vibe === "all" ? "Any vibe" : getVibeLabel(vibe)}</span>
        </button>
      ))}
    </div>
  );
}
