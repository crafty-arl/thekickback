"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VenueHero } from "./venue-hero";
import { VenueChat } from "./venue-chat";
import { VenueInfo } from "./venue-info";

interface Venue {
  id: string;
  name: string;
  state: string;
  occupancy: number;
  max_occupancy: number;
  vibe: string;
  rules: string[];
}

interface VenuePage {
  slug: string;
  hero_image: string | null;
  logo: string | null;
  tagline: string | null;
  description: string | null;
  theme_color: string;
  menu_sections: { name: string; items: string[] }[];
  hours: { day: string; open: string; close: string }[];
}

interface Props {
  page: VenuePage;
  venue: Venue;
  table?: string;
  ref?: string;
}

export function VenuePageClient({ page, venue, table }: Props) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Hero */}
      <VenueHero page={page} venue={venue} />

      {/* Content */}
      <div className="mx-auto max-w-lg px-5 pb-32">
        {/* Live Vibe */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
        >
          <div className="flex items-center gap-3 pb-3">
            <div
              className="h-3 w-3 rounded-full animate-pulse"
              style={{ backgroundColor: page.theme_color }}
            />
            <span className="font-sans text-sm font-medium text-white/50">LIVE</span>
          </div>
          <p className="font-sans text-xl font-semibold text-white">
            {venue.vibe === "quiet" && "Quiet right now"}
            {venue.vibe === "moderate" && "Moderately busy"}
            {venue.vibe === "busy" && "Lively atmosphere"}
            {venue.vibe === "packed" && "Standing room only"}
          </p>
          <p className="mt-1 font-sans text-sm text-white/40">
            {venue.occupancy} people · {Math.max(0, venue.max_occupancy - venue.occupancy)} spots open
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-6 flex gap-3"
        >
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 rounded-xl py-3.5 font-sans text-sm font-semibold text-black transition-colors"
            style={{ backgroundColor: page.theme_color }}
          >
            Talk to {venue.name}
          </button>
          <a
            href="#menu"
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3.5 text-center font-sans text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
          >
            Menu
          </a>
        </motion.div>

        {/* Venue Info (menu, hours, rules) */}
        <VenueInfo page={page} venue={venue} />

        {/* Table context */}
        {table && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
          >
            <span className="font-sans text-xs text-white/30">
              Scanned from Table {table}
            </span>
          </motion.div>
        )}
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {chatOpen && (
          <VenueChat
            venue={venue}
            page={page}
            table={table}
            onClose={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
          style={{ backgroundColor: page.theme_color }}
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </motion.button>
      )}
    </main>
  );
}
