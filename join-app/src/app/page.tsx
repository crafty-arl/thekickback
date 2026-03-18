"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { MOCK_VENUES, VenueCategory, VibeLevel, type Venue } from "@/lib/venues";
import { SearchBar } from "@/components/discover/search-bar";
import { CategoryFilter } from "@/components/discover/category-filter";
import { VibeFilter } from "@/components/discover/vibe-filter";
import { VenueDrawer } from "@/components/map/venue-drawer";
import { AuthButton } from "@/components/auth-button";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  { ssr: false }
);

export default function JoinPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<VenueCategory | "all">("all");
  const [vibe, setVibe] = useState<VibeLevel | "all">("all");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const filtered = useMemo(() => {
    return MOCK_VENUES.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      if (vibe !== "all" && v.vibe !== vibe) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.neighborhood.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.includes(q))
        );
      }
      return true;
    });
  }, [search, category, vibe]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Full-screen map */}
      <MapView
        venues={filtered}
        selectedVenue={selectedVenue}
        onVenueSelect={setSelectedVenue}
      />

      {/* Floating overlays — pointer-events-none container, auto on children */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        {/* Header */}
        <header className="pointer-events-auto flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))] pb-2 sm:px-6">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="theKickBack"
              width={140}
              height={46}
              className="h-8 w-auto drop-shadow-lg"
              priority
            />
          </div>
          <AuthButton />
        </header>

        {/* Search + filters */}
        <div className="pointer-events-auto flex flex-col gap-3 px-4 pt-2 sm:px-6">
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CategoryFilter selected={category} onSelect={setCategory} />
            <VibeFilter selected={vibe} onSelect={setVibe} />
          </div>
        </div>

        {/* Venue count badge */}
        <div className="pointer-events-auto mx-4 mt-3 self-start sm:mx-6">
          <span className="rounded-full bg-black/70 px-3 py-1 font-sans text-xs font-medium text-white/60 backdrop-blur-sm">
            {filtered.length} {filtered.length === 1 ? "venue" : "venues"}
            {category !== "all" || vibe !== "all" || search ? " matching" : " live"}
          </span>
        </div>
      </div>

      {/* Venue drawer */}
      <AnimatePresence>
        {selectedVenue && (
          <VenueDrawer
            key={selectedVenue.id}
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
