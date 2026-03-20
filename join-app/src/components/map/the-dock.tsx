"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useAnimationControls } from "framer-motion";
import {
  type Venue,
  getVibeHexColor,
  getVibeLabel,
  getOccupancyPercent,
} from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { PreferencesSection } from "./preferences-section";
import { ThreadsList, useThreadCount } from "./threads-list";
import { VibeCard, MenuCard, EventsCard, ReserveCard, ShopCard, SubscribeCard, JoinCard } from "./tab-cards";
import { PointsBadge } from "./points-badge";
import { CheckoutCard, type CheckoutCardData, type CheckoutAddOn } from "./checkout-card";

// ─── Types ───────────────────────────────────────────────────────

export interface Tag {
  id: string;
  label: string;
  type: "venue" | "category" | "vibe" | "offering" | "neighborhood";
  color: string;
  venueIds: string[];
}

type DockMode = "idle" | "explore" | "concierge" | "venueChat" | "profile";
type SnapPoint = "peek" | "half" | "full";
type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "subscribe" | "join";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
  checkout?: CheckoutCardData;
}

interface TheDockProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onVenueSelect: (venue: Venue | null) => void;
  userLocation: { latitude: number; longitude: number } | null;
  onRecenter: () => void;
  hasLocation: boolean;
  activeTag: Tag | null;
  onTagSelect: (tag: Tag | null) => void;
  onNavigateVenue: (dir: -1 | 1) => void;
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

interface ApiVenue {
  id: string;
  name: string;
  vibe: string;
  occupancy: number;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
}

interface RichVenue {
  id: string;
  name: string;
  vibe: string;
  occupancy: number;
  capacity: number;
  neighborhood?: string | null;
  type?: string | null;
  tagline?: string | null;
  themeColor?: string;
  hours?: string;
  isCard?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────

const ACCENT = "#a78bfa";

const TIER_CONFIG: Record<string, { color: string; label: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", label: "Explorer", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", label: "Regular", next: "Member", threshold: 1500 },
  member: { color: "#f97316", label: "Member", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", label: "VIP", next: "", threshold: Infinity },
};

const PERK_EMOJI: Record<string, string> = { drink: "\u2615", food: "\ud83c\udf54", access: "\ud83d\udd11", experience: "\u2728", merch: "\ud83c\udf81", other: "\ud83c\udfaf" };
const VIBE_ORDER: Record<string, number> = { lit: 4, packed: 4, busy: 3, moderate: 2, quiet: 1 };

const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171", packed: "#f87171",
};

const CATEGORY_ICONS: Record<string, string> = {
  rooftop: "M3 21h18M5 21V7l7-4 7 4v14",
  cafe: "M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2",
  bar: "M8 22h8M12 2v20M17 8H7l1-6h8l1 6z",
  lounge: "M20 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16M2 21h20M12 7v6M8 10h8",
  restaurant: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3",
  club: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  coworking: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM12 11v4M8 11v4M16 11v4",
  barbershop: "M5 3v18M5 8h7a4 4 0 000-8H5M5 16h6a4 4 0 100-8H5",
  nail_salon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2M12 8v4l3 3",
  venue: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7v3M12 14h.01",
};

const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Cafes", bar: "Bars", restaurant: "Eats", lounge: "Lounges",
  cowork: "Cowork", coworking: "Cowork", rooftop: "Rooftops", club: "Clubs",
  barbershop: "Barbershops", nail_salon: "Nail Salons",
};

const VIBE_LABELS: Record<string, string> = {
  quiet: "Chill", moderate: "Lively", busy: "Poppin", lit: "Lit", packed: "Packed",
};

const SNAP_PEEK = 100;
const SNAP_HALF = 55;
const SNAP_FULL = 92;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "shop", label: "Shop", icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2" },
  { id: "subscribe", label: "Subscribe", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { id: "join", label: "Join", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  shop: "what can I buy or order here?",
  subscribe: "how can I stay updated on what's happening here?",
  join: "tell me about this venue and how to join",
};

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

function getDockHeight(mode: DockMode, exploreSnap: SnapPoint, venueChatExpanded: boolean): string {
  switch (mode) {
    case "idle": return "56px";
    case "explore": return snapToHeight(exploreSnap);
    case "concierge": return "70dvh";
    case "venueChat": return venueChatExpanded ? "70dvh" : "56px";
    case "profile": return "70dvh";
  }
}

function getDockRadius(mode: DockMode, exploreSnap: SnapPoint, venueChatExpanded: boolean): string {
  if (mode === "idle") return "28px";
  if (mode === "venueChat" && !venueChatExpanded) return "28px";
  if (mode === "explore" && exploreSnap === "full") return "24px 24px 0 0";
  if (mode === "explore" && exploreSnap !== "full") return "20px";
  return "24px 24px 0 0";
}

function buildVenueFromApi(av: ApiVenue): Venue {
  return {
    id: av.id,
    name: av.name,
    category: "lounge",
    neighborhood: av.neighborhood || "",
    vibe: (av.vibe || "quiet") as Venue["vibe"],
    occupancy: av.occupancy,
    capacity: av.capacity,
    description: "",
    tags: [],
    hours: "",
    memberOnly: false,
    textNumber: "",
    latitude: av.latitude || 0,
    longitude: av.longitude || 0,
    claimed: true,
  };
}

function parseVenueChips(
  venues: Venue[],
  apiVenues: Record<string, ApiVenue>,
  richVenues: Record<string, RichVenue>,
  text: string,
  onTap: (venue: Venue) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\[VENUE_CARD:[^\]]+\]\]|\[\[venue:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const cardMatch = part.match(/^\[\[VENUE_CARD:([^\]]+)\]\]$/);
    if (cardMatch) {
      const venueId = cardMatch[1];
      const rv = richVenues[venueId];
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) venue = buildVenueFromApi(apiVenues[venueId]);
      if (!venue && !rv) return null;

      const name = rv?.name || venue?.name || "Venue";
      const vibe = rv?.vibe || venue?.vibe || "quiet";
      const vibeColor = rv?.themeColor || VIBE_COLORS[vibe] || "#9ca3af";
      const occ = rv?.occupancy || venue?.occupancy || 0;
      const cap = rv?.capacity || venue?.capacity || 100;
      const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      const catIcon = CATEGORY_ICONS[rv?.type || ""] || CATEGORY_ICONS.cafe;
      const vibeLabel = vibe.charAt(0).toUpperCase() + vibe.slice(1);

      return (
        <div key={i} className="my-2 w-full overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}20` }}>
          <div className="relative flex items-center justify-center" style={{ height: 80, background: `linear-gradient(135deg, ${vibeColor}18 0%, ${vibeColor}06 50%, rgba(0,0,0,0.2) 100%)` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${vibeColor}35`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: VIBE_COLORS[vibe], boxShadow: `0 0 4px ${VIBE_COLORS[vibe]}` }} />
              <span className="font-sans text-[9px] font-semibold" style={{ color: VIBE_COLORS[vibe] }}>{vibeLabel}</span>
            </div>
            <div className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <span className="font-mono text-[9px] font-semibold text-white/40">{occ}/{cap}</span>
            </div>
            <div className="absolute inset-x-3 bottom-2">
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: VIBE_COLORS[vibe] }} />
              </div>
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-[14px] font-bold text-white/90">{name}</p>
                {rv?.tagline && <p className="mt-0.5 line-clamp-1 font-sans text-[10px] italic text-white/30">&ldquo;{rv.tagline}&rdquo;</p>}
                <div className="mt-1 flex items-center gap-1.5">
                  {rv?.type && rv.type !== "venue" && (
                    <span className="rounded-md px-1.5 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{rv.type}</span>
                  )}
                  {(rv?.neighborhood || venue?.neighborhood) && <span className="font-sans text-[9px] text-white/20">{rv?.neighborhood || venue?.neighborhood}</span>}
                  {rv?.hours && <span className="font-sans text-[8px] text-white/15">{rv.hours.split(",")[0]}</span>}
                </div>
              </div>
              <button
                onClick={() => { if (venue) onTap(venue); }}
                className="ml-2 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-bold text-black active:scale-95"
                style={{ backgroundColor: vibeColor }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    const chipMatch = part.match(/^\[\[venue:([^:\]]+)(?::([^\]]*))?\]\]$/);
    if (chipMatch) {
      const venueId = chipMatch[1];
      const venueName = chipMatch[2];
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) venue = buildVenueFromApi(apiVenues[venueId]);
      const displayName = venue?.name || venueName || "View venue";
      const rv = richVenues[venueId];
      const color = rv?.themeColor || ACCENT;

      return (
        <button
          key={i}
          onClick={() => { if (venue) onTap(venue); }}
          className="mx-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[12px] font-semibold active:scale-95"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {displayName}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
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
        width: 280, height: 140, scrollSnapAlign: "start",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="relative flex w-[40%] shrink-0 items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${themeColor}25 0%, ${themeColor}08 60%, rgba(0,0,0,0.4) 100%)` }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${themeColor}50`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 4px ${vibeColor}` }} />
          <span className="font-sans text-[9px] font-semibold" style={{ color: vibeColor }}>{getVibeLabel(venue.vibe)}</span>
        </div>
      </div>
      <div className="flex w-[60%] flex-col justify-between p-3">
        {xp !== undefined && xp > 0 && (
          <div className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <span className="font-mono text-[9px] font-bold" style={{ color: themeColor }}>&#9889; {xp}</span>
          </div>
        )}
        <div>
          <p className="truncate font-sans text-[14px] font-bold text-white/90">{venue.name}</p>
          {(venue.tagline || venue.description) && (
            <p className="mt-0.5 line-clamp-1 font-sans text-[10px] leading-[1.4] text-white/35">{venue.tagline || venue.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md px-1.5 py-0.5 font-sans text-[8px] font-semibold capitalize text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{catLabel}</span>
          {venue.neighborhood && <span className="truncate font-sans text-[9px] text-white/20">{venue.neighborhood}</span>}
          {distance !== undefined && <span className="ml-auto shrink-0 font-sans text-[9px] font-medium text-white/25">{distance.toFixed(1)} mi</span>}
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
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
        style={{
          background: canAfford ? "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))" : "rgba(255,255,255,0.04)",
          border: `2px solid ${canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
          boxShadow: canAfford ? "0 0 16px rgba(249,115,22,0.15)" : "none",
        }}
      >
        <span className="text-[28px]">{emoji}</span>
      </div>
      <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueName}</p>
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

function LoadingDots() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex gap-1.5">
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
        </div>
      </div>
    </motion.div>
  );
}

function TabIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
  );
}

// ─── Desktop Detection ───────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform?.toLowerCase().includes("mac") || navigator.userAgent?.toLowerCase().includes("mac"));
  }, []);
  return isMac;
}

// ─── Keyboard shortcut badge ─────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px] font-semibold text-white/50"
      style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {children}
    </span>
  );
}

// ─── Keyboard Shortcuts Overlay ──────────────────────────────────

function KeyboardShortcutsPanel({
  isMac,
  mode,
  onClose,
}: {
  isMac: boolean;
  mode: DockMode;
  onClose: () => void;
}) {
  const mod = isMac ? "\u2318" : "Ctrl";

  const sections = [
    {
      title: "NAVIGATION",
      shortcuts: [
        { keys: ["\u2190"], label: "Previous venue" },
        { keys: ["\u2192"], label: "Next venue" },
        { keys: ["Esc"], label: "Back / collapse" },
        { keys: [mod, "K"], label: "Focus input" },
        { keys: ["Enter"], label: "Open venue chat" },
      ],
    },
    {
      title: "DOCK MODES",
      shortcuts: [
        { keys: ["E"], label: "Explore" },
        { keys: ["C"], label: "Concierge" },
        { keys: ["P"], label: "Profile" },
        { keys: [mod, "\u2191"], label: "Snap dock up" },
        { keys: [mod, "\u2193"], label: "Snap dock down" },
      ],
    },
    {
      title: "VENUE TABS",
      shortcuts: TABS.map((tab, i) => ({
        keys: [`${i + 1}`],
        label: tab.label,
      })),
    },
    {
      title: "MAP",
      shortcuts: [
        { keys: ["L"], label: "Recenter location" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: "spring", damping: 25, stiffness: 400 }}
      className="fixed right-4 top-[max(80px,calc(env(safe-area-inset-top)+80px))] z-[60] w-[280px] overflow-hidden rounded-2xl"
      style={{
        background: "rgba(12, 12, 14, 0.95)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
          </svg>
          <span className="font-sans text-[12px] font-semibold text-white/80">Keyboard Shortcuts</span>
        </div>
        <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/[0.08]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current mode indicator */}
      <div className="mx-4 mb-2 flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
        <div className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
        <span className="font-sans text-[9px] font-semibold text-[#a78bfa]">
          {mode === "idle" ? "Idle" : mode === "explore" ? "Explore" : mode === "concierge" ? "Concierge" : mode === "venueChat" ? "Venue Chat" : "Profile"}
        </span>
      </div>

      {/* Sections */}
      <div className="max-h-[50vh] overflow-y-auto px-4 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <span className="mb-1.5 block font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">
              {section.title}
            </span>
            <div className="flex flex-col gap-1">
              {section.shortcuts.map((sc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-sans text-[11px] text-white/45">{sc.label}</span>
                  <div className="flex items-center gap-0.5">
                    {sc.keys.map((k, j) => (
                      <span key={j}>
                        {j > 0 && <span className="mx-0.5 text-[9px] text-white/15">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.05] px-4 py-2">
        <span className="font-sans text-[9px] text-white/15">Press <Kbd>?</Kbd> to toggle</span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function TheDock({
  venues, selectedVenue, onVenueSelect, userLocation, onRecenter, hasLocation, activeTag, onTagSelect, onNavigateVenue,
}: TheDockProps) {
  // ── Desktop / platform detection ──
  const isDesktop = useIsDesktop();
  const isMac = useIsMac();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding toast once on desktop (after 2s delay)
  useEffect(() => {
    if (!isDesktop) return;
    try {
      if (localStorage.getItem("kb-shortcuts-seen")) return;
    } catch { return; }
    const timer = setTimeout(() => setShowOnboarding(true), 2000);
    return () => clearTimeout(timer);
  }, [isDesktop]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try { localStorage.setItem("kb-shortcuts-seen", "1"); } catch {}
  }, []);

  // ── Mode state ──
  const [mode, setMode] = useState<DockMode>("idle");
  const [previousMode, setPreviousMode] = useState<DockMode>("idle");
  const [exploreSnap, setExploreSnap] = useState<SnapPoint>("peek");
  const [venueChatExpanded, setVenueChatExpanded] = useState(false);

  // ── Chat state (persisted across mode switches) ──
  const [conciergeMessages, setConciergeMessages] = useState<Message[]>([
    { id: "welcome", sender: "ai", body: "Hey. I'm KickBack. Ask me anything \u2014 what's happening tonight, where to go, or vibe check a spot.", timestamp: Date.now() },
  ]);
  const [venueThreads, setVenueThreads] = useState<Map<string, Message[]>>(new Map());
  const [hasSentTabCommands, setHasSentTabCommands] = useState<Map<string, Set<Tab>>>(new Map());

  // ── Input / loading ──
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Venue chat state ──
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // ── User / profile state ──
  const [user, setUser] = useState<UserProfile | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [balance, setBalance] = useState(0);

  // ── Concierge venue data ──
  const [apiVenues, setApiVenues] = useState<Record<string, ApiVenue>>({});
  const [richVenues, setRichVenues] = useState<Record<string, RichVenue>>({});

  // ── Refs ──
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleTabTapRef = useRef<(tab: Tab) => void>(() => {});
  const conciergeHistoryLoaded = useRef(false);
  const threadInfo = useThreadCount();

  // ── Current venue messages ──
  const currentVenueMessages = selectedVenue ? (venueThreads.get(selectedVenue.id) || []) : [];

  // ── Animate height/radius on mode + snap changes ──
  useEffect(() => {
    controls.start({
      height: getDockHeight(mode, exploreSnap, venueChatExpanded),
      borderRadius: getDockRadius(mode, exploreSnap, venueChatExpanded),
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [mode, exploreSnap, venueChatExpanded, controls]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conciergeMessages, venueThreads, selectedVenue]);

  // ── Keyboard resize handler ──
  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // ── Keyboard shortcuts (desktop only) ──
  useEffect(() => {
    if (!isDesktop) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // ── Always-active shortcuts ──

      // ? — toggle shortcuts panel
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+K — focus input
      if (e.key === "k" && mod) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Escape — back / collapse / close shortcuts
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (inInput) { (target as HTMLInputElement).blur(); return; }
        e.preventDefault();
        if (mode === "profile") { setMode(previousMode); return; }
        if (mode === "concierge") { setMode("idle"); return; }
        if (mode === "venueChat") {
          if (venueChatExpanded) { setVenueChatExpanded(false); return; }
          onVenueSelect(null); return;
        }
        if (mode === "explore") {
          if (exploreSnap === "full") { setExploreSnap("half"); return; }
          if (exploreSnap === "half") { setExploreSnap("peek"); return; }
          setMode("idle"); return;
        }
        return;
      }

      // Cmd/Ctrl+ArrowUp — snap dock up
      if (e.key === "ArrowUp" && mod) {
        e.preventDefault();
        if (mode === "idle") { setMode("explore"); setExploreSnap("half"); }
        else if (mode === "explore") {
          if (exploreSnap === "peek") setExploreSnap("half");
          else if (exploreSnap === "half") setExploreSnap("full");
        }
        else if (mode === "venueChat" && !venueChatExpanded) setVenueChatExpanded(true);
        return;
      }

      // Cmd/Ctrl+ArrowDown — snap dock down
      if (e.key === "ArrowDown" && mod) {
        e.preventDefault();
        if (mode === "explore") {
          if (exploreSnap === "full") setExploreSnap("half");
          else if (exploreSnap === "half") setExploreSnap("peek");
          else setMode("idle");
        }
        else if (mode === "concierge") setMode("idle");
        else if (mode === "venueChat" && venueChatExpanded) setVenueChatExpanded(false);
        return;
      }

      // ── Skip single-key shortcuts when typing ──
      if (inInput) return;

      // Arrow left/right — navigate venues
      if (e.key === "ArrowLeft") { e.preventDefault(); onNavigateVenue(-1); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNavigateVenue(1); return; }

      // Enter — open venue chat if venue selected
      if (e.key === "Enter" && selectedVenue && mode !== "venueChat") {
        e.preventDefault();
        setMode("venueChat");
        setVenueChatExpanded(true);
        return;
      }

      // E — toggle explore
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (mode === "explore") { setMode("idle"); }
        else { setMode("explore"); setExploreSnap("half"); }
        return;
      }

      // C — concierge
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (mode === "concierge") setMode("idle");
        else setMode("concierge");
        return;
      }

      // P — profile
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (mode === "profile") { setMode(previousMode); }
        else { setPreviousMode(mode); setMode("profile"); }
        return;
      }

      // L — recenter location
      if ((e.key === "l" || e.key === "L") && hasLocation) {
        e.preventDefault();
        onRecenter();
        return;
      }

      // 1-8 — venue tabs (only in venueChat)
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8 && mode === "venueChat" && selectedVenue) {
        const tab = TABS[num - 1];
        if (tab) {
          e.preventDefault();
          handleTabTapRef.current(tab.id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, mode, previousMode, exploreSnap, venueChatExpanded, selectedVenue, hasLocation, showShortcuts, onNavigateVenue, onRecenter, onVenueSelect]);

  // ── Load thread history from API ──
  const loadThreadHistory = useCallback(async (venueId: string | null) => {
    try {
      const url = venueId ? `/api/threads?venueId=${venueId}` : "/api/threads?master=true";
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.messages?.length) return null;

      return data.messages.map((m: { id: string; sender_type: string; body: string; created_at: string }) => ({
        id: m.id,
        sender: m.sender_type as "guest" | "ai",
        body: m.body,
        timestamp: new Date(m.created_at).getTime(),
      })) as Message[];
    } catch {
      return null;
    }
  }, []);

  // ── Load concierge history on first open ──
  useEffect(() => {
    if (mode !== "concierge") return;
    if (conciergeHistoryLoaded.current) return;
    conciergeHistoryLoaded.current = true;

    // Only load if we still have the default welcome message
    if (conciergeMessages.length > 1) return;

    loadThreadHistory(null).then((messages) => {
      if (messages && messages.length > 0) {
        setConciergeMessages(messages);
      }
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync selectedVenue prop → mode ──
  useEffect(() => {
    if (selectedVenue) {
      setMode("venueChat");
      setVenueChatExpanded(false);
      setActiveTab("chat");

      // If we already have cached messages, keep them
      if (venueThreads.has(selectedVenue.id)) return;

      // Set a welcome message immediately, then try to load history
      const isGhost = selectedVenue.claimed === false;
      const welcomeBody = isGhost
        ? `Hey — I know a bit about ${selectedVenue.name} from public info. ${selectedVenue.category ? `It's a ${selectedVenue.category}` : ""}${selectedVenue.neighborhood ? ` in ${selectedVenue.neighborhood}` : ""}. Ask me what you want to know.`
        : `Welcome to ${selectedVenue.name}. ${getVibeLabel(selectedVenue.vibe)} right now, ${selectedVenue.occupancy} people. Ask me anything.`;
      const welcomeMsg: Message = {
        id: `welcome-${selectedVenue.id}`,
        sender: "ai",
        body: welcomeBody,
        timestamp: Date.now(),
      };
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [welcomeMsg]);
        return next;
      });

      // Fetch persisted history and replace welcome message if found
      const vid = selectedVenue.id;
      loadThreadHistory(vid).then((messages) => {
        if (messages && messages.length > 0) {
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(vid, messages);
            return next;
          });
        }
      });
    } else {
      if (mode === "venueChat") {
        setMode("explore");
        setExploreSnap("half");
      }
    }
  }, [selectedVenue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load user profile ──
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
          kickbackScore: 0, totalEarned: 0, tier: "explorer", streak: 0, venueProfiles: [],
        });
      }
    });
  }, [venues]);

  // ─── Tag generation ────────────────────────────────────────────

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

  // ─── Shelf memos ───────────────────────────────────────────────

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

  // ─── Send message ──────────────────────────────────────────────

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() };

    if (mode === "venueChat" && selectedVenue) {
      // Venue chat
      if (!venueChatExpanded) setVenueChatExpanded(true);

      if (msg.toLowerCase() === "sign out" || msg.toLowerCase() === "signout") {
        const supabase = createClient();
        await supabase.auth.signOut();
        setVenueThreads((prev) => {
          const next = new Map(prev);
          const thread = [...(next.get(selectedVenue.id) || []), userMsg, { id: `signout-${Date.now()}`, sender: "ai" as const, body: "You've been signed out.", timestamp: Date.now() }];
          next.set(selectedVenue.id, thread);
          return next;
        });
        setInput("");
        return;
      }

      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), userMsg]);
        return next;
      });
      setInput("");
      setLoading(true);

      try {
        const isGhost = selectedVenue.claimed === false;
        const chatUrl = isGhost ? "/api/chat/ghost" : "/api/chat";
        const chatBody = isGhost
          ? { message: msg, venueId: selectedVenue.id, venueName: selectedVenue.name, category: selectedVenue.category, neighborhood: selectedVenue.neighborhood, description: selectedVenue.description, tags: selectedVenue.tags }
          : { message: msg, venueId: selectedVenue.id, venueName: selectedVenue.name, vibe: selectedVenue.vibe, occupancy: selectedVenue.occupancy };

        const res = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatBody),
        });
        const data = await res.json();
        const cardTab = data.card || (activeTab !== "chat" ? activeTab : undefined);
        const aiMsg: Message = {
          id: `ai-${Date.now()}`, sender: "ai",
          body: data.reply || "Couldn't reach the venue right now. Try again.",
          timestamp: Date.now(), tab: cardTab as Tab | undefined,
        };
        if (data.checkout) {
          aiMsg.checkout = { ...data.checkout, venue_name: selectedVenue.name, venue_id: selectedVenue.id };
        }
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), aiMsg]);
          return next;
        });
      } catch {
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() }]);
          return next;
        });
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    } else {
      // Concierge chat
      if (mode !== "concierge") setMode("concierge");

      setConciergeMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat/general", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        });
        const data = await res.json();

        if (data.venues?.length) {
          setApiVenues((prev) => {
            const next = { ...prev };
            for (const v of data.venues) next[v.id] = v;
            return next;
          });
          setRichVenues((prev) => {
            const next = { ...prev };
            for (const v of data.venues) next[v.id] = v;
            return next;
          });
        }

        setConciergeMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, sender: "ai", body: data.reply || "Something went wrong. Try again in a moment.", timestamp: Date.now() },
        ]);
      } catch {
        setConciergeMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
  }, [input, loading, mode, selectedVenue, venueChatExpanded, activeTab]);

  // ─── Tab tap ───────────────────────────────────────────────────

  const handleTabTap = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (!selectedVenue) return;

    const cmd = TAB_COMMANDS[tab];
    if (!cmd) return;

    const venueId = selectedVenue.id;
    const sentForVenue = hasSentTabCommands.get(venueId) || new Set<Tab>();
    if (sentForVenue.has(tab)) return;

    setHasSentTabCommands((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(venueId) || []);
      s.add(tab);
      next.set(venueId, s);
      return next;
    });
    send(cmd);
  }, [selectedVenue, hasSentTabCommands, send]);

  // Keep ref in sync
  handleTabTapRef.current = handleTabTap;

  // ─── Drag handling ─────────────────────────────────────────────

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info;
    const draggingDown = offset.y > 60 || velocity.y > 300;
    const draggingUp = offset.y < -60 || velocity.y < -300;

    if (mode === "idle") {
      if (draggingUp) { setMode("explore"); setExploreSnap("half"); }
    } else if (mode === "explore") {
      if (draggingDown) {
        if (exploreSnap === "full") setExploreSnap("half");
        else if (exploreSnap === "half") setExploreSnap("peek");
        else setMode("idle");
      } else if (draggingUp) {
        if (exploreSnap === "peek") setExploreSnap("half");
        else if (exploreSnap === "half") setExploreSnap("full");
      }
    } else if (mode === "concierge") {
      if (draggingDown) setMode("idle");
    } else if (mode === "venueChat") {
      if (draggingDown) {
        if (venueChatExpanded) setVenueChatExpanded(false);
        // Don't dismiss on drag from collapsed — keep venue selected
      } else if (draggingUp) {
        if (!venueChatExpanded) setVenueChatExpanded(true);
      }
    } else if (mode === "profile") {
      if (draggingDown) setMode(previousMode);
    }
  }

  // ─── Input focus handler ───────────────────────────────────────

  const handleInputFocus = useCallback(() => {
    if (mode === "idle" || mode === "explore") {
      if (selectedVenue) {
        setMode("venueChat");
        setVenueChatExpanded(true);
      } else {
        setMode("concierge");
      }
    } else if (mode === "venueChat" && !venueChatExpanded) {
      setVenueChatExpanded(true);
    }
  }, [mode, selectedVenue, venueChatExpanded]);

  // ─── Concierge venue card tap ──────────────────────────────────

  const handleConciergeVenueTap = useCallback((venue: Venue) => {
    onVenueSelect(venue);
  }, [onVenueSelect]);

  // ─── Explore venue card tap ────────────────────────────────────

  const handleExploreVenueTap = useCallback((venue: Venue) => {
    onVenueSelect(venue);
  }, [onVenueSelect]);

  // ─── KB back (venueChat → explore) ─────────────────────────────

  const handleKBBack = useCallback(() => {
    onVenueSelect(null);
  }, [onVenueSelect]);

  // ─── Profile ───────────────────────────────────────────────────

  const handleAvatarTap = useCallback(() => {
    setPreviousMode(mode);
    setMode("profile");
  }, [mode]);

  const handleProfileBack = useCallback(() => {
    setMode(previousMode);
  }, [previousMode]);

  // ─── Computed ──────────────────────────────────────────────────

  const tierColor = TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8";
  const vibeColor = selectedVenue ? getVibeHexColor(selectedVenue.vibe) : ACCENT;
  const sendColor = mode === "venueChat" ? vibeColor : ACCENT;
  const showExpandedContent = mode === "explore" || mode === "concierge" || mode === "profile" || (mode === "venueChat" && venueChatExpanded);
  const isCollapsedPill = mode === "idle" || (mode === "venueChat" && !venueChatExpanded);

  // ─── Checkout handler for venue chat ──
  const handleCheckoutConfirm = useCallback(async (msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number) => {
    if (!selectedVenue || !msg.checkout) return;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: selectedVenue.id,
          items: msg.checkout.items,
          addOns,
          pointsToSpend,
          notes: msg.checkout.notes,
        }),
      });
      const result = await res.json();
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed. ${pointsToSpend > 0 ? `Used ${pointsToSpend} points. ` : ""}Show this to the host when you arrive.`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), confirmMsg]);
        return next;
      });
    } catch {
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Couldn't process the order. Try again.", timestamp: Date.now() }]);
        return next;
      });
    }
  }, [selectedVenue]);

  const handleCheckoutDismiss = useCallback(() => {
    if (!selectedVenue) return;
    setVenueThreads((prev) => {
      const next = new Map(prev);
      next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `cancel-${Date.now()}`, sender: "ai", body: "No worries — let me know if you change your mind.", timestamp: Date.now() }]);
      return next;
    });
  }, [selectedVenue]);

  // ═══════════════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════

  return (
    <>
    {/* ─── Desktop Keyboard Shortcuts Button + Panel ─── */}
    {isDesktop && (
      <>
        {/* ? toggle button — fixed top-right */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => setShowShortcuts((prev) => !prev)}
          className="fixed right-4 top-[max(16px,env(safe-area-inset-top))] z-[60] flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.08]"
          style={{
            backgroundColor: showShortcuts ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${showShortcuts ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
          title="Keyboard shortcuts (?)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showShortcuts ? "#a78bfa" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
          </svg>
        </motion.button>

        {/* Onboarding toast — shows once for new desktop users */}
        <AnimatePresence>
          {showOnboarding && !showShortcuts && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-4 top-[max(52px,calc(env(safe-area-inset-top)+52px))] z-[60] flex items-start gap-3 rounded-xl px-4 py-3"
              style={{
                background: "rgba(12, 12, 14, 0.95)",
                backdropFilter: "blur(40px) saturate(1.8)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 8px 30px rgba(0,0,0,0.4)",
                maxWidth: 320,
              }}
            >
              {/* Keyboard icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(167,139,250,0.1)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
                </svg>
              </div>

              <div className="flex-1">
                <p className="font-sans text-[13px] font-semibold text-white/90">Keyboard shortcuts available</p>
                <p className="mt-0.5 font-sans text-[11px] leading-[1.4] text-white/40">
                  Press <Kbd>?</Kbd> anytime to see all shortcuts. Try <Kbd>{isMac ? "\u2318" : "Ctrl"}</Kbd><span className="mx-0.5 text-[9px] text-white/15">+</span><Kbd>K</Kbd> to search, <Kbd>E</Kbd> to explore, or <Kbd>\u2190</Kbd> <Kbd>\u2192</Kbd> to browse venues.
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => { dismissOnboarding(); setShowShortcuts(true); }}
                    className="rounded-full px-3 py-1 font-sans text-[11px] font-semibold text-black active:scale-95"
                    style={{ backgroundColor: "#a78bfa" }}
                  >
                    View all shortcuts
                  </button>
                  <button
                    onClick={dismissOnboarding}
                    className="rounded-full px-3 py-1 font-sans text-[11px] font-medium text-white/40 active:scale-95"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Got it
                  </button>
                </div>
              </div>

              {/* Close X */}
              <button onClick={dismissOnboarding} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-white/[0.08]">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-30">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shortcuts overlay */}
        <AnimatePresence>
          {showShortcuts && (
            <KeyboardShortcutsPanel isMac={isMac} mode={mode} onClose={() => setShowShortcuts(false)} />
          )}
        </AnimatePresence>
      </>
    )}

    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
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
        className="relative mx-3 flex flex-col overflow-hidden"
        style={{
          height: 56,
          borderRadius: 28,
          background: "rgba(12, 12, 14, 0.92)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 -4px 30px rgba(0,0,0,0.3)",
          touchAction: "none",
        }}
      >
        {/* ═══ IDLE MODE ═══ */}
        {mode === "idle" && (
          <div className="flex h-full items-center gap-1.5 px-2">
            {/* Avatar */}
            <button
              onClick={handleAvatarTap}
              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`,
                border: `2px solid ${tierColor}40`,
              }}
            >
              {user ? (
                <span className="font-sans text-[14px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              )}
              {isDesktop && <span className="absolute -bottom-1 -right-1 hidden h-4 min-w-[16px] items-center justify-center rounded bg-white/[0.08] px-0.5 font-mono text-[8px] font-bold text-white/40 group-hover:flex" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>P</span>}
            </button>

            {/* Center: pulsing dot + input */}
            <button
              onClick={() => { setMode("explore"); setExploreSnap("half"); }}
              className="group relative flex items-center gap-1.5 pl-1"
            >
              <motion.div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCENT }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              {isDesktop && <span className="absolute -bottom-1 -right-2 hidden h-4 min-w-[16px] items-center justify-center rounded bg-white/[0.08] px-0.5 font-mono text-[8px] font-bold text-white/40 group-hover:flex" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>E</span>}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              onFocus={handleInputFocus}
              placeholder={isDesktop ? `Explore or ask anything...  ${isMac ? "\u2318" : "Ctrl+"}K` : "Explore or ask anything..."}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
            />

            {/* Streak */}
            {user && user.streak > 0 && (
              <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
                <span className="text-[10px]">&#x1f525;</span>
                <span className="font-mono text-[10px] font-bold text-orange">{user.streak}</span>
              </div>
            )}

            {/* Thread count */}
            {threadInfo.count > 0 && (
              <div className="relative flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(167,139,250,0.08)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="font-mono text-[10px] font-bold text-[#a78bfa]">{threadInfo.count}</span>
                {threadInfo.unread > 0 && <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange" />}
              </div>
            )}

            {/* Location */}
            {hasLocation && (
              <button
                onClick={(e) => { e.stopPropagation(); onRecenter(); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ═══ VENUE CHAT COLLAPSED ═══ */}
        {mode === "venueChat" && !venueChatExpanded && selectedVenue && (
          <div className="flex h-full items-center gap-2 px-3">
            <button onClick={() => setVenueChatExpanded(true)} className="flex items-center gap-2 pl-1">
              <motion.div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: vibeColor }}
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">{selectedVenue.name}</span>
            </button>

            <PointsBadge venueId={selectedVenue.id} vibeColor={vibeColor} expanded={false} />

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              onFocus={handleInputFocus}
              placeholder="Ask anything..."
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
            />

            <motion.button
              onClick={handleKBBack}
              whileTap={{ scale: 0.9 }}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5"
              style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="font-sans text-[10px] font-bold text-[#a78bfa]">KB</span>
            </motion.button>
          </div>
        )}

        {/* ═══ EXPLORE MODE ═══ */}
        {mode === "explore" && (
          <>
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-2 pb-1">
              <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Profile strip (peek row) */}
            <button
              onClick={() => {
                if (exploreSnap === "peek") setExploreSnap("half");
                else if (exploreSnap === "half") setExploreSnap("peek");
                else setExploreSnap("half");
              }}
              className="flex shrink-0 items-center gap-3 px-4 pb-2"
            >
              {/* Avatar */}
              <button
                onClick={(e) => { e.stopPropagation(); handleAvatarTap(); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`,
                  border: `2px solid ${tierColor}40`,
                }}
              >
                {user ? (
                  <span className="font-sans text-[16px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </button>

              {/* Tier badge + XP bar */}
              {user && (
                <div className="flex flex-1 items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                    {TIER_CONFIG[user.tier]?.label || "Explorer"}
                  </span>
                  <div className="relative h-1.5 max-w-[100px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%`, backgroundColor: tierColor, boxShadow: `0 0 6px ${tierColor}40` }} />
                  </div>
                  <span className="font-mono text-[10px] font-bold" style={{ color: tierColor }}>{user.kickbackScore.toLocaleString()}</span>
                </div>
              )}

              {/* Streak */}
              {user && user.streak > 0 && (
                <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
                  <span className="text-[10px]">&#x1f525;</span>
                  <span className="font-mono text-[10px] font-bold text-orange">{user.streak}</span>
                </div>
              )}

              {/* Thread count */}
              {threadInfo.count > 0 && (
                <div className="relative flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(167,139,250,0.08)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-mono text-[10px] font-bold text-[#a78bfa]">{threadInfo.count}</span>
                  {threadInfo.unread > 0 && <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange" />}
                </div>
              )}

              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <polyline points={exploreSnap === "peek" ? "6 9 12 15 18 9" : "6 15 12 9 18 15"} />
              </svg>
            </button>

            {/* Scrollable content (half + full) */}
            {exploreSnap !== "peek" && (
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
              >
                {/* Tag filters */}
                {tags.length > 0 && (
                  <div className="mb-4">
                    <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                      {activeTag && (
                        <button
                          onClick={() => onTagSelect(null)}
                          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
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
                            {(tag.type === "venue" || tag.type === "vibe") && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />}
                            {tag.label}
                            {tag.venueIds.length > 1 && <span style={{ opacity: 0.5 }}>{tag.venueIds.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Venue shelves */}
                {yourSpots.length > 0 && (
                  <Shelf title="YOUR SPOTS">
                    {yourSpots.map(({ venue, xp }, i) => (
                      <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => handleExploreVenueTap(venue)} delay={Math.min(i * 0.04, 0.2)} xp={xp} />
                    ))}
                  </Shelf>
                )}

                {recommended.length > 0 && (
                  <Shelf title="RECOMMENDED" count={recommended.length}>
                    {recommended.map((v, i) => (
                      <LandscapeVenueCard key={v.id} venue={v} onClick={() => handleExploreVenueTap(v)} delay={Math.min(i * 0.04, 0.2)} />
                    ))}
                  </Shelf>
                )}

                {affordablePerks.length > 0 && (
                  <Shelf title="PERKS" count={affordablePerks.length}>
                    {affordablePerks.map((perk, i) => (
                      <PerkBadge
                        key={perk.id}
                        perk={perk}
                        venueName={venueNameMap.get(perk.venue_id) || "Venue"}
                        canAfford={balance >= perk.point_cost}
                        onClick={() => { const v = venues.find((v) => v.id === perk.venue_id); if (v) handleExploreVenueTap(v); }}
                        delay={Math.min(i * 0.04, 0.2)}
                      />
                    ))}
                  </Shelf>
                )}

                {happeningNow.length > 0 && (
                  <Shelf title="HAPPENING NOW" count={happeningNow.length}>
                    {happeningNow.map((v, i) => (
                      <LandscapeVenueCard
                        key={v.id} venue={v} onClick={() => handleExploreVenueTap(v)}
                        delay={Math.min(i * 0.04, 0.2)}
                        xp={user?.venueProfiles.find((vp) => vp.venue_id === v.id)?.xp}
                      />
                    ))}
                  </Shelf>
                )}

                {nearYou.length > 0 && (
                  <Shelf title="NEAR YOU">
                    {nearYou.map(({ venue, dist }, i) => (
                      <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => handleExploreVenueTap(venue)} delay={Math.min(i * 0.04, 0.2)} distance={dist} />
                    ))}
                  </Shelf>
                )}

                {quietSpots.length > 0 && (
                  <Shelf title="GOOD FOR FOCUS">
                    {quietSpots.map((v, i) => (
                      <LandscapeVenueCard key={v.id} venue={v} onClick={() => handleExploreVenueTap(v)} delay={Math.min(i * 0.04, 0.2)} />
                    ))}
                  </Shelf>
                )}

                {/* Full-only sections */}
                {exploreSnap === "full" && user && (
                  <>
                    <div className="mb-3">
                      <div className="flex items-center justify-between px-4 pb-2">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">CONVERSATIONS</span>
                      </div>
                      <ThreadsList
                        onThreadSelect={(venueId) => {
                          if (venueId) {
                            // Venue thread — open venue chat with history
                            const venue = venues.find((v) => v.id === venueId);
                            if (venue) handleExploreVenueTap(venue);
                          } else {
                            // Master/concierge thread — load history and switch to concierge
                            loadThreadHistory(null).then((messages) => {
                              if (messages && messages.length > 0) {
                                setConciergeMessages(messages);
                              }
                            });
                            setMode("concierge");
                          }
                        }}
                      />
                    </div>

                    <div className="px-4">
                      <PreferencesSection />
                    </div>

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

            {/* Input bar at bottom of explore */}
            {exploreSnap !== "peek" && (
              <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  onFocus={handleInputFocus}
                  placeholder="Ask KickBack anything..."
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                {input.trim() && (
                  <motion.button
                    onClick={() => send()}
                    disabled={loading}
                    whileTap={{ scale: 0.9 }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                    style={{ backgroundColor: ACCENT, boxShadow: `0 2px 10px ${ACCENT}40` }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                  </motion.button>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ CONCIERGE MODE ═══ */}
        {mode === "concierge" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <span className="font-sans text-[15px] font-semibold text-white/90">KickBack</span>
                <span className="font-sans text-[11px] text-white/30">Concierge</span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasLocation && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRecenter(); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </button>
                )}
                <motion.button
                  onClick={() => setMode("idle")}
                  whileTap={{ scale: 0.85 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Quick suggestions */}
            {conciergeMessages.length <= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto px-4 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                {["What's open right now?", "Somewhere quiet to work", "Best spot for a date", "Where's the party?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="shrink-0 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                    style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {q}
                  </button>
                ))}
              </motion.div>
            )}

            <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex flex-col gap-2.5">
                {conciergeMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.sender === "guest" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                      style={msg.sender === "guest"
                        ? { backgroundColor: ACCENT, color: "#000", boxShadow: `0 2px 12px ${ACCENT}33` }
                        : { backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }
                      }
                    >
                      <p className="font-sans text-[14px] leading-[1.5]">
                        {msg.sender === "ai"
                          ? parseVenueChips(venues, apiVenues, richVenues, msg.body, handleConciergeVenueTap)
                          : msg.body}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {loading && <LoadingDots />}
              </div>
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask anything..."
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <motion.button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{ backgroundColor: ACCENT, boxShadow: `0 2px 10px ${ACCENT}40` }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          </>
        )}

        {/* ═══ VENUE CHAT EXPANDED ═══ */}
        {mode === "venueChat" && venueChatExpanded && selectedVenue && (
          <>
            {/* Header */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: vibeColor }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{selectedVenue.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.button
                    onClick={handleKBBack}
                    whileTap={{ scale: 0.9 }}
                    className="flex h-7 items-center gap-1.5 rounded-full px-2.5"
                    style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="font-sans text-[10px] font-bold text-[#a78bfa]">KB</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setVenueChatExpanded(false)}
                    whileTap={{ scale: 0.85 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </motion.button>
                </div>
              </div>

              {/* Stats strip */}
              <div className="mt-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: `${vibeColor}15`, border: `1px solid ${vibeColor}20` }}>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor }} />
                  <span className="font-sans text-[9px] font-semibold" style={{ color: vibeColor }}>{getVibeLabel(selectedVenue.vibe)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  </svg>
                  <span className="font-mono text-[9px] font-semibold text-white/40">{selectedVenue.occupancy}/{selectedVenue.capacity}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${getOccupancyPercent(selectedVenue)}%`, backgroundColor: vibeColor }} />
                  </div>
                  <span className="font-mono text-[8px] text-white/20">{getOccupancyPercent(selectedVenue)}%</span>
                </div>
                {selectedVenue.category && selectedVenue.category !== "venue" && (
                  <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>{selectedVenue.category}</span>
                )}
                {selectedVenue.neighborhood && <span className="shrink-0 font-sans text-[9px] text-white/20">{selectedVenue.neighborhood}</span>}
                {selectedVenue.hours && (
                  <div className="flex shrink-0 items-center gap-1">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="font-sans text-[8px] text-white/15">{selectedVenue.hours.split(",")[0]}</span>
                  </div>
                )}
              </div>

              {selectedVenue.tagline && (
                <p className="mt-1 line-clamp-1 font-sans text-[10px] italic text-white/25">&ldquo;{selectedVenue.tagline}&rdquo;</p>
              )}
            </div>

            {/* Tab row */}
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex w-full gap-1 px-3 pb-2 no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch", overflowX: "scroll", overflowY: "hidden", scrollSnapType: "x mandatory" }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabTap(tab.id)}
                    whileTap={{ scale: 0.92 }}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-sans text-[11px] font-medium transition-colors"
                    style={{
                      backgroundColor: isActive ? `${vibeColor}20` : "rgba(255,255,255,0.04)",
                      color: isActive ? vibeColor : "rgba(255,255,255,0.35)",
                      border: `1px solid ${isActive ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                      scrollSnapAlign: "start",
                    }}
                  >
                    <TabIcon path={tab.icon} size={12} />
                    {tab.label}
                    {isDesktop && <span className="ml-0.5 font-mono text-[8px] opacity-30">{TABS.indexOf(tab) + 1}</span>}
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Points */}
            <PointsBadge venueId={selectedVenue.id} vibeColor={vibeColor} expanded={true} />

            <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex flex-col gap-2.5">
                {currentVenueMessages.map((msg) => {
                  if (msg.sender === "guest") {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5" style={{ backgroundColor: vibeColor, color: "#000", boxShadow: `0 2px 12px ${vibeColor}33` }}>
                          <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                        </div>
                      </motion.div>
                    );
                  }

                  if (msg.tab && msg.tab !== "chat") {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        {msg.tab === "vibe" && <VibeCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "menu" && <MenuCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "events" && <EventsCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "reserve" && <ReserveCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "shop" && <ShopCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "subscribe" && <SubscribeCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                        {msg.tab === "join" && <JoinCard body="" venue={selectedVenue} vibeColor={vibeColor} />}
                      </motion.div>
                    );
                  }

                  if (msg.checkout) {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                        {msg.body && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                              <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                            </div>
                          </div>
                        )}
                        <CheckoutCard
                          data={msg.checkout}
                          vibeColor={vibeColor}
                          onConfirm={(addOns: CheckoutAddOn[], pointsToSpend: number) => handleCheckoutConfirm(msg, addOns, pointsToSpend)}
                          onDismiss={handleCheckoutDismiss}
                        />
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                      </div>
                    </motion.div>
                  );
                })}
                {loading && <LoadingDots />}
              </div>
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask anything..."
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <motion.button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{ backgroundColor: vibeColor, boxShadow: `0 2px 10px ${vibeColor}40` }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          </>
        )}

        {/* ═══ VENUE CHAT — UNCLAIMED (Ghost Agent) ═══ */}
        {mode === "venueChat" && selectedVenue && selectedVenue.claimed === false && venueChatExpanded && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#6b7280" }} />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{selectedVenue.name}</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-sans text-[8px] font-semibold tracking-wider text-white/20">PUBLIC DATA</span>
                </div>
                <motion.button onClick={handleKBBack} whileTap={{ scale: 0.85 }} className="flex h-7 items-center gap-1.5 rounded-full px-2.5" style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  <span className="font-sans text-[10px] font-bold text-[#a78bfa]">KB</span>
                </motion.button>
              </div>
              {/* Info row */}
              <div className="mt-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {selectedVenue.category && selectedVenue.category !== "venue" && (
                  <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 font-sans text-[9px] capitalize text-white/25" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>{selectedVenue.category}</span>
                )}
                {selectedVenue.neighborhood && <span className="shrink-0 font-sans text-[9px] text-white/20">{selectedVenue.neighborhood}</span>}
                {selectedVenue.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="shrink-0 font-sans text-[8px] text-white/15">{tag}</span>
                ))}
              </div>
            </div>

            <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
              <div className="flex flex-col gap-2.5">
                {currentVenueMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.sender === "guest" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                      style={msg.sender === "guest"
                        ? { backgroundColor: "#6b7280", color: "#fff" }
                        : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.04)" }
                      }
                    >
                      <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="flex gap-1.5">
                        <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                        <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                        <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Claim CTA — compact, below messages */}
            <div className="mx-4 mb-2 rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.1)" }}>
              <div className="flex items-center justify-between">
                <span className="font-sans text-[10px] text-white/25">This venue hasn&apos;t claimed their page yet</span>
                <a href="https://dash.thekickback.net" target="_blank" rel="noopener noreferrer" className="rounded-full px-2.5 py-1 font-sans text-[9px] font-bold text-black" style={{ backgroundColor: "#F97316" }}>
                  Claim
                </a>
              </div>
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about this place..."
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
              />
              <motion.button onClick={() => send()} disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30" style={{ backgroundColor: "#6b7280" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          </div>
        )}

        {/* ═══ PROFILE MODE ═══ */}
        {mode === "profile" && (
          <>
            {/* Header with back arrow */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <motion.button
                onClick={handleProfileBack}
                whileTap={{ scale: 0.85 }}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </motion.button>
              <span className="font-sans text-[15px] font-semibold text-white/90">Profile</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
              {user && (
                <div className="px-4 pb-4">
                  {/* Identity */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`, border: `2px solid ${tierColor}40` }}>
                      <span className="font-sans text-[20px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-sans text-[13px] font-semibold text-white/80">{user.email}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                          {TIER_CONFIG[user.tier]?.label || "Explorer"}
                        </span>
                        {user.streak > 0 && (
                          <span className="flex items-center gap-1 font-sans text-[10px] font-semibold text-orange">&#x1f525; {user.streak}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KickBack Score */}
                  <div className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">KICKBACK SCORE</span>
                      <span className="font-mono text-[13px] font-bold" style={{ color: tierColor }}>
                        {user.kickbackScore.toLocaleString()}
                        {TIER_CONFIG[user.tier]?.next && <span className="font-normal text-white/20"> / {TIER_CONFIG[user.tier].threshold.toLocaleString()}</span>}
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${tierColor}, ${tierColor}cc)`, boxShadow: `0 0 10px ${tierColor}40` }}
                      />
                    </div>
                    {TIER_CONFIG[user.tier]?.next && (
                      <p className="mt-1.5 font-sans text-[9px] text-white/20">{(TIER_CONFIG[user.tier].threshold - user.kickbackScore).toLocaleString()} XP to {TIER_CONFIG[user.tier].next}</p>
                    )}
                  </div>

                  {/* Venue badges */}
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
                              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${milestoneColor}20, ${milestoneColor}08)`, border: `2px solid ${milestoneColor}30` }}>
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
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
    </>
  );
}
