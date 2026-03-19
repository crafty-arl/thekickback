"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, useAnimationControls, AnimatePresence, PanInfo } from "framer-motion";
import {
  type Venue,
  getVibeHexColor,
  getVibeLabel,
  getOccupancyPercent,
} from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { PreferencesSection } from "./preferences-section";

// ─── Types ───────────────────────────────────────────────────────

export interface Tag {
  id: string;
  label: string;
  type: "venue" | "category" | "vibe" | "offering" | "neighborhood";
  color: string;
  venueIds: string[];
}

interface ExploreSheetProps {
  venues: Venue[];
  onVenueSelect: (venue: Venue) => void;
  onTagSelect: (tag: Tag | null) => void;
  activeTag: Tag | null;
  userLocation?: { latitude: number; longitude: number } | null;
  masterExpanded: boolean;
}

interface Perk {
  id: string;
  venue_id: string;
  name: string;
  point_cost: number;
  category: string;
  description: string | null;
}

interface VenueXpProfile {
  venue_id: string;
  xp: number;
  visits: number;
  venues?: { id: string; name: string; vibe: string };
  venue_xp_milestones?: { name: string; color: string; threshold: number } | null;
}

interface UserProfile {
  authId: string;
  email: string;
  kickbackScore: number;
  totalEarned: number;
  tier: string;
  streak: number;
  venueProfiles: VenueXpProfile[];
}

// ─── Constants ───────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; label: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", label: "Explorer", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", label: "Regular", next: "Member", threshold: 1500 },
  member: { color: "#f97316", label: "Member", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", label: "VIP", next: "", threshold: Infinity },
};

const PERK_EMOJI: Record<string, string> = { drink: "\u2615", food: "\ud83c\udf54", access: "\ud83d\udd11", experience: "\u2728", merch: "\ud83c\udf81", other: "\ud83c\udfaf" };
const VIBE_ORDER: Record<string, number> = { lit: 4, packed: 4, busy: 3, moderate: 2, quiet: 1 };

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

const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Cafes", bar: "Bars", restaurant: "Eats", lounge: "Lounges",
  cowork: "Cowork", coworking: "Cowork", rooftop: "Rooftops", club: "Clubs",
};

const VIBE_LABELS: Record<string, string> = {
  quiet: "Chill", moderate: "Lively", busy: "Poppin", lit: "Lit", packed: "Packed",
};

// Snap points (percentage of viewport height from bottom)
const SNAP_PEEK = 100;   // px from bottom
const SNAP_HALF = 55;    // vh
const SNAP_FULL = 92;    // vh

type SnapPoint = "peek" | "half" | "full";

// ─── Helpers ─────────────────────────────────────────────────────

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function snapToHeight(snap: SnapPoint): string {
  if (snap === "peek") return `${SNAP_PEEK}px`;
  if (snap === "half") return `${SNAP_HALF}vh`;
  return `${SNAP_FULL}vh`;
}

// ─── Sub-components ──────────────────────────────────────────────

function Shelf({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-5 pb-2.5">
        <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25">{title}</span>
        {count !== undefined && <span className="font-sans text-[10px] text-white/15">{count}</span>}
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

function LandscapeVenueCard({
  venue, onClick, delay, distance, xp,
}: {
  venue: Venue; onClick: () => void; delay: number; distance?: number; xp?: number;
}) {
  const vibeColor = getVibeHexColor(venue.vibe);
  const themeColor = venue.themeColor || vibeColor;
  const catIcon = CATEGORY_ICONS[venue.category] || CATEGORY_ICONS.venue;
  const catLabel = venue.category === "coworking" ? "Cowork" : venue.category;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex shrink-0 overflow-hidden rounded-2xl text-left"
      style={{
        width: 280,
        height: 140,
        scrollSnapAlign: "start",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left 40% — gradient hero */}
      <div
        className="relative flex w-[40%] shrink-0 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${themeColor}25 0%, ${themeColor}08 60%, rgba(0,0,0,0.4) 100%)`,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${themeColor}50`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={catIcon} />
        </svg>
        {/* Vibe dot + label */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 4px ${vibeColor}` }} />
          <span className="font-sans text-[9px] font-semibold" style={{ color: vibeColor }}>{getVibeLabel(venue.vibe)}</span>
        </div>
      </div>

      {/* Right 60% — content */}
      <div className="flex w-[60%] flex-col justify-between p-3">
        {/* XP badge top-right */}
        {xp !== undefined && xp > 0 && (
          <div className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <span className="font-mono text-[9px] font-bold" style={{ color: themeColor }}>&#9889; {xp}</span>
          </div>
        )}

        <div>
          <p className="truncate font-sans text-[14px] font-bold text-white/90">{venue.name}</p>
          {(venue.tagline || venue.description) && (
            <p className="mt-0.5 line-clamp-1 font-sans text-[10px] leading-[1.4] text-white/35">
              {venue.tagline || venue.description}
            </p>
          )}
        </div>

        {/* Bottom meta */}
        <div className="flex items-center gap-1.5">
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

function PerkBadge({
  perk, venueName, canAfford, onClick, delay,
}: {
  perk: Perk; venueName: string; canAfford: boolean; onClick: () => void; delay: number;
}) {
  const emoji = PERK_EMOJI[perk.category] || "\ud83c\udfaf";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: canAfford ? 1 : 0.4, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex shrink-0 flex-col items-center"
      style={{ width: 80, scrollSnapAlign: "start" }}
    >
      {/* Circle */}
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
        style={{
          background: canAfford
            ? "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))"
            : "rgba(255,255,255,0.04)",
          border: `2px solid ${canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
          boxShadow: canAfford ? "0 0 16px rgba(249,115,22,0.15)" : "none",
        }}
      >
        <span className="text-[28px]">{emoji}</span>
      </div>
      {/* Venue name */}
      <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueName}</p>
      {/* Cost pill */}
      <div
        className="mt-0.5 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${canAfford ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        <span className={`font-mono text-[9px] font-bold ${canAfford ? "text-orange" : "text-white/25"}`}>{perk.point_cost} pts</span>
      </div>
    </motion.button>
  );
}

// ─── Main ExploreSheet ───────────────────────────────────────────

export function ExploreSheet({ venues, onVenueSelect, onTagSelect, activeTag, userLocation, masterExpanded }: ExploreSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>("peek");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [balance, setBalance] = useState(0);
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-snap to peek when master drawer expands
  useEffect(() => {
    if (masterExpanded && snap !== "peek") {
      setSnap("peek");
    }
  }, [masterExpanded]);

  // Animate to current snap
  useEffect(() => {
    controls.start({
      height: snapToHeight(snap),
      transition: { type: "spring", damping: 32, stiffness: 300 },
    });
  }, [snap, controls]);

  // Load user profile (auth handled by session cookie)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser?.email) return;
      try {
        const res = await fetch("/api/points");
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        setUser({
          authId: authUser.id,
          email: authUser.email,
          kickbackScore: data.balance?.kickback_score || data.balance?.total_earned || 0,
          totalEarned: data.balance?.total_earned || 0,
          tier: data.balance?.tier || "explorer",
          streak: data.balance?.current_streak || 0,
          venueProfiles: data.venueProfiles || [],
        });
        setBalance(data.balance?.balance || 0);

        // Load perks
        const allPerks: Perk[] = [];
        for (const v of venues.filter((v) => v.claimed !== false).slice(0, 10)) {
          try {
            const pRes = await fetch(`/api/points?venueId=${v.id}`);
            const pData = await pRes.json();
            if (pData.perks) allPerks.push(...pData.perks);
          } catch { /* skip */ }
        }
        setPerks(allPerks);
      } catch {
        setUser({
          authId: authUser.id,
          email: authUser.email,
          kickbackScore: 0,
          totalEarned: 0,
          tier: "explorer",
          streak: 0,
          venueProfiles: [],
        });
      }
    });
  }, [venues]);

  // ─── Tag generation (from tag-rail) ────────────────────────────

  const tags = useMemo(() => {
    const result: Tag[] = [];
    const seen = new Set<string>();

    const catGroups = new Map<string, string[]>();
    for (const v of venues) {
      const cat = v.category?.toLowerCase();
      if (!cat || cat === "venue" || cat === "other") continue;
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(v.id);
    }
    for (const [cat, ids] of catGroups) {
      if (ids.length === 0) continue;
      const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ id: `cat-${cat}`, label, type: "category", color: "#a78bfa", venueIds: ids });
    }

    const vibeGroups = new Map<string, string[]>();
    for (const v of venues) {
      if (!vibeGroups.has(v.vibe)) vibeGroups.set(v.vibe, []);
      vibeGroups.get(v.vibe)!.push(v.id);
    }
    for (const [vibe, ids] of vibeGroups) {
      const label = VIBE_LABELS[vibe] || vibe;
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ id: `vibe-${vibe}`, label, type: "vibe", color: getVibeHexColor(vibe), venueIds: ids });
    }

    const hoodGroups = new Map<string, string[]>();
    for (const v of venues) {
      const hood = v.neighborhood?.trim();
      if (!hood) continue;
      if (!hoodGroups.has(hood)) hoodGroups.set(hood, []);
      hoodGroups.get(hood)!.push(v.id);
    }
    for (const [hood, ids] of hoodGroups) {
      if (ids.length < 1 || seen.has(hood)) continue;
      seen.add(hood);
      result.push({ id: `hood-${hood}`, label: hood, type: "neighborhood", color: "#60a5fa", venueIds: ids });
    }

    for (const v of venues) {
      if (v.claimed === false) continue;
      result.push({ id: `venue-${v.id}`, label: v.name, type: "venue", color: v.themeColor || getVibeHexColor(v.vibe), venueIds: [v.id] });
    }

    return result;
  }, [venues]);

  // ─── Build shelves ─────────────────────────────────────────────

  const claimedVenues = useMemo(() => venues.filter((v) => v.claimed !== false), [venues]);

  const happeningNow = useMemo(
    () => [...claimedVenues].sort((a, b) => (VIBE_ORDER[b.vibe] || 0) - (VIBE_ORDER[a.vibe] || 0)).slice(0, 10),
    [claimedVenues]
  );

  const quietSpots = useMemo(
    () => claimedVenues.filter((v) => v.vibe === "quiet" || v.vibe === "moderate"),
    [claimedVenues]
  );

  const nearYou = useMemo(() => {
    if (!userLocation) return [];
    return [...venues]
      .map((v) => ({ venue: v, dist: getDistance(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
  }, [venues, userLocation]);

  const yourSpots = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    return user.venueProfiles
      .map((vp) => {
        const venue = venues.find((v) => v.id === vp.venue_id);
        return venue ? { venue, xp: vp.xp } : null;
      })
      .filter(Boolean) as { venue: Venue; xp: number }[];
  }, [venues, user]);

  const recommended = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    const visitedVenueIds = new Set(user.venueProfiles.map((vp) => vp.venue_id));
    const visitedCategories = new Set(
      user.venueProfiles.map((vp) => venues.find((v) => v.id === vp.venue_id)?.category).filter(Boolean)
    );
    return claimedVenues.filter((v) => !visitedVenueIds.has(v.id) && visitedCategories.has(v.category)).slice(0, 10);
  }, [claimedVenues, venues, user]);

  const affordablePerks = useMemo(
    () => perks.sort((a, b) => a.point_cost - b.point_cost),
    [perks]
  );

  const venueNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of venues) m.set(v.id, v.name);
    return m;
  }, [venues]);

  // ─── Drag handling ─────────────────────────────────────────────

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.y > 60 || velocity.y > 300) {
      // Dragging down
      if (snap === "full") setSnap("half");
      else if (snap === "half") setSnap("peek");
    } else if (offset.y < -60 || velocity.y < -300) {
      // Dragging up
      if (snap === "peek") setSnap("half");
      else if (snap === "half") setSnap("full");
    }
  }

  const tierColor = TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8";

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}
    >
      <motion.div
        animate={controls}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDrag}
        className="relative mx-2 flex flex-col overflow-hidden"
        style={{
          height: SNAP_PEEK,
          borderRadius: snap === "full" ? "24px 24px 0 0" : 20,
          background: "rgba(12, 12, 14, 0.92)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 -4px 30px rgba(0,0,0,0.3)",
          touchAction: "none",
          // Leave room for command bar above
          marginBottom: 62,
        }}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-2 pb-1">
          <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* ═══ PEEK: Profile strip ═══ */}
        <button
          onClick={() => setSnap(snap === "peek" ? "half" : "peek")}
          className="flex shrink-0 items-center gap-3 px-4 pb-2"
        >
          {/* Avatar */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`,
              border: `2px solid ${tierColor}40`,
            }}
          >
            {user ? (
              <span className="font-sans text-[16px] font-bold" style={{ color: tierColor }}>
                {user.email[0].toUpperCase()}
              </span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          {/* Tier badge */}
          {user && (
            <div className="flex flex-1 items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${tierColor}15`, color: tierColor }}
              >
                {TIER_CONFIG[user.tier]?.label || "Explorer"}
              </span>
              {/* Mini XP bar */}
              <div className="relative h-1.5 flex-1 max-w-[100px] overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%`,
                    backgroundColor: tierColor,
                    boxShadow: `0 0 6px ${tierColor}40`,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: tierColor }}>
                {user.kickbackScore.toLocaleString()}
              </span>
            </div>
          )}

          {/* Streak */}
          {user && user.streak > 0 && (
            <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
              <span className="text-[10px]">&#x1f525;</span>
              <span className="font-mono text-[10px] font-bold text-orange">{user.streak}</span>
            </div>
          )}

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <polyline points={snap === "peek" ? "6 9 12 15 18 9" : "6 15 12 9 18 15"} />
          </svg>
        </button>

        {/* ═══ HALF + FULL content (scrollable) ═══ */}
        {snap !== "peek" && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
          >
            {/* ── Profile section (expanded) ── */}
            {user && (
              <div className="px-4 pb-4">
                {/* Identity */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`,
                      border: `2px solid ${tierColor}40`,
                    }}
                  >
                    <span className="font-sans text-[20px] font-bold" style={{ color: tierColor }}>
                      {user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-sans text-[13px] font-semibold text-white/80">{user.email}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                        {TIER_CONFIG[user.tier]?.label || "Explorer"}
                      </span>
                      {user.streak > 0 && (
                        <span className="flex items-center gap-1 font-sans text-[10px] font-semibold text-orange">
                          &#x1f525; {user.streak}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* KickBack Score progress */}
                <div className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">KICKBACK SCORE</span>
                    <span className="font-mono text-[13px] font-bold" style={{ color: tierColor }}>
                      {user.kickbackScore.toLocaleString()}
                      {TIER_CONFIG[user.tier]?.next && (
                        <span className="font-normal text-white/20"> / {TIER_CONFIG[user.tier].threshold.toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${tierColor}, ${tierColor}cc)`,
                        boxShadow: `0 0 10px ${tierColor}40`,
                      }}
                    />
                  </div>
                  {TIER_CONFIG[user.tier]?.next && (
                    <p className="mt-1.5 font-sans text-[9px] text-white/20">
                      {(TIER_CONFIG[user.tier].threshold - user.kickbackScore).toLocaleString()} XP to {TIER_CONFIG[user.tier].next}
                    </p>
                  )}
                </div>

                {/* Venue badges — horizontal scroll of circles */}
                {user.venueProfiles.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">VENUES</span>
                      <span className="font-mono text-[11px] font-bold text-white/40">{user.venueProfiles.length}</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                      {user.venueProfiles.slice(0, 12).map((vp) => {
                        const milestoneColor = vp.venue_xp_milestones?.color || "#94a3b8";
                        const venueName = vp.venues?.name || "Venue";
                        return (
                          <div key={vp.venue_id} className="flex shrink-0 flex-col items-center" style={{ width: 56 }}>
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-full"
                              style={{
                                background: `linear-gradient(135deg, ${milestoneColor}20, ${milestoneColor}08)`,
                                border: `2px solid ${milestoneColor}30`,
                              }}
                            >
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: milestoneColor, boxShadow: `0 0 6px ${milestoneColor}50` }} />
                            </div>
                            <p className="mt-1 w-full truncate text-center font-sans text-[8px] font-medium text-white/40">{venueName}</p>
                            <span className="font-mono text-[8px] font-bold" style={{ color: milestoneColor }}>{vp.xp}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tag filters ── */}
            {tags.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {activeTag && (
                    <button
                      onClick={() => onTagSelect(null)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      All
                    </button>
                  )}
                  {tags.map((tag) => {
                    const isActive = activeTag?.id === tag.id;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onTagSelect(isActive ? null : tag)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                        style={{
                          backgroundColor: isActive ? `${tag.color}20` : "rgba(255,255,255,0.04)",
                          color: isActive ? tag.color : "rgba(255,255,255,0.45)",
                          border: `1px solid ${isActive ? `${tag.color}40` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {(tag.type === "venue" || tag.type === "vibe") && (
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        )}
                        {tag.label}
                        {tag.venueIds.length > 1 && <span style={{ opacity: 0.5 }}>{tag.venueIds.length}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Venue shelves ── */}

            {/* Your Spots */}
            {yourSpots.length > 0 && (
              <Shelf title="YOUR SPOTS">
                {yourSpots.map(({ venue, xp }, i) => (
                  <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => onVenueSelect(venue)} delay={Math.min(i * 0.04, 0.2)} xp={xp} />
                ))}
              </Shelf>
            )}

            {/* Recommended */}
            {recommended.length > 0 && (
              <Shelf title="RECOMMENDED" count={recommended.length}>
                {recommended.map((v, i) => (
                  <LandscapeVenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.04, 0.2)} />
                ))}
              </Shelf>
            )}

            {/* Perk Badges */}
            {affordablePerks.length > 0 && (
              <Shelf title="PERKS" count={affordablePerks.length}>
                {affordablePerks.map((perk, i) => (
                  <PerkBadge
                    key={perk.id}
                    perk={perk}
                    venueName={venueNameMap.get(perk.venue_id) || "Venue"}
                    canAfford={balance >= perk.point_cost}
                    onClick={() => {
                      const venue = venues.find((v) => v.id === perk.venue_id);
                      if (venue) onVenueSelect(venue);
                    }}
                    delay={Math.min(i * 0.04, 0.2)}
                  />
                ))}
              </Shelf>
            )}

            {/* Happening Now */}
            {happeningNow.length > 0 && (
              <Shelf title="HAPPENING NOW" count={happeningNow.length}>
                {happeningNow.map((v, i) => (
                  <LandscapeVenueCard
                    key={v.id}
                    venue={v}
                    onClick={() => onVenueSelect(v)}
                    delay={Math.min(i * 0.04, 0.2)}
                    xp={user?.venueProfiles.find((vp) => vp.venue_id === v.id)?.xp}
                  />
                ))}
              </Shelf>
            )}

            {/* Near You */}
            {nearYou.length > 0 && (
              <Shelf title="NEAR YOU">
                {nearYou.map(({ venue, dist }, i) => (
                  <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => onVenueSelect(venue)} delay={Math.min(i * 0.04, 0.2)} distance={dist} />
                ))}
              </Shelf>
            )}

            {/* Good for Focus */}
            {quietSpots.length > 0 && (
              <Shelf title="GOOD FOR FOCUS">
                {quietSpots.map((v, i) => (
                  <LandscapeVenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.04, 0.2)} />
                ))}
              </Shelf>
            )}

            {/* ── Full-only sections ── */}
            {snap === "full" && user && (
              <>
                {/* Preferences */}
                <div className="px-4">
                  <PreferencesSection />
                </div>

                {/* Sign out */}
                <div className="px-4 pb-6 pt-3">
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      window.location.reload();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[11px] font-medium text-white/25 transition hover:bg-white/[0.04] hover:text-white/40"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
