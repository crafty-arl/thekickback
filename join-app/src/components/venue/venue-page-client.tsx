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

function energyLabel(vibe: string): string {
  switch (vibe) {
    case "quiet": return "Chill";
    case "moderate": return "Steady";
    case "busy": return "Lively";
    case "packed": return "Electric";
    default: return "Chill";
  }
}

export function VenuePageClient({ page, venue, table }: Props) {
  const [joined, setJoined] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor: "#0D0D0F" }}>
      {/* Hero */}
      <VenueHero page={page} venue={venue} />

      <div className="mx-auto max-w-lg px-5 pb-32">
        {/* Live Stats Row — 3 dark cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8 grid grid-cols-3 gap-3"
        >
          <div className="rounded-xl p-3" style={{ backgroundColor: "#1A1A1A" }}>
            <span className="font-sans text-[10px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              VIBE
            </span>
            <p className="mt-1 font-sans text-lg font-bold" style={{ color: vibeColor(venue.vibe) }}>
              {vibeLabel(venue.vibe)}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#1A1A1A" }}>
            <span className="font-sans text-[10px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              PEOPLE
            </span>
            <p className="mt-1 font-sans text-lg font-bold text-white">
              {venue.occupancy} / {venue.max_occupancy}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#1A1A1A" }}>
            <span className="font-sans text-[10px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              ENERGY
            </span>
            <p className="mt-1 font-sans text-lg font-bold text-white">
              {energyLabel(venue.vibe)}
            </p>
          </div>
        </motion.div>

        {/* Join Card or Quick Actions */}
        <AnimatePresence mode="wait">
          {!joined ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mb-8 flex flex-col items-center"
            >
              {/* Spacer push to center */}
              <div className="h-8" />

              <h2 className="text-center font-sans text-xl font-semibold text-white">
                You&apos;re at {venue.name}
              </h2>
              <p className="mt-2 max-w-xs text-center font-sans text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                Join to access the menu, request a booth, check the vibe, and more.
              </p>

              {/* Tap to Join — primary CTA */}
              <button
                onClick={() => setJoined(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-sans text-[17px] font-bold text-black transition-transform active:scale-[0.98]"
                style={{ backgroundColor: page.theme_color }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Tap to Join
              </button>

              {/* Email / Phone buttons */}
              <div className="mt-3 grid w-full grid-cols-2 gap-3">
                <button
                  onClick={() => setJoined(true)}
                  className="flex items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-medium transition-colors"
                  style={{ backgroundColor: "#1A1A1A", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </button>
                <button
                  onClick={() => setJoined(true)}
                  className="flex items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-medium transition-colors"
                  style={{ backgroundColor: "#1A1A1A", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  Phone
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6"
            >
              {/* Quick actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex-1 rounded-xl py-3.5 font-sans text-sm font-semibold text-black transition-colors"
                  style={{ backgroundColor: page.theme_color }}
                >
                  Talk to {venue.name}
                </button>
                <a
                  href="#menu"
                  className="flex-1 rounded-xl py-3.5 text-center font-sans text-sm font-medium transition-colors"
                  style={{ backgroundColor: "#1A1A1A", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Menu
                </a>
              </div>

              {/* Wallet Pass Prompt */}
              <a
                href={`https://thekickback.net/wallet/pass/${venue.id}/guest`}
                className="mt-4 flex items-center gap-4 rounded-2xl p-4 transition-colors hover:opacity-80"
                style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: page.theme_color }}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-sans text-sm font-semibold text-white">Add to Wallet</p>
                  <p className="font-sans text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Live updates on your lock screen</p>
                </div>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Venue Info */}
        <VenueInfo page={page} venue={venue} />

        {/* Table context */}
        {table && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="font-sans text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Scanned from Table {table}
            </span>
          </motion.div>
        )}
      </div>

      {/* Powered by footer */}
      <div className="pb-6 text-center">
        <span className="font-sans text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>
          powered by theKickBack
        </span>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {chatOpen && (
          <VenueChat venue={venue} page={page} table={table} onClose={() => setChatOpen(false)} />
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      {joined && !chatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
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
