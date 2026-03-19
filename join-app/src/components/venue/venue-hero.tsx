"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  page: {
    hero_image: string | null;
    logo: string | null;
    tagline: string | null;
    theme_color: string;
    hours: { day: string; open: string; close: string }[];
  };
  venue: {
    name: string;
    vibe: string;
    address?: string;
    neighborhood?: string;
  };
}

function getOpenStatus(hours: { day: string; open: string; close: string }[]): string | null {
  if (!hours || hours.length === 0) return null;
  // Simple: show first close time as "Open until X"
  const today = hours[0];
  if (today?.close) return `Open until ${today.close}`;
  if (today?.open) return `Opens at ${today.open}`;
  return null;
}

export function VenueHero({ page, venue }: Props) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: "40svh", minHeight: 240 }}>
      {/* Background — hero image or gradient */}
      {page.hero_image ? (
        <Image
          src={page.hero_image}
          alt={venue.name}
          fill
          className="object-cover"
          priority
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${page.theme_color}00 0%, ${page.theme_color} 100%)`,
          }}
        />
      )}

      {/* Bottom gradient fade to pure black */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, #000000 0%, #00000099 50%, transparent 100%)" }}
      />

      {/* Content — bottom-pinned, safe area aware */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* LIVE badge */}
          <div
            className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ backgroundColor: page.theme_color }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-black" />
            <span className="font-sans text-[10px] font-bold tracking-[1.5px] text-black">
              LIVE
            </span>
          </div>

          {/* Venue name — responsive sizing */}
          <h1 className="font-sans text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">
            {venue.name}
          </h1>

          {/* Tagline or location */}
          {page.tagline ? (
            <p className="mt-1 font-sans text-[13px] text-white/50 sm:text-sm">{page.tagline}</p>
          ) : (
            <p className="mt-1 font-sans text-[13px] text-white/50 sm:text-sm">
              {[venue.neighborhood, getOpenStatus(page.hours)].filter(Boolean).join(" · ") || "Welcome"}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
