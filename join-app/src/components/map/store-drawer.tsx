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

// ─── Venue Card (Netflix thumbnail) ──────────────────────────────

function VenueCard({
  venue, onClick, delay, distance, xp,
}: {
  venue: Venue; onClick: () => void; delay: number; distance?: number; xp?: number;
}) {
  const vibeColor = getVibeHexColor(venue.vibe);
  const themeColor = venue.themeColor || vibeColor;
  const pct = getOccupancyPercent(venue);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative flex shrink-0 flex-col overflow-hidden rounded-2xl text-left"
      style={{
        width: 140,
        height: 190,
        scrollSnapAlign: "start",
        background: `linear-gradient(160deg, ${themeColor}18 0%, rgba(255,255,255,0.02) 60%, ${themeColor}08 100%)`,
        border: `1px solid ${themeColor}20`,
      }}
    >
      {/* XP badge */}
      {xp !== undefined && xp > 0 && (
        <div className="absolute right-2 top-2 rounded-md px-1.5 py-0.5" style={{ backgroundColor: `${themeColor}25` }}>
          <span className="font-mono text-[8px] font-bold" style={{ color: themeColor }}>⚡{xp}</span>
        </div>
      )}

      {/* Vibe glow orb */}
      <div className="flex flex-1 items-center justify-center">
        <div
          className="rounded-full"
          style={{
            width: 48,
            height: 48,
            background: `radial-gradient(circle, ${themeColor}30 0%, transparent 70%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: 20,
              height: 20,
              backgroundColor: themeColor,
              boxShadow: `0 0 20px ${themeColor}50`,
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="px-3 pb-3">
        <p className="truncate font-sans text-[13px] font-bold text-white/85">{venue.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor }} />
          <span className="font-sans text-[10px] font-medium" style={{ color: vibeColor }}>
            {getVibeLabel(venue.vibe)}
          </span>
          <span className="font-sans text-[10px] text-white/20">·</span>
          <span className="font-mono text-[10px] text-white/25">{venue.occupancy}</span>
        </div>
        {distance !== undefined && (
          <span className="font-sans text-[9px] text-white/20">{distance.toFixed(1)} mi</span>
        )}
        {/* Mini occupancy bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: vibeColor }} />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Perk Card (compact square) ──────────────────────────────────

function PerkCard({
  perk, venueName, canAfford, onClick, delay,
}: {
  perk: Perk; venueName: string; canAfford: boolean; onClick: () => void; delay: number;
}) {
  const emoji = PERK_EMOJI[perk.category] || "🎯";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: canAfford ? 1 : 0.4, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex shrink-0 flex-col justify-between overflow-hidden rounded-xl p-3 text-left"
      style={{
        width: 120,
        height: 120,
        scrollSnapAlign: "start",
        backgroundColor: canAfford ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${canAfford ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <span className="text-[20px]">{emoji}</span>
      <div>
        <p className="font-mono text-[12px] font-bold text-orange">{perk.point_cost} pts</p>
        <p className="truncate font-sans text-[11px] font-semibold text-white/70">{perk.name}</p>
        <p className="truncate font-sans text-[9px] text-white/25">{venueName}</p>
      </div>
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
