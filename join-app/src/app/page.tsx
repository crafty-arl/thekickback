"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { MOCK_VENUES, VenueCategory, VibeLevel } from "@/lib/venues";
import { SearchBar } from "@/components/discover/search-bar";
import { CategoryFilter } from "@/components/discover/category-filter";
import { VibeFilter } from "@/components/discover/vibe-filter";
import { VenueCard } from "@/components/discover/venue-card";
import { LiveStats } from "@/components/discover/live-stats";

export default function JoinPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<VenueCategory | "all">("all");
  const [vibe, setVibe] = useState<VibeLevel | "all">("all");

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
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-12">
        {/* Header */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="theKickBack"
              width={180}
              height={60}
              className="h-10 w-auto md:h-[60px]"
              priority
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-sans text-sm text-black/40 sm:block">
              Find your spot. Text to enter.
            </span>
            <a
              href="https://thekickback.net"
              className="rounded-full bg-black px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-black/85"
            >
              Learn more
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-col gap-6 pb-8 pt-6 md:pt-10">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-1px] text-black sm:text-4xl md:text-[48px] md:tracking-[-1.5px]">
              Discover what&apos;s happening right now.
            </h1>
            <p className="max-w-2xl font-sans text-base leading-relaxed text-black/55 md:text-lg">
              Browse live venues, check the vibe before you go, and text to enter.
              No app needed — just find your spot and send a text.
            </p>
          </div>

          <LiveStats venues={MOCK_VENUES} />
        </section>

        {/* Filters */}
        <section className="flex flex-col gap-4 pb-6">
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CategoryFilter selected={category} onSelect={setCategory} />
            <VibeFilter selected={vibe} onSelect={setVibe} />
          </div>
        </section>

        {/* Results count */}
        <div className="pb-4">
          <span className="font-sans text-sm text-black/40">
            {filtered.length} {filtered.length === 1 ? "venue" : "venues"}
            {category !== "all" || vibe !== "all" || search ? " matching" : " live"}
          </span>
        </div>

        {/* Venue Grid */}
        <section className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          {filtered.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 py-20">
              <span className="font-sans text-lg font-medium text-black/30">
                No venues match your filters
              </span>
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setVibe("all");
                }}
                className="rounded-full bg-black/[0.05] px-4 py-2 font-sans text-sm text-black/50 transition-colors hover:bg-black/[0.08]"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>

        {/* Bottom CTA */}
        <section className="flex flex-col items-center gap-4 border-t border-black/5 py-12 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-black sm:text-3xl">
            Found your spot?
          </h2>
          <p className="max-w-md font-sans text-base text-black/50">
            Text <strong className="text-black">JOIN</strong> to any venue number and you&apos;re in. No app, no account, no download.
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAFA] px-5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/35">TEXT &ldquo;JOIN&rdquo; TO</span>
              <span className="font-sans text-xl font-bold tracking-tight text-black sm:text-2xl">(877) 780-4236</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
