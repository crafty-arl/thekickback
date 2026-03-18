"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  page: {
    hero_image: string | null;
    logo: string | null;
    tagline: string | null;
    theme_color: string;
  };
  venue: {
    name: string;
    vibe: string;
  };
}

export function VenueHero({ page, venue }: Props) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: "33vh", minHeight: 280 }}>
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

      {/* Bottom gradient fade to black */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/70 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-lg"
        >
          {/* LIVE badge */}
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ backgroundColor: page.theme_color }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-black" />
            <span className="font-sans text-[10px] font-bold tracking-[1.5px] text-black">
              LIVE
            </span>
          </div>

          {/* Venue name */}
          <h1 className="font-sans text-[32px] font-bold tracking-tight text-white">
            {venue.name}
          </h1>

          {/* Location line */}
          <p className="mt-1 font-sans text-sm text-white/50">
            Downtown · Open until 12 AM
          </p>
        </motion.div>
      </div>
    </div>
  );
}
