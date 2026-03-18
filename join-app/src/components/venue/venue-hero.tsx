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
    <div className="relative h-[50vh] min-h-[320px] w-full overflow-hidden">
      {/* Background */}
      {page.hero_image ? (
        <Image
          src={page.hero_image}
          alt={venue.name}
          fill
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-[#0D0D0F]" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/60 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-lg"
        >
          {/* Logo */}
          {page.logo && (
            <div className="mb-4 h-12 w-12 overflow-hidden rounded-xl">
              <Image src={page.logo} alt="" width={48} height={48} />
            </div>
          )}

          {/* Venue name */}
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white">
            {venue.name}
          </h1>

          {/* Tagline */}
          {page.tagline && (
            <p className="mt-2 font-sans text-base text-white/50">
              {page.tagline}
            </p>
          )}

          {/* Vibe indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: page.theme_color }}
            />
            <span className="font-sans text-sm font-medium capitalize text-white/60">
              {venue.vibe}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
