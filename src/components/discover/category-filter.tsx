"use client";

import { VenueCategory, VENUE_CATEGORIES } from "@/lib/venues";

interface CategoryFilterProps {
  selected: VenueCategory | "all";
  onSelect: (cat: VenueCategory | "all") => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VENUE_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(cat.value)}
          className={`rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors ${
            selected === cat.value
              ? "bg-black text-white"
              : "bg-black/[0.04] text-black/55 hover:bg-black/[0.08]"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
