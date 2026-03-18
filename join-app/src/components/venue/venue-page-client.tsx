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

function vibeColor(vibe: string): string {
  switch (vibe) {
    case "quiet": return "#4ADE80";
    case "moderate": return "#FACC15";
    case "busy": return "#F97316";
    case "packed": return "#EF4444";
    default: return "#4ADE80";
  }
}

function vibeLabel(vibe: string): string {
  switch (vibe) {
    case "quiet": return "Quiet";
    case "moderate": return "Moderate";
    case "busy": return "Busy";
    case "packed": return "Packed";
    default: return vibe;
  }
}

export function VenuePageClient({ page, venue, table }: Props) {
  const [joined, setJoined] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col text-white" style={{ backgroundColor: "#000" }}>
      {/* Hero */}
      <VenueHero page={page} venue={venue} />

      {/* Single card — all content lives here */}
      <div className="mx-auto w-full max-w-lg flex-1 px-5">
        <AnimatePresence mode="wait">
          {!joined ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center pt-8"
            >
              {/* Vibe — single line */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: vibeColor(venue.vibe) }} />
                <span className="font-sans text-sm" style={{ color: vibeColor(venue.vibe) }}>
                  {vibeLabel(venue.vibe)}
                </span>
                <span className="font-sans text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span className="font-sans text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {venue.occupancy} people
                </span>
              </div>

              {/* Join CTA */}
              <button
                onClick={() => setJoined(true)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-sans text-base font-bold text-black active:scale-[0.98]"
                style={{ backgroundColor: page.theme_color }}
              >
                Tap to Join
              </button>

              {/* Alt methods */}
              <div className="mt-3 grid w-full grid-cols-2 gap-3">
                <button
                  onClick={() => setJoined(true)}
                  className="rounded-xl py-3 font-sans text-[13px] font-medium"
                  style={{ backgroundColor: "#111", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Email
                </button>
                <button
                  onClick={() => setJoined(true)}
                  className="rounded-xl py-3 font-sans text-[13px] font-medium"
                  style={{ backgroundColor: "#111", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Phone
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="joined"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4 pt-4"
            >
              {/* Quick actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex-1 rounded-xl py-3 font-sans text-sm font-semibold text-black"
                  style={{ backgroundColor: page.theme_color }}
                >
                  Talk to {venue.name}
                </button>
                <a
                  href="#info"
                  className="flex-1 rounded-xl py-3 text-center font-sans text-sm font-medium"
                  style={{ backgroundColor: "#111", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Menu
                </a>
              </div>

              {/* Wallet pass */}
              <a
                href={`https://thekickback.net/wallet/pass/${venue.id}/guest`}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: page.theme_color }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-sans text-sm font-medium text-white">Add to Wallet</p>
                  <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Live updates on lock screen</p>
                </div>
              </a>

              {/* Venue info */}
              <div id="info">
                <VenueInfo page={page} venue={venue} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {table && (
          <div className="mt-4 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
            <span className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>Table {table}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <span className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>powered by theKickBack</span>
      </div>

      {/* Chat */}
      <AnimatePresence>
        {chatOpen && <VenueChat venue={venue} page={page} table={table} onClose={() => setChatOpen(false)} />}
      </AnimatePresence>

      {joined && !chatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
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
