"use client";

import { type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue, getVibeHexColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";
import { type UserProfile, VIBE_COLORS, CATEGORY_ICONS } from "./the-drawer";
import { PointsBadge } from "../map/points-badge";

interface DrawerVenueProps {
  venue: Venue;
  user: UserProfile | null;
  vibeColor: string;
  onBack: () => void;
  onChat: () => void;
  walletStatus: { active: boolean; balanceCents: number; refresh?: () => void } | null;
  hasLocation: boolean;
  navInfo: { steps: { instruction: string; distance: number; duration: number }[]; distance: number; duration: number; profile: "walking" | "driving" } | null;
  navLoading: boolean;
  navProfile: "walking" | "driving";
  fetchDirections: (profile: "walking" | "driving") => void;
  clearNav: () => void;
  openInMaps: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function DrawerVenue({
  venue, user, vibeColor, onBack, onChat, walletStatus,
  hasLocation, navInfo, navLoading, navProfile, fetchDirections, clearNav, openInMaps,
  scrollRef,
}: DrawerVenueProps) {
  const catIcon = CATEGORY_ICONS[venue.category] || CATEGORY_ICONS.venue;
  const catLabel = venue.category === "coworking" ? "Cowork" : venue.category;
  const pct = venue.capacity > 0 ? Math.round((venue.occupancy / venue.capacity) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} className="flex h-[48px] items-center gap-2 rounded-full px-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><polyline points="15 18 9 12 15 6" /></svg>
          <span className="font-sans text-[15px] font-semibold text-white/60">Back</span>
        </motion.button>
        <div className="flex items-center gap-2">
          {/* Navigate */}
          {hasLocation && venue.latitude !== 0 && (
            <button
              onClick={() => navInfo ? clearNav() : fetchDirections(navProfile)}
              disabled={navLoading}
              className="flex h-[48px] items-center gap-1.5 rounded-full px-3 active:scale-95"
              style={{ backgroundColor: navInfo ? `${vibeColor}20` : "rgba(255,255,255,0.04)", border: `1px solid ${navInfo ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={navInfo ? vibeColor : "rgba(255,255,255,0.4)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
              <span className="font-sans text-[15px] font-semibold" style={{ color: navInfo ? vibeColor : "rgba(255,255,255,0.4)" }}>
                {navLoading ? "..." : navInfo ? `${Math.round(navInfo.duration / 60)} min` : "Navigate"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
        {/* Hero area */}
        <div className="relative mb-4 overflow-hidden rounded-2xl" style={{ height: 160, background: `linear-gradient(135deg, ${vibeColor}25 0%, ${vibeColor}08 60%, rgba(0,0,0,0.4) 100%)` }}>
          {venue.heroImage ? (
            <img src={venue.heroImage} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={`${vibeColor}40`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
            </div>
          )}
          {/* Vibe badge */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 6px ${vibeColor}` }} />
            <span className="font-sans text-[12px] font-semibold" style={{ color: vibeColor }}>{getVibeLabel(venue.vibe)}</span>
          </div>
          {/* Occupancy */}
          {venue.occupancy > 0 && (
            <div className="absolute right-3 top-3 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
              <span className="font-mono text-[12px] font-semibold text-white/60">{venue.occupancy} / {venue.capacity}</span>
            </div>
          )}
          {/* Progress bar */}
          <div className="absolute inset-x-4 bottom-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: vibeColor }} />
            </div>
          </div>
        </div>

        {/* Venue name + info */}
        <h2 className="font-sans text-[20px] font-bold text-white/90">{venue.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          {catLabel && catLabel !== "venue" && (
            <span className="rounded-md px-2 py-0.5 font-sans text-[12px] font-semibold capitalize text-white/35" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{catLabel}</span>
          )}
          {venue.neighborhood && <span className="font-sans text-[15px] text-white/35">{venue.neighborhood}</span>}
        </div>
        {venue.tagline && <p className="mt-2 font-sans text-[15px] italic text-white/30">&ldquo;{venue.tagline}&rdquo;</p>}

        {/* Action row */}
        <div className="mt-4 flex items-center gap-3" style={{ gap: 12 }}>
          <button onClick={onChat} className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl font-sans text-[15px] font-bold text-black active:scale-[0.97]" style={{ backgroundColor: vibeColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {user ? "Chat" : "Sign in to chat"} &#9656;
          </button>
          <button className="flex h-[48px] w-[48px] items-center justify-center rounded-2xl active:scale-95" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          </button>
          <button className="flex h-[48px] w-[48px] items-center justify-center rounded-2xl active:scale-95" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
          </button>
        </div>

        {/* Navigation directions */}
        <AnimatePresence>
          {navInfo && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${vibeColor}15` }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <button onClick={() => fetchDirections("walking")} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold transition" style={{ backgroundColor: navProfile === "walking" ? `${vibeColor}20` : "transparent", color: navProfile === "walking" ? vibeColor : "rgba(255,255,255,0.35)" }}>Walk</button>
                    <button onClick={() => fetchDirections("driving")} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold transition" style={{ backgroundColor: navProfile === "driving" ? `${vibeColor}20` : "transparent", color: navProfile === "driving" ? vibeColor : "rgba(255,255,255,0.35)" }}>Drive</button>
                  </div>
                  <span className="font-mono text-[15px] font-bold" style={{ color: vibeColor }}>{Math.round(navInfo.duration / 60)} min</span>
                  <span className="font-mono text-[12px] text-white/30">{navInfo.distance < 1000 ? `${Math.round(navInfo.distance)} m` : `${(navInfo.distance / 1609).toFixed(1)} mi`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={openInMaps} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold active:scale-95" style={{ backgroundColor: `${vibeColor}15`, color: vibeColor, border: `1px solid ${vibeColor}25` }}>Open Maps</button>
                  <button onClick={clearNav} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/[0.08]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="max-h-[120px] overflow-y-auto px-4 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                {navInfo.steps.filter((s) => s.instruction).map((step, i) => (
                  <div key={i} className="flex items-start gap-2 py-1" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${vibeColor}15` }}>
                      <span className="font-mono text-[8px] font-bold" style={{ color: vibeColor }}>{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[12px] leading-[1.4] text-white/60">{step.instruction}</p>
                      <span className="font-mono text-[10px] text-white/20">{step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1609).toFixed(1)} mi`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hours */}
        {venue.hours && (
          <div className="mt-5">
            <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">HOURS</span>
            <p className="mt-1 font-sans text-[15px] text-white/50">{venue.hours}</p>
          </div>
        )}

        {/* Description */}
        {venue.description && (
          <div className="mt-5">
            <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">ABOUT</span>
            <p className="mt-1 font-sans text-[15px] leading-[1.5] text-white/50">{venue.description}</p>
          </div>
        )}

        {/* Ghost venue CTA */}
        {venue.claimed === false && (
          <div className="mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.1)" }}>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] text-white/25">This venue hasn&apos;t claimed their page yet</span>
              <a href="https://dash.thekickback.net" target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 font-sans text-[12px] font-bold text-black" style={{ backgroundColor: "#F97316" }}>Claim</a>
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
