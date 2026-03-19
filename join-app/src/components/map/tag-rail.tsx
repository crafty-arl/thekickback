"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { type Venue, getVibeHexColor } from "@/lib/venues";

export interface Tag {
  id: string;
  label: string;
  type: "venue" | "category" | "vibe" | "offering" | "neighborhood";
  color: string;
  venueIds: string[]; // which venues match this tag
}

interface TagRailProps {
  venues: Venue[];
  activeTag: string | null;
  onTagSelect: (tag: Tag | null) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Cafes",
  bar: "Bars",
  restaurant: "Eats",
  lounge: "Lounges",
  cowork: "Cowork",
  coworking: "Cowork",
  rooftop: "Rooftops",
  club: "Clubs",
};

const VIBE_LABELS: Record<string, string> = {
  quiet: "Chill",
  moderate: "Lively",
  busy: "Poppin",
  lit: "Lit",
  packed: "Packed",
};

export function TagRail({ venues, activeTag, onTagSelect }: TagRailProps) {
  const tags = useMemo(() => {
    const result: Tag[] = [];
    const seen = new Set<string>();

    // Category tags
    const catGroups = new Map<string, string[]>();
    for (const v of venues) {
      const cat = v.category?.toLowerCase();
      if (!cat || cat === "venue" || cat === "other") continue;
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(v.id);
    }
    for (const [cat, ids] of catGroups) {
      if (ids.length === 0) continue;
      const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ id: `cat-${cat}`, label, type: "category", color: "#a78bfa", venueIds: ids });
    }

    // Vibe tags
    const vibeGroups = new Map<string, string[]>();
    for (const v of venues) {
      if (!vibeGroups.has(v.vibe)) vibeGroups.set(v.vibe, []);
      vibeGroups.get(v.vibe)!.push(v.id);
    }
    for (const [vibe, ids] of vibeGroups) {
      const label = VIBE_LABELS[vibe] || vibe;
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ id: `vibe-${vibe}`, label, type: "vibe", color: getVibeHexColor(vibe), venueIds: ids });
    }

    // Neighborhood tags
    const hoodGroups = new Map<string, string[]>();
    for (const v of venues) {
      const hood = v.neighborhood?.trim();
      if (!hood) continue;
      if (!hoodGroups.has(hood)) hoodGroups.set(hood, []);
      hoodGroups.get(hood)!.push(v.id);
    }
    for (const [hood, ids] of hoodGroups) {
      if (ids.length < 1 || seen.has(hood)) continue;
      seen.add(hood);
      result.push({ id: `hood-${hood}`, label: hood, type: "neighborhood", color: "#60a5fa", venueIds: ids });
    }

    // Individual venue tags (claimed only)
    for (const v of venues) {
      if (v.claimed === false) continue;
      result.push({ id: `venue-${v.id}`, label: v.name, type: "venue", color: v.themeColor || getVibeHexColor(v.vibe), venueIds: [v.id] });
    }

    return result;
  }, [venues]);

  if (tags.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 flex items-center"
      style={{ bottom: "max(68px, calc(62px + env(safe-area-inset-bottom, 6px)))" }}
    >
      {/* Scrollable tag row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="flex gap-1.5 overflow-x-auto px-4 py-1.5 no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none" }}
      >
        {/* All tag (clear filter) */}
        {activeTag && (
          <button
            onClick={() => onTagSelect(null)}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium transition-all active:scale-95"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            All
          </button>
        )}

        {tags.map((tag) => {
          const isActive = activeTag === tag.id;
          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect(isActive ? null : tag)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium transition-all active:scale-95"
              style={{
                backgroundColor: isActive ? `${tag.color}20` : "rgba(15,15,18,0.7)",
                color: isActive ? tag.color : "rgba(255,255,255,0.45)",
                border: `1px solid ${isActive ? `${tag.color}40` : "rgba(255,255,255,0.06)"}`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              {tag.type === "venue" && (
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
              )}
              {tag.type === "vibe" && (
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
              )}
              {tag.label}
              {tag.venueIds.length > 1 && (
                <span style={{ opacity: 0.5 }}>{tag.venueIds.length}</span>
              )}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
