"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type Venue,
  getVibeHexColor,
  getVibeLabel,
  getOccupancyPercent,
} from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";

interface StoreDrawerProps {
  venues: Venue[];
  onClose: () => void;
  onVenueSelect: (venue: Venue) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

interface Perk {
  id: string;
  venue_id: string;
  name: string;
  point_cost: number;
  category: string;
  description: string | null;
}

interface UserData {
  balance: number;
  perks: Perk[];
  venueProfiles: { venue_id: string; xp: number; visits: number; venues?: { name: string } }[];
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const VIBE_ORDER: Record<string, number> = { lit: 4, packed: 4, busy: 3, moderate: 2, quiet: 1 };
const PERK_EMOJI: Record<string, string> = { drink: "☕", food: "🍔", access: "🔑", experience: "✨", merch: "🎁", other: "🎯" };

const CATEGORY_ICONS: Record<string, string> = {
  rooftop: "M3 21h18M5 21V7l7-4 7 4v14",
  cafe: "M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2",
  bar: "M8 22h8M12 2v20M17 8H7l1-6h8l1 6z",
  lounge: "M20 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16M2 21h20M12 7v6M8 10h8",
  restaurant: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3",
  club: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  coworking: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM12 11v4M8 11v4M16 11v4",
  venue: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7v3M12 14h.01",
};

// ─── Shelf component ─────────────────────────────────────────────

function Shelf({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-5 pb-2.5">
        <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25">
          {title}
        </span>
        {count !== undefined && (
          <span className="font-sans text-[10px] text-white/15">{count}</span>
        )}
      </div>
      <div
        className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Venue Card (Airbnb meets Netflix) ───────────────────────────

function VenueCard({
  venue, onClick, delay, distance, xp,
}: {
  venue: Venue; onClick: () => void; delay: number; distance?: number; xp?: number;
}) {
  const vibeColor = getVibeHexColor(venue.vibe);
  const themeColor = venue.themeColor || vibeColor;
  const pct = getOccupancyPercent(venue);
  const catIcon = CATEGORY_ICONS[venue.category] || CATEGORY_ICONS.venue;
  const catLabel = venue.category === "coworking" ? "Cowork" : venue.category;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex shrink-0 flex-col overflow-hidden rounded-2xl text-left"
      style={{
        width: 200,
        scrollSnapAlign: "start",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Hero area — gradient with category icon */}
      <div
        className="relative flex items-center justify-center"
        style={{
          height: 110,
          background: `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}08 50%, rgba(0,0,0,0.3) 100%)`,
        }}
      >
        {/* Category icon */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={`${themeColor}40`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={catIcon} />
        </svg>

        {/* Live vibe badge — top left */}
        <div
          className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full px-2 py-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
        >
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 4px ${vibeColor}` }} />
          <span className="font-sans text-[9px] font-semibold" style={{ color: vibeColor }}>
            {getVibeLabel(venue.vibe)}
          </span>
        </div>

        {/* XP badge — top right */}
        {xp !== undefined && xp > 0 && (
          <div className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <span className="font-mono text-[9px] font-bold" style={{ color: themeColor }}>⚡ {xp}</span>
          </div>
        )}

        {/* Occupancy bar — bottom */}
        <div className="absolute inset-x-3 bottom-2.5">
          <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: vibeColor }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-3 py-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="truncate font-sans text-[13px] font-bold text-white/90">{venue.name}</p>
          <span className="shrink-0 font-mono text-[10px] font-semibold text-white/25">{venue.occupancy}/{venue.capacity}</span>
        </div>

        {/* Tagline or description */}
        {venue.tagline ? (
          <p className="mt-0.5 line-clamp-2 font-sans text-[10px] leading-[1.4] text-white/35">{venue.tagline}</p>
        ) : venue.description ? (
          <p className="mt-0.5 line-clamp-2 font-sans text-[10px] leading-[1.4] text-white/35">{venue.description}</p>
        ) : null}

        {/* Bottom meta row */}
        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <span className="rounded-md px-1.5 py-0.5 font-sans text-[8px] font-semibold capitalize text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {catLabel}
          </span>
          {venue.neighborhood && (
            <span className="truncate font-sans text-[9px] text-white/20">{venue.neighborhood}</span>
          )}
          {distance !== undefined && (
            <span className="ml-auto shrink-0 font-sans text-[9px] font-medium text-white/25">{distance.toFixed(1)} mi</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Perk Card (DoorDash reward style) ───────────────────────────

function PerkCard({
  perk, venueName, canAfford, onClick, delay,
}: {
  perk: Perk; venueName: string; canAfford: boolean; onClick: () => void; delay: number;
}) {
  const emoji = PERK_EMOJI[perk.category] || "🎯";

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: canAfford ? 1 : 0.45, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex shrink-0 flex-col overflow-hidden rounded-2xl text-left"
      style={{
        width: 155,
        scrollSnapAlign: "start",
        backgroundColor: canAfford ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${canAfford ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      {/* Emoji hero */}
      <div
        className="flex items-center justify-center"
        style={{
          height: 64,
          background: canAfford
            ? "linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(249,115,22,0.03) 100%)"
            : "rgba(255,255,255,0.02)",
        }}
      >
        <span className="text-[28px]">{emoji}</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-3 py-2">
        <p className="truncate font-sans text-[12px] font-bold text-white/80">{perk.name}</p>
        {perk.description && (
          <p className="mt-0.5 line-clamp-1 font-sans text-[9px] text-white/25">{perk.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="font-mono text-[11px] font-bold text-orange">{perk.point_cost} pts</span>
          <span className="truncate font-sans text-[9px] text-white/20">{venueName}</span>
        </div>
      </div>

      {/* Redeem hint */}
      {canAfford && (
        <div className="border-t px-3 py-1.5 text-center" style={{ borderColor: "rgba(249,115,22,0.1)", backgroundColor: "rgba(249,115,22,0.04)" }}>
          <span className="font-sans text-[9px] font-semibold text-orange/70">Tap to redeem</span>
        </div>
      )}
    </motion.button>
  );
}

// ─── Main StoreDrawer ────────────────────────────────────────────

export function StoreDrawer({ venues, onClose, onVenueSelect, userLocation }: StoreDrawerProps) {
  const [userData, setUserData] = useState<UserData | null>(null);

  // Load user data for personalized shelves
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      try {
        const res = await fetch(`/api/points?userId=${user.id}`);
        const data = await res.json();
        setUserData({
          balance: data.balance?.balance || 0,
          perks: [],
          venueProfiles: data.venueProfiles || [],
        });

        // Load perks from all venues
        const allPerks: Perk[] = [];
        for (const v of venues.filter((v) => v.claimed !== false).slice(0, 10)) {
          try {
            const pRes = await fetch(`/api/points?userId=${user.id}&venueId=${v.id}`);
            const pData = await pRes.json();
            if (pData.perks) allPerks.push(...pData.perks);
          } catch { /* skip */ }
        }
        setUserData((prev) => prev ? { ...prev, perks: allPerks } : null);
      } catch { /* skip */ }
    });
  }, [venues]);

  // ─── Build shelves ───────────────────────────────────────────

  const claimedVenues = useMemo(() => venues.filter((v) => v.claimed !== false), [venues]);

  // Happening Now: sorted by energy (busiest first)
  const happeningNow = useMemo(
    () => [...claimedVenues].sort((a, b) => (VIBE_ORDER[b.vibe] || 0) - (VIBE_ORDER[a.vibe] || 0)).slice(0, 10),
    [claimedVenues]
  );

  // Good for Focus: quiet venues
  const quietSpots = useMemo(
    () => claimedVenues.filter((v) => v.vibe === "quiet" || v.vibe === "moderate"),
    [claimedVenues]
  );

  // Near You: sorted by distance
  const nearYou = useMemo(() => {
    if (!userLocation) return [];
    return [...venues]
      .map((v) => ({ venue: v, dist: getDistance(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
  }, [venues, userLocation]);

  // Your Spots: venues the user has XP at
  const yourSpots = useMemo(() => {
    if (!userData?.venueProfiles.length) return [];
    return userData.venueProfiles
      .map((vp) => {
        const venue = venues.find((v) => v.id === vp.venue_id);
        return venue ? { venue, xp: vp.xp } : null;
      })
      .filter(Boolean) as { venue: Venue; xp: number }[];
  }, [venues, userData]);

  // Perks the user can afford
  const affordablePerks = useMemo(() => {
    if (!userData?.perks.length) return [];
    return userData.perks.sort((a, b) => a.point_cost - b.point_cost);
  }, [userData]);

  const venueNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of venues) m.set(v.id, v.name);
    return m;
  }, [venues]);

  const findVenue = (venueId: string) => venues.find((v) => v.id === venueId);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        background: "rgba(8, 8, 10, 0.97)",
        backdropFilter: "blur(60px) saturate(1.5)",
        WebkitBackdropFilter: "blur(60px) saturate(1.5)",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-4">
        <h1 className="font-sans text-[26px] font-bold tracking-tight text-white">Explore</h1>
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.85 }}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </motion.button>
      </div>

      {/* Scrollable shelves */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain pb-[max(24px,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* ── Happening Now ── */}
        {happeningNow.length > 0 && (
          <Shelf title="HAPPENING NOW" count={happeningNow.length}>
            {happeningNow.map((v, i) => (
              <VenueCard
                key={v.id}
                venue={v}
                onClick={() => onVenueSelect(v)}
                delay={Math.min(i * 0.04, 0.2)}
                xp={userData?.venueProfiles.find((vp) => vp.venue_id === v.id)?.xp}
              />
            ))}
          </Shelf>
        )}

        {/* ── Your Spots ── */}
        {yourSpots.length > 0 && (
          <Shelf title="YOUR SPOTS">
            {yourSpots.map(({ venue, xp }, i) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onClick={() => onVenueSelect(venue)}
                delay={Math.min(i * 0.04, 0.2)}
                xp={xp}
              />
            ))}
          </Shelf>
        )}

        {/* ── Near You ── */}
        {nearYou.length > 0 && (
          <Shelf title="NEAR YOU">
            {nearYou.map(({ venue, dist }, i) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onClick={() => onVenueSelect(venue)}
                delay={Math.min(i * 0.04, 0.2)}
                distance={dist}
              />
            ))}
          </Shelf>
        )}

        {/* ── Good for Focus ── */}
        {quietSpots.length > 0 && (
          <Shelf title="GOOD FOR FOCUS">
            {quietSpots.map((v, i) => (
              <VenueCard
                key={v.id}
                venue={v}
                onClick={() => onVenueSelect(v)}
                delay={Math.min(i * 0.04, 0.2)}
              />
            ))}
          </Shelf>
        )}

        {/* ── Your Perks ── */}
        {affordablePerks.length > 0 && (
          <Shelf title="YOUR PERKS" count={affordablePerks.length}>
            {affordablePerks.map((perk, i) => (
              <PerkCard
                key={perk.id}
                perk={perk}
                venueName={venueNameMap.get(perk.venue_id) || "Venue"}
                canAfford={(userData?.balance || 0) >= perk.point_cost}
                onClick={() => {
                  const venue = findVenue(perk.venue_id);
                  if (venue) onVenueSelect(venue);
                }}
                delay={Math.min(i * 0.04, 0.2)}
              />
            ))}
          </Shelf>
        )}

        {/* ── All Venues ── */}
        <Shelf title="ALL VENUES" count={venues.length}>
          {venues.map((v, i) => (
            <VenueCard
              key={v.id}
              venue={v}
              onClick={() => onVenueSelect(v)}
              delay={Math.min(i * 0.04, 0.2)}
            />
          ))}
        </Shelf>
      </div>
    </motion.div>
  );
}
