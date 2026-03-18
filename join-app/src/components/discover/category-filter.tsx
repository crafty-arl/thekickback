"use client";

import { VenueCategory, VENUE_CATEGORIES } from "@/lib/venues";

interface CategoryFilterProps {
  selected: VenueCategory | "all";
  onSelect: (cat: VenueCategory | "all") => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {VENUE_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(cat.value)}
          className={`shrink-0 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors ${
            selected === cat.value
              ? "bg-white text-black"
              : "bg-white/[0.08] text-white/50 hover:bg-white/[0.12]"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
