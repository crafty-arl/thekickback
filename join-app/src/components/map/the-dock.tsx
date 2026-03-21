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
import { VenueProfileCards } from "./venue-profile-cards";
import { VenueContact } from "./venue-contact";
import { type CheckoutCardData, type CheckoutAddOn } from "./checkout-card";
import { WalletSheet, useWalletStatus } from "./wallet-sheet";
import { usePasskey } from "@/lib/use-passkey";
import { sendOtp, verifyOtp } from "@/app/login/actions";
import { getDeviceId } from "@/lib/device-id";
import { APP_VERSION, BUILD_NUMBER, BUILD_DATE } from "@/lib/version";
import Image from "next/image";

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

interface RouteData {
  geometry: GeoJSON.LineString;
  color: string;
}

interface NavStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
}

interface NavInfo {
  steps: NavStep[];
  distance: number; // total meters
  duration: number; // total seconds
  profile: "walking" | "driving";
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
  onRouteChange?: (route: RouteData | null) => void;
  mapRef?: React.RefObject<import("react-map-gl").MapRef | null>;
}

interface OfferingMeta {
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  type: string;
}

interface CartItem {
  offeringId: string;
  name: string;
  priceCents: number;
  quantity: number;
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

type VenueChatSnap = "collapsed" | "expanded" | "full";

function getDockHeight(mode: DockMode, exploreSnap: SnapPoint, venueChatSnap: VenueChatSnap): string {
  switch (mode) {
    case "idle": return "56px";
    case "explore": return snapToHeight(exploreSnap);
    case "concierge": return "70dvh";
    case "venueChat": return venueChatSnap === "full" ? "92dvh" : venueChatSnap === "expanded" ? "70dvh" : "56px";
    case "profile": return "70dvh";
  }
}

function getDockRadius(mode: DockMode, exploreSnap: SnapPoint, venueChatSnap: VenueChatSnap): string {
  if (mode === "idle") return "28px";
  if (mode === "venueChat" && venueChatSnap === "collapsed") return "28px";
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
        {venue.occupancy > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            <span className="font-sans text-[9px] font-semibold text-white/50">{venue.occupancy} in</span>
          </div>
        )}
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

/* ── AI message body — parses [[OFFER:id:name:price]] into tappable cards ── */

function AiMessageBody({ body, theme, onAddToCart, offeringsMap }: {
  body: string; theme: string;
  onAddToCart: (offeringId: string, name: string, priceCents: number) => void;
  offeringsMap: Record<string, OfferingMeta>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const parts = body.split(/(\[\[OFFER:[^\]]+\]\])/g);

  if (parts.length === 1) {
    return <p className="font-sans text-[14px] leading-[1.6]">{body}</p>;
  }

  const textParts: string[] = [];
  const offerParts: { id: string; name: string; price: number }[] = [];

  for (const part of parts) {
    const match = part.match(/\[\[OFFER:([^:]+):([^:]+):(\d+)\]\]/);
    if (match) {
      offerParts.push({ id: match[1], name: match[2], price: parseInt(match[3]) / 100 });
    } else if (part.trim()) {
      textParts.push(part);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {textParts.length > 0 && (
        <p className="font-sans text-[14px] leading-[1.6]">{textParts.join("")}</p>
      )}
      <div className="flex flex-col gap-1.5 mt-1">
        {offerParts.map((offer) => {
          const meta = offeringsMap[offer.id];
          const isExpanded = expandedId === offer.id;
          const hasImage = meta?.image_url;
          const hasDesc = meta?.description;

          return (
            <div key={offer.id} className="rounded-xl overflow-hidden transition" style={{ backgroundColor: `${theme}10`, border: `1px solid ${theme}25` }}>
              {isExpanded && hasImage && (
                <div className="relative" style={{ height: 120 }}>
                  <img src={meta.image_url!} alt={offer.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)" }} />
                </div>
              )}
              <button
                onClick={() => setExpandedId(isExpanded ? null : offer.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:opacity-80"
              >
                {!isExpanded && hasImage && (
                  <img src={meta.image_url!} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-[13px] font-medium text-white/85">{offer.name}</span>
                  {isExpanded && hasDesc && (
                    <p className="mt-0.5 font-sans text-[11px] leading-[1.4] text-white/40">{meta.description}</p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[13px] font-bold" style={{ color: theme }}>
                  ${offer.price % 1 === 0 ? offer.price : offer.price.toFixed(2)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddToCart(offer.id, offer.name, Math.round(offer.price * 100)); }}
                  className="shrink-0 rounded-full px-2.5 py-1 font-sans text-[10px] font-bold active:scale-90"
                  style={{ backgroundColor: theme, color: "#000" }}
                >
                  ADD
                </button>
              </button>
            </div>
          );
        })}
      </div>
    </div>
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

// ─── Device Manager ─────────────────────────────────────────────

interface DeviceRecord {
  id: string;
  device_id: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

function DeviceManager() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [maxDevices, setMaxDevices] = useState(3);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState("");

  // Get current device fingerprint
  useEffect(() => {
    import("@/lib/device-id").then(({ getDeviceId }) => getDeviceId()).then(setCurrentDeviceId);
  }, []);

  const loadDevices = useCallback(() => {
    fetch("/api/devices")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.devices) setDevices(data.devices);
        if (data?.maxDevices) setMaxDevices(data.maxDevices);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRemove = useCallback(async (deviceDbId: string) => {
    setRemoving(deviceDbId);
    try {
      const res = await fetch("/api/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceDbId }),
      });
      const data = await res.json();
      if (data.ok) loadDevices();
    } catch { }
    setRemoving(null);
  }, [loadDevices]);

  const handleLogoutAll = useCallback(async () => {
    setLoggingOutAll(true);
    try {
      await fetch("/api/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      window.location.reload();
    } catch {
      setLoggingOutAll(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="h-20 animate-pulse rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <div>
          <p className="font-sans text-[13px] font-semibold text-white/80">Devices</p>
          <p className="font-sans text-[10px] text-white/30">{devices.length} of {maxDevices} devices</p>
        </div>
      </div>

      {/* Device list */}
      <div className="flex flex-col gap-1.5">
        {devices.map((d) => {
          const isCurrent = d.device_id === currentDeviceId;
          const lastActive = new Date(d.last_active_at);
          const isToday = new Date().toDateString() === lastActive.toDateString();
          const timeLabel = isToday ? "Active today" : lastActive.toLocaleDateString(undefined, { month: "short", day: "numeric" });

          return (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                backgroundColor: isCurrent ? "rgba(99,91,255,0.06)" : "rgba(255,255,255,0.02)",
                border: isCurrent ? "1px solid rgba(99,91,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isCurrent ? "#635bff" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-sans text-[11px] font-medium text-white/60">{d.device_name || "Unknown device"}</p>
                    {isCurrent && (
                      <span className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(99,91,255,0.15)", color: "#a78bfa" }}>
                        This device
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-[9px] text-white/25">{timeLabel}</p>
                </div>
              </div>
              {!isCurrent && (
                <motion.button
                  onClick={() => handleRemove(d.id)}
                  disabled={removing === d.id}
                  whileTap={{ scale: 0.9 }}
                  className="rounded-lg px-2.5 py-1.5 font-sans text-[10px] font-medium text-red-400/60 transition hover:bg-red-500/10 disabled:opacity-40"
                >
                  {removing === d.id ? "..." : "Remove"}
                </motion.button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log out all devices */}
      {devices.length > 1 && (
        <motion.button
          onClick={handleLogoutAll}
          disabled={loggingOutAll}
          whileTap={{ scale: 0.97 }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 font-sans text-[11px] font-medium text-red-400/50 transition hover:bg-red-500/5 disabled:opacity-40"
          style={{ border: "1px solid rgba(239,68,68,0.1)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {loggingOutAll ? "Logging out..." : "Log out all devices"}
        </motion.button>
      )}

      {devices.length === 0 && (
        <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
          <p className="font-sans text-[11px] text-white/30">No devices registered yet. They appear after you sign in.</p>
        </div>
      )}
    </div>
  );
}

// ─── Inline Login ───────────────────────────────────────────────

function DockLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "waitlisted">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Capture referral key from URL on mount
  const refKey = useRef<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        refKey.current = ref;
        localStorage.setItem("kb-ref", ref);
      } else {
        refKey.current = localStorage.getItem("kb-ref") || null;
      }
    } catch {}
  }, []);

  const handleSend = async () => {
    if (!email || loading) return;
    setError("");
    setLoading(true);
    const r = await sendOtp(email);
    if (r.error) { setError(r.error); setLoading(false); return; }
    setStep("otp");
    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 6 || loading) return;
    setError("");
    setLoading(true);
    const did = await getDeviceId();
    const ua = navigator.userAgent;
    const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser";
    const os = /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : "Device";
    const r = await verifyOtp(email, otp, did, `${browser} on ${os}`, undefined, refKey.current || undefined);
    if ((r as { waitlisted?: boolean })?.waitlisted) {
      setStep("waitlisted");
      setLoading(false);
      // Clear referral key from localStorage on successful waitlist entry
      try { localStorage.removeItem("kb-ref"); } catch {}
      return;
    }
    if (r?.error) { setError(r.error); setLoading(false); return; }
    // Clear referral key on success
    try { localStorage.removeItem("kb-ref"); } catch {}
    onSuccess();
  };

  if (step === "waitlisted") {
    return (
      <div className="flex flex-col items-center px-6 py-8">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
          <span className="text-[28px]">{"\u23F3"}</span>
        </div>
        <h2 className="mb-1 font-sans text-[18px] font-bold text-white">You're on the waitlist</h2>
        <p className="mb-4 max-w-[280px] text-center font-sans text-[12px] leading-relaxed text-white/40">
          We're letting people in gradually. You'll get an email as soon as you're approved.
        </p>
        <div className="w-full max-w-xs rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
          <p className="text-center font-sans text-[11px] text-white/30">
            Have a referral key from a friend? Use the invite link they shared to skip the line.
          </p>
        </div>
        <button
          onClick={() => { setStep("email"); setOtp(""); setError(""); }}
          className="mt-4 font-sans text-[12px] text-white/30"
        >
          Try a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="mb-1 font-sans text-[18px] font-bold text-white">Sign in to theKickBack</h2>
      <p className="mb-5 font-sans text-[12px] text-white/35">
        {step === "email" ? "Enter your email to get a code" : `Code sent to ${email}`}
      </p>
      {refKey.current && step === "email" && (
        <div className="mb-3 w-full max-w-xs rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <p className="text-center font-sans text-[11px] font-medium" style={{ color: "#4ADE80" }}>
            Referral key detected — you'll skip the waitlist
          </p>
        </div>
      )}
      {step === "email" ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="you@email.com"
            autoComplete="email"
            className="w-full rounded-xl px-4 py-3 font-sans text-[14px] text-white outline-none placeholder:text-white/20"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !email}
            className="w-full rounded-xl py-3 font-sans text-[14px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="000000"
            autoComplete="one-time-code"
            className="w-full rounded-xl px-4 py-3 text-center font-mono text-[24px] tracking-[0.3em] text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleVerify}
            disabled={loading || otp.length < 6}
            className="w-full rounded-xl py-3 font-sans text-[14px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            onClick={() => { setStep("email"); setOtp(""); setError(""); }}
            className="font-sans text-[12px] text-white/30"
          >
            Use a different email
          </button>
        </div>
      )}
      {error && <p className="mt-3 font-sans text-[12px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function TheDock({
  venues, selectedVenue, onVenueSelect, userLocation, onRecenter, hasLocation, activeTag, onTagSelect, onNavigateVenue, onRouteChange, mapRef: parentMapRef,
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
    try { localStorage.setItem("kb-shortcuts-seen", "1"); } catch { }
  }, []);

  // ── Mode state ──
  const [mode, setMode] = useState<DockMode>("idle");
  const [previousMode, setPreviousMode] = useState<DockMode>("idle");
  const [exploreSnap, setExploreSnap] = useState<SnapPoint>("peek");
  const [venueChatSnap, setVenueChatSnap] = useState<VenueChatSnap>("collapsed");
  const [showVenueContact, setShowVenueContact] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

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
  const [memberships, setMemberships] = useState<{ venue_id: string; venue_name: string; tier: string; expires_at: string }[]>([]);
  const [balance, setBalance] = useState(0);
  const [myCollectibles, setMyCollectibles] = useState<{ unlock_id: string; asset_id: string; name: string; asset_type: string; category: string; description: string | null; is_animated: boolean; hub_id: string | null; hub_name: string; payment_method: string; unlocked_at: string }[]>([]);
  const [referralKeys, setReferralKeys] = useState<{ id: string; key: string; used_by_email: string | null }[]>([]);

  // ── Offerings map (venueId → offeringId → meta) ──
  const [offeringsMap, setOfferingsMap] = useState<Record<string, Record<string, OfferingMeta>>>({});

  // ── Cart (venueId → items) ──
  const [carts, setCarts] = useState<Map<string, CartItem[]>>(new Map());
  const [cartExpanded, setCartExpanded] = useState(false);

  // ── Venue offerings for quick replies ──
  const [venueOfferings, setVenueOfferings] = useState<Record<string, { id: string; type: string; name: string }[]>>({});

  // ── Wallet status ──
  const walletStatus = useWalletStatus();

  // ── Passkey biometric ──
  const passkey = usePasskey();
  const [paymentMode, setPaymentMode] = useState<"choose" | "processing" | null>(null);
  const [deviceRefreshKey, setDeviceRefreshKey] = useState(0);

  // ── Navigation ──
  const [navInfo, setNavInfo] = useState<NavInfo | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navProfile, setNavProfile] = useState<"walking" | "driving">("walking");

  // ── Explore offerings (all venues) ──
  const [exploreOfferings, setExploreOfferings] = useState<{ id: string; name: string; type: string; price_cents: number; venue_id: string; description: string | null; image_url: string | null; category: string | null }[]>([]);
  const [exploreDigitalAssets, setExploreDigitalAssets] = useState<{ id: string; name: string; asset_type: string; category: string; venue_id: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }[]>([]);
  const exploreOfferingsLoaded = useRef(false);

  // ── Concierge venue data ──
  const [apiVenues, setApiVenues] = useState<Record<string, ApiVenue>>({});
  const [richVenues, setRichVenues] = useState<Record<string, RichVenue>>({});

  // ── Refs ──
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleTabTapRef = useRef<(tab: Tab) => void>(() => { });
  const conciergeHistoryLoaded = useRef(false);
  const threadInfo = useThreadCount();

  // ── Current venue messages ──
  const currentVenueMessages = selectedVenue ? (venueThreads.get(selectedVenue.id) || []) : [];

  // ── Cart helpers ──
  const currentCart = selectedVenue ? (carts.get(selectedVenue.id) || []) : [];
  const cartTotal = currentCart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const cartCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback((venueId: string, offeringId: string, name: string, priceCents: number) => {
    setCarts((prev) => {
      const next = new Map(prev);
      const items = [...(next.get(venueId) || [])];
      const existing = items.find((i) => i.offeringId === offeringId);
      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({ offeringId, name, priceCents, quantity: 1 });
      }
      next.set(venueId, items);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((venueId: string, offeringId: string) => {
    setCarts((prev) => {
      const next = new Map(prev);
      const items = (next.get(venueId) || [])
        .map((i) => i.offeringId === offeringId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0);
      if (items.length === 0) next.delete(venueId);
      else next.set(venueId, items);
      return next;
    });
    if (currentCart.length <= 1) setCartExpanded(false);
  }, [currentCart.length]);

  const clearCart = useCallback((venueId: string) => {
    setCarts((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
    setCartExpanded(false);
  }, []);

  // ── Navigation helpers ──
  const fetchDirections = useCallback(async (profile: "walking" | "driving") => {
    if (!userLocation || !selectedVenue) return;
    setNavLoading(true);
    setNavProfile(profile);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const coords = `${userLocation.longitude},${userLocation.latitude};${selectedVenue.longitude},${selectedVenue.latitude}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?steps=true&geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) throw new Error("No route found");

      const steps: NavStep[] = route.legs[0].steps.map((s: { maneuver: { instruction: string }; distance: number; duration: number }) => ({
        instruction: s.maneuver.instruction,
        distance: s.distance,
        duration: s.duration,
      }));

      setNavInfo({
        steps,
        distance: route.distance,
        duration: route.duration,
        profile,
      });

      // Draw route on map
      const color = selectedVenue ? getVibeHexColor(selectedVenue.vibe) : ACCENT;
      onRouteChange?.({
        geometry: route.geometry,
        color,
      });

      // Fit map to route bounds
      const coords2 = route.geometry.coordinates as [number, number][];
      const lngs = coords2.map((c) => c[0]);
      const lats = coords2.map((c) => c[1]);
      parentMapRef?.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 100, bottom: 350, left: 60, right: 60 }, duration: 1000 }
      );
    } catch {
      setNavInfo(null);
    } finally {
      setNavLoading(false);
    }
  }, [userLocation, selectedVenue, onRouteChange, parentMapRef]);

  const clearNav = useCallback(() => {
    setNavInfo(null);
    onRouteChange?.(null);
  }, [onRouteChange]);

  const openInMaps = useCallback(() => {
    if (!selectedVenue) return;
    const { latitude, longitude } = selectedVenue;
    const label = encodeURIComponent(selectedVenue.name);
    const mode = navProfile === "walking" ? "w" : "d";
    // iOS/macOS
    const appleUrl = `maps://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=${mode}&q=${label}`;
    // Google Maps fallback
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${navProfile}`;
    // Try Apple Maps first (works on iOS/macOS), fall back to Google
    const w = window.open(appleUrl, "_blank");
    if (!w || w.closed) window.open(googleUrl, "_blank");
  }, [selectedVenue, navProfile]);

  // Clear route when venue deselected
  useEffect(() => {
    if (!selectedVenue) clearNav();
  }, [selectedVenue, clearNav]);

  // ── Smart quick replies ──
  const getVenueReplies = useCallback((): { label: string; action: string }[] => {
    if (!selectedVenue) return [];
    const offerings = venueOfferings[selectedVenue.id] || [];
    const cart = carts.get(selectedVenue.id) || [];
    const msgCount = currentVenueMessages.length;

    // After checkout (last AI message mentions "confirmed" or "all set")
    const lastAi = [...currentVenueMessages].reverse().find((m) => m.sender === "ai");
    if (lastAi && (/confirmed|all set|order.*placed/i.test(lastAi.body))) {
      const replies = [
        { label: "Anything else?", action: "anything else?" },
        { label: "What's happening later?", action: "what's happening later?" },
      ];
      if (user) replies.unshift({ label: "Add to Wallet", action: "__WALLET_PASS__" });
      return replies;
    }

    // Cart has items
    if (cart.length > 0) {
      return [
        { label: `Checkout (${cart.reduce((s, i) => s + i.quantity, 0)} items)`, action: "__CHECKOUT__" },
        { label: "Add more", action: "what else do you have?" },
        { label: "Clear cart", action: "__CLEAR_CART__" },
      ];
    }

    // After offerings shown — suggest specific items
    const offersShown = currentVenueMessages.some((m) => m.sender === "ai" && m.body.includes("[[OFFER:"));
    if (offersShown && offerings.length > 0) {
      const products = offerings.filter((o) => o.type === "product" || o.type === "service");
      const replies: { label: string; action: string }[] = products.slice(0, 2).map((o) => ({
        label: `Order the ${o.name}`,
        action: `I'd like to order the ${o.name}`,
      }));
      replies.push({ label: "What's popular?", action: "what's popular here?" });
      return replies;
    }

    // Fresh conversation — built from venue's offerings
    if (msgCount <= 2) {
      const types = new Set(offerings.map((o) => o.type));
      const replies: { label: string; action: string }[] = [];
      if (types.has("product") || types.has("service")) {
        const hasFood = offerings.some((o) => o.type === "product");
        const hasService = offerings.some((o) => o.type === "service");
        if (hasFood) replies.push({ label: "See the menu", action: "show me the menu" });
        if (hasService) {
          const svc = offerings.find((o) => o.type === "service");
          replies.push({ label: `Book a ${svc?.name || "service"}`, action: `I'd like to book a ${svc?.name || "service"}` });
        }
      }
      if (types.has("event")) replies.push({ label: "What's happening tonight?", action: "any events tonight?" });
      if (types.has("membership")) replies.push({ label: "Tell me about membership", action: "tell me about membership" });
      if (types.has("reservation")) replies.push({ label: "Reserve a spot", action: "I'd like to reserve a spot" });
      replies.push({ label: "What's the vibe?", action: "what's the vibe right now?" });
      return replies.slice(0, 4);
    }

    return [];
  }, [selectedVenue, venueOfferings, carts, currentVenueMessages]);

  // ── Animate height/radius on mode + snap changes ──
  useEffect(() => {
    controls.start({
      height: getDockHeight(mode, exploreSnap, venueChatSnap),
      borderRadius: getDockRadius(mode, exploreSnap, venueChatSnap),
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [mode, exploreSnap, venueChatSnap, controls]);

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
          if (venueChatSnap === "full") { setVenueChatSnap("expanded"); return; }
          if (venueChatSnap === "expanded") { setVenueChatSnap("collapsed"); return; }
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
        else if (mode === "venueChat") {
          if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");
          else if (venueChatSnap === "expanded") setVenueChatSnap("full");
        }
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
        else if (mode === "venueChat") {
          if (venueChatSnap === "full") setVenueChatSnap("expanded");
          else if (venueChatSnap === "expanded") setVenueChatSnap("collapsed");
        }
        return;
      }

      // ── Skip single-key shortcuts when typing ──
      if (inInput) return;

      // Arrow left/right — navigate venues
      if (e.key === "ArrowLeft") { e.preventDefault(); onNavigateVenue(-1); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNavigateVenue(1); return; }

      // Enter — open venue chat if venue selected (logged in only)
      if (e.key === "Enter" && selectedVenue && mode !== "venueChat" && user) {
        e.preventDefault();
        setMode("venueChat");
        setVenueChatSnap("expanded");
        return;
      }

      // E — toggle explore
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (mode === "explore") { setMode("idle"); }
        else { setMode("explore"); setExploreSnap("half"); }
        return;
      }

      // C — concierge (logged in only)
      if ((e.key === "c" || e.key === "C") && user) {
        e.preventDefault();
        if (mode === "concierge") setMode("idle");
        else setMode("concierge");
        return;
      }

      // P — profile (logged in only)
      if ((e.key === "p" || e.key === "P") && user) {
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
  }, [isDesktop, mode, previousMode, exploreSnap, venueChatSnap, selectedVenue, hasLocation, showShortcuts, onNavigateVenue, onRecenter, onVenueSelect]);

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

  // ── Load all offerings + digital assets for explore mode ──
  useEffect(() => {
    if (mode !== "explore" || exploreOfferingsLoaded.current) return;
    exploreOfferingsLoaded.current = true;

    const claimed = venues.filter((v) => v.claimed !== false).slice(0, 15);
    // Fetch offerings
    Promise.all(
      claimed.map((v) =>
        fetch(`/api/offerings?venueId=${v.id}`)
          .then((r) => r.ok ? r.json() : { offerings: [] })
          .then((d) => (d.offerings || []).map((o: { id: string; name: string; type: string; price_cents: number; description: string | null; image_url?: string | null; category?: string | null }) => ({
            ...o, venue_id: v.id, image_url: o.image_url || null, category: o.category || null,
          })))
          .catch(() => [])
      )
    ).then((results) => {
      setExploreOfferings(results.flat());
    });
    // Fetch digital assets
    Promise.all(
      claimed.map((v) =>
        fetch(`/api/digital-assets?venueId=${v.id}`)
          .then((r) => r.ok ? r.json() : { assets: [] })
          .then((d) => (d.assets || []).map((a: { id: string; name: string; asset_type: string; category: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }) => ({
            ...a, venue_id: v.id,
          })))
          .catch(() => [])
      )
    ).then((results) => {
      setExploreDigitalAssets(results.flat());
    });
  }, [mode, venues]);

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
      if (!user) {
        // Not logged in — show venue profile only, no chat
        setMode("venueChat");
        setVenueChatSnap("expanded");
        setShowVenueContact(true);
        return;
      }
      setMode("venueChat");
      setVenueChatSnap("collapsed");
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

      // Fetch offerings for quick replies (if not cached)
      if (!venueOfferings[vid]) {
        fetch(`/api/offerings?venueId=${vid}`)
          .then((r) => r.ok ? r.json() : { offerings: [] })
          .then((d) => {
            if (d.offerings?.length) {
              setVenueOfferings((prev) => ({ ...prev, [vid]: d.offerings.map((o: { id: string; type: string; name: string }) => ({ id: o.id, type: o.type, name: o.name })) }));
            }
          })
          .catch(() => { });
      }
    } else {
      if (mode === "venueChat") {
        setMode("explore");
        setExploreSnap("half");
      }
    }
    setShowVenueContact(false);
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

        // Fetch memberships
        try {
          const mRes = await fetch("/api/points?memberships=true");
          if (mRes.ok) {
            const mData = await mRes.json();
            if (mData.memberships) setMemberships(mData.memberships);
          }
        } catch { /* skip */ }

        const allPerks: Perk[] = [];
        for (const v of venues.filter((v) => v.claimed !== false).slice(0, 10)) {
          try {
            const pRes = await fetch(`/api/points?venueId=${v.id}`);
            const pData = await pRes.json();
            if (pData.perks) allPerks.push(...pData.perks);
          } catch { /* skip */ }
        }
        setPerks(allPerks);

        // Fetch collectibles
        try {
          const cRes = await fetch("/api/my-collectibles");
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.collectibles) setMyCollectibles(cData.collectibles);
          }
        } catch { /* skip */ }

        // Fetch referral keys
        try {
          const rkRes = await fetch("/api/referral-keys");
          if (rkRes.ok) {
            const rkData = await rkRes.json();
            if (rkData.keys) setReferralKeys(rkData.keys);
          }
        } catch { /* skip */ }
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
    if (!user) return; // Must be logged in to chat
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() };

    if (mode === "venueChat" && selectedVenue) {
      // Venue chat
      if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");

      // ── Cart special actions ──
      if (msg === "__CHECKOUT__") {
        setInput("");
        // Build checkout from cart
        const cart = carts.get(selectedVenue.id) || [];
        if (cart.length === 0) return;
        const checkoutData: CheckoutCardData = {
          venue_name: selectedVenue.name,
          venue_id: selectedVenue.id,
          items: cart.map((item) => ({
            offering_id: item.offeringId,
            slot_id: null,
            name: item.name,
            quantity: item.quantity,
            unit_price_cents: item.priceCents,
          })),
        };
        const checkoutMsg: Message = {
          id: `checkout-${Date.now()}`, sender: "ai",
          body: "Here's your order — review and confirm when ready.",
          timestamp: Date.now(), checkout: checkoutData,
        };
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), checkoutMsg]);
          return next;
        });
        setCartExpanded(false);
        return;
      }
      if (msg === "__WALLET_PASS__") {
        setInput("");
        if (user) window.open(`https://thekickback.net/wallet/pass/${user.authId}`, "_blank");
        return;
      }
      if (msg === "__CLEAR_CART__") {
        setInput("");
        clearCart(selectedVenue.id);
        const clearMsg: Message = { id: `clear-${Date.now()}`, sender: "ai", body: "Cart cleared. What else can I help with?", timestamp: Date.now() };
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), clearMsg]);
          return next;
        });
        return;
      }

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

        // Store offerings metadata for rendering inline cards
        if (data.offerings && Object.keys(data.offerings).length > 0) {
          setOfferingsMap((prev) => ({
            ...prev,
            [selectedVenue.id]: { ...(prev[selectedVenue.id] || {}), ...data.offerings },
          }));
        }

        const cardTab = data.card || (activeTab !== "chat" ? activeTab : undefined);
        const aiMsg: Message = {
          id: `ai-${Date.now()}`, sender: "ai",
          body: data.reply || "Couldn't reach the venue right now. Try again.",
          timestamp: Date.now(), tab: cardTab as Tab | undefined,
        };
        if (data.checkout) {
          aiMsg.checkout = { ...data.checkout, venue_name: selectedVenue.name, venue_id: selectedVenue.id };
        }
        // If a booking was confirmed, enrich the reply with details
        if (data.booking?.booking) {
          const bk = data.booking.booking;
          const bkStart = bk.start ? new Date(bk.start) : null;
          const bkEnd = bk.end ? new Date(bk.end) : null;
          const dateStr = bkStart ? bkStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
          const timeStr = bkStart ? bkStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          const endTimeStr = bkEnd ? bkEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          const bookingDetails = `\n\nBooking confirmed: ${data.booking.message || ""}${dateStr ? `\nDate: ${dateStr}` : ""}${timeStr ? `\nTime: ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}` : ""}${user ? `\n\nAdd to Apple Wallet: https://thekickback.net/wallet/pass/${user.authId}` : ""}`;
          aiMsg.body = aiMsg.body + bookingDetails;
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
  }, [input, loading, mode, selectedVenue, venueChatSnap, activeTab, carts, clearCart]);

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
        if (venueChatSnap === "full") setVenueChatSnap("expanded");
        else if (venueChatSnap === "expanded") setVenueChatSnap("collapsed");
        // Don't dismiss on drag from collapsed — keep venue selected
      } else if (draggingUp) {
        if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");
        else if (venueChatSnap === "expanded") setVenueChatSnap("full");
      }
    } else if (mode === "profile") {
      if (draggingDown) setMode(previousMode);
    }
  }

  // ─── Input focus handler ───────────────────────────────────────

  const handleInputFocus = useCallback(() => {
    if (!user) return; // Must be logged in for chat
    if (mode === "idle" || mode === "explore") {
      if (selectedVenue) {
        setMode("venueChat");
        setVenueChatSnap("expanded");
      } else {
        setMode("concierge");
      }
    } else if (mode === "venueChat" && venueChatSnap === "collapsed") {
      setVenueChatSnap("expanded");
    }
  }, [mode, selectedVenue, venueChatSnap, user]);

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
    if (!user) {
      // Not logged in — open explore with login form
      setMode("explore");
      setExploreSnap("half");
      return;
    }
    setPreviousMode(mode);
    setMode("profile");
  }, [mode, user]);

  const handleProfileBack = useCallback(() => {
    setMode(previousMode);
  }, [previousMode]);

  // ─── Computed ──────────────────────────────────────────────────

  const tierColor = TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8";
  const vibeColor = selectedVenue ? (selectedVenue.themeColor || "#F97316") : ACCENT;
  const sendColor = mode === "venueChat" ? vibeColor : ACCENT;
  const venueChatExpanded = venueChatSnap !== "collapsed";
  const showExpandedContent = mode === "explore" || mode === "concierge" || mode === "profile" || (mode === "venueChat" && venueChatExpanded);
  const isCollapsedPill = mode === "idle" || (mode === "venueChat" && !venueChatExpanded);

  // ─── Checkout handler for venue chat ──
  const processPayment = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card"
  ) => {
    if (!selectedVenue || !msg.checkout) return;
    setPaymentMode("processing");

    const itemsTotal = msg.checkout.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price_cents, 0);
    const subtotal = itemsTotal + addOnsTotal - pointsToSpend;

    try {
      if (method === "wallet") {
        const spendRes = await fetch("/api/wallet/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: subtotal,
            venueId: selectedVenue.id,
            description: `Order at ${selectedVenue.name}`,
          }),
        });
        const spendResult = await spendRes.json();
        if (!spendRes.ok) throw new Error(spendResult.error || "Wallet spend failed");
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: selectedVenue.id,
          items: msg.checkout.items,
          addOns,
          pointsToSpend,
          notes: msg.checkout.notes,
          paymentMethod: method,
        }),
      });
      const result = await res.json();
      const walletPassNote = result.orderId && user ? `\n\nAdd your pass to Apple Wallet: https://thekickback.net/wallet/pass/${user.authId}` : "";
      // Build item summary for confirmation
      const itemNames = msg.checkout.items.map((i: { name: string; quantity?: number }) => i.quantity && i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name).join(", ");
      const bonusPts = Math.floor(subtotal / 10);
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed: ${itemNames}. Total: $${(subtotal / 100).toFixed(2)}.${method === "wallet" ? " Paid from AI Credit." : " Charged to card on file."}${pointsToSpend > 0 ? ` Used ${pointsToSpend} points.` : ""}${bonusPts > 0 ? ` +${bonusPts} XP earned!` : ""} Show this to the host when you arrive.${walletPassNote}`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), confirmMsg]);
        return next;
      });
      if (result.orderId) {
        clearCart(selectedVenue.id);
        // Refresh wallet balance + XP immediately
        walletStatus?.refresh?.();
        // Re-fetch user points/XP
        fetch("/api/points").then((r) => r.ok ? r.json() : null).then((data) => {
          if (data?.balance && user) {
            setUser({
              ...user,
              kickbackScore: data.balance.kickback_score || data.balance.total_earned || user.kickbackScore,
              totalEarned: data.balance.total_earned || user.totalEarned,
              tier: data.balance.tier || user.tier,
              streak: data.balance.current_streak || user.streak,
              venueProfiles: data.venueProfiles || user.venueProfiles,
            });
          }
        }).catch(() => { });
      }
    } catch {
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Couldn't process the order. Try again.", timestamp: Date.now() }]);
        return next;
      });
    } finally {
      setPaymentMode(null);
    }
  }, [selectedVenue, clearCart, walletStatus, user]);

  const handleCheckoutConfirm = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card" = "card"
  ) => {
    if (!selectedVenue || !msg.checkout) return;

    // ── Biometric: only attempt for wallet, never block card ──
    if (method === "wallet") {
      // Try verify first (may fail if passkey is on another device)
      let verified = false;
      if (passkey.hasPasskey) {
        verified = await passkey.verify();
      }

      // If verify failed or no passkey, try to register on this device
      if (!verified) {
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), {
            id: `bio-setup-${Date.now()}`, sender: "ai",
            body: "Setting up biometric on this device for wallet payments. Follow the prompt.",
            timestamp: Date.now(),
          }]);
          return next;
        });
        const registered = await passkey.register();
        if (!registered) {
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), {
              id: `bio-${Date.now()}`, sender: "ai",
              body: "Biometric setup cancelled. Pay with card instead — no biometric needed.",
              timestamp: Date.now(),
            }]);
            return next;
          });
          return;
        }
        // Just registered — verify now
        verified = await passkey.verify();
        if (!verified) {
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), {
              id: `bio-err-${Date.now()}`, sender: "ai",
              body: "Verification failed. Try card payment instead.",
              timestamp: Date.now(),
            }]);
            return next;
          });
          return;
        }
      }
    }
    // Card payments skip biometric entirely — Stripe handles auth

    // Process payment
    await processPayment(msg, addOns, pointsToSpend, method);
  }, [selectedVenue, passkey, processPayment]);

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

              {/* Center: pulsing dot + input/sign-in */}
              <motion.div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCENT }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
              />

              {user ? (
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
              ) : (
                <button
                  onClick={() => { setMode("explore"); setExploreSnap("half"); }}
                  className="min-w-0 flex-1 text-left font-sans text-[13px] text-white/25"
                >
                  Sign in to explore...
                </button>
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

              {/* Version badge */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAbout(true); }}
                className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8px] text-white/15 active:scale-95"
              >
                v{APP_VERSION}
              </button>
            </div>
          )}

          {/* ═══ VENUE CHAT COLLAPSED ═══ */}
          {mode === "venueChat" && !venueChatExpanded && selectedVenue && (
            <div className="flex h-full items-center gap-2 px-3">
              <button onClick={() => { if (user) setVenueChatSnap("expanded"); else { setVenueChatSnap("expanded"); setShowVenueContact(true); } }} className="flex items-center gap-2 pl-1">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full" style={{ border: `1.5px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
                  {selectedVenue.heroImage ? (
                    <img src={selectedVenue.heroImage} alt="" className="h-full w-full object-cover" />
                  ) : selectedVenue.logo ? (
                    <img src={selectedVenue.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-sans text-[10px] font-bold" style={{ color: vibeColor }}>{selectedVenue.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
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
              {exploreSnap !== "peek" && !user && (
                <DockLogin onSuccess={() => window.location.reload()} />
              )}
              {exploreSnap !== "peek" && user && (
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

                  {/* ── Offerings by category ── */}
                  {exploreOfferings.length > 0 && (() => {
                    const OFFER_CATEGORIES: { key: string; label: string; types: string[]; icon: string }[] = [
                      { key: "food", label: "FOOD & DRINKS", types: ["product"], icon: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3" },
                      { key: "events", label: "EVENTS", types: ["event"], icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
                      { key: "services", label: "SERVICES", types: ["service"], icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2M12 8v4l3 3" },
                      { key: "reserve", label: "RESERVATIONS", types: ["reservation"], icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
                      { key: "membership", label: "MEMBERSHIPS", types: ["membership"], icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
                      { key: "shop", label: "SHOP", types: ["package", "custom"], icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" },
                    ];

                    return OFFER_CATEGORIES.map(({ key, label, types, icon }) => {
                      const items = exploreOfferings.filter((o) => types.includes(o.type));
                      if (items.length === 0) return null;

                      return (
                        <div key={key} className="mb-5">
                          <div className="flex items-center justify-between px-5 pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                              <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25">{label}</span>
                            </div>
                            <span className="font-sans text-[10px] text-white/15">{items.length}</span>
                          </div>
                          <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
                            {items.map((item, i) => {
                              const venue = venues.find((v) => v.id === item.venue_id);
                              const color = venue?.themeColor || getVibeHexColor(venue?.vibe || "quiet");
                              return (
                                <motion.button
                                  key={item.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: Math.min(i * 0.03, 0.15) }}
                                  onClick={() => {
                                    if (venue) {
                                      onVenueSelect(venue);
                                    }
                                  }}
                                  className="flex shrink-0 flex-col overflow-hidden rounded-2xl text-left active:scale-[0.97]"
                                  style={{
                                    width: 160, scrollSnapAlign: "start",
                                    backgroundColor: "rgba(255,255,255,0.03)",
                                    border: `1px solid ${color}15`,
                                  }}
                                >
                                  {/* Image or gradient header */}
                                  <div className="relative h-20 w-full" style={{ background: item.image_url ? undefined : `linear-gradient(135deg, ${color}20 0%, ${color}06 100%)` }}>
                                    {item.image_url ? (
                                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={`${color}40`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                                      </div>
                                    )}
                                    {/* Price badge */}
                                    <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                                      <span className="font-mono text-[10px] font-bold" style={{ color }}>${(item.price_cents / 100).toFixed(item.price_cents % 100 === 0 ? 0 : 2)}</span>
                                    </div>
                                  </div>
                                  {/* Info */}
                                  <div className="flex flex-col gap-0.5 px-2.5 py-2">
                                    <span className="truncate font-sans text-[12px] font-semibold text-white/80">{item.name}</span>
                                    {item.description && (
                                      <span className="line-clamp-1 font-sans text-[9px] leading-[1.3] text-white/30">{item.description}</span>
                                    )}
                                    <span className="mt-0.5 truncate font-sans text-[9px] font-medium text-white/20">{venue?.name || "Venue"}</span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}

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
                    <Shelf title="PERKS YOU CAN CLAIM" count={affordablePerks.length}>
                      {affordablePerks.map((perk, i) => (
                        <PerkBadge
                          key={perk.id}
                          perk={perk}
                          venueName={venueNameMap.get(perk.venue_id) || "Venue"}
                          canAfford={balance >= perk.point_cost}
                          onClick={() => {
                            const v = venues.find((v) => v.id === perk.venue_id);
                            if (v) {
                              handleExploreVenueTap(v);
                              setTimeout(() => send(`Tell me about the ${perk.name} perk`), 300);
                            }
                          }}
                          delay={Math.min(i * 0.04, 0.2)}
                        />
                      ))}
                    </Shelf>
                  )}

                  {exploreDigitalAssets.length > 0 && (
                    <Shelf title="COLLECTIBLES" count={exploreDigitalAssets.length}>
                      {exploreDigitalAssets.map((asset, i) => {
                        const assetEmoji = asset.asset_type === "sticker" ? "\u{1F3F7}\uFE0F" : asset.asset_type === "badge" ? "\u{1F3C5}" : "\u{1F4CC}";
                        const assetColor = asset.asset_type === "sticker" ? "#4ADE80" : asset.asset_type === "badge" ? "#F97316" : "#A78BFA";
                        const priceLabel = asset.xp_cost ? `${asset.xp_cost} XP` : asset.cash_price_cents ? `$${(asset.cash_price_cents / 100).toFixed(2)}` : "Free";
                        return (
                          <motion.button
                            key={asset.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300, delay: Math.min(i * 0.04, 0.2) }}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => {
                              const v = venues.find((v) => v.id === asset.venue_id);
                              if (v) {
                                handleExploreVenueTap(v);
                                setTimeout(() => send(`I want the ${asset.name} ${asset.asset_type}`), 300);
                              }
                            }}
                            className="flex shrink-0 flex-col items-center"
                            style={{ width: 80, scrollSnapAlign: "start" }}
                          >
                            <div
                              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
                              style={{
                                background: `linear-gradient(135deg, ${assetColor}20, ${assetColor}08)`,
                                border: `2px solid ${assetColor}30`,
                                boxShadow: `0 0 16px ${assetColor}15`,
                              }}
                            >
                              <span className="text-[28px]">{assetEmoji}</span>
                            </div>
                            <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueNameMap.get(asset.venue_id) || "Venue"}</p>
                            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: `${assetColor}15`, color: assetColor, border: `1px solid ${assetColor}25` }}>
                              {priceLabel}
                            </span>
                            {asset.is_animated && <span className="mt-0.5 font-sans text-[7px] text-white/15">{"\u2728"} animated</span>}
                          </motion.button>
                        );
                      })}
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
          {mode === "concierge" && user && (
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

              {/* Quick replies */}
              {conciergeMessages.length <= 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
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
                </div>
              )}

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
          {mode === "venueChat" && venueChatExpanded && selectedVenue && !showVenueContact && user && (
            <>
              {/* Header */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowVenueContact(true)}
                    className="flex items-center gap-2.5 active:opacity-70"
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full" style={{ border: `2px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
                      {selectedVenue.heroImage ? (
                        <img src={selectedVenue.heroImage} alt="" className="h-full w-full object-cover" />
                      ) : selectedVenue.logo ? (
                        <img src={selectedVenue.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="font-sans text-[12px] font-bold" style={{ color: vibeColor }}>{selectedVenue.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-black" style={{ backgroundColor: vibeColor }} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[14px] font-semibold text-white/90 leading-tight">{selectedVenue.name}</span>
                      <span className="font-sans text-[9px] text-white/30">{selectedVenue.neighborhood || "Tap for info"}</span>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
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
                    {/* Clear thread */}
                    {currentVenueMessages.length > 1 && (
                      <motion.button
                        onClick={() => {
                          if (!selectedVenue) return;
                          const welcomeBody = selectedVenue.claimed === false
                            ? `Hey — I know a bit about ${selectedVenue.name} from public info. Ask me what you want to know.`
                            : `Welcome to ${selectedVenue.name}. ${getVibeLabel(selectedVenue.vibe)} right now, ${selectedVenue.occupancy} people. Ask me anything.`;
                          setVenueThreads((prev) => {
                            const next = new Map(prev);
                            next.set(selectedVenue.id, [{ id: `welcome-${Date.now()}`, sender: "ai", body: welcomeBody, timestamp: Date.now() }]);
                            return next;
                          });
                        }}
                        whileTap={{ scale: 0.85 }}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                        title="Start over"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </motion.button>
                    )}
                    {/* Expand to full / collapse from full */}
                    <motion.button
                      onClick={() => setVenueChatSnap(venueChatSnap === "full" ? "expanded" : "full")}
                      whileTap={{ scale: 0.85 }}
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: venueChatSnap === "full" ? `${vibeColor}15` : "rgba(255,255,255,0.08)" }}
                    >
                      {venueChatSnap === "full" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                          <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                          <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      )}
                    </motion.button>
                    {/* Collapse to pill */}
                    <motion.button
                      onClick={() => setVenueChatSnap("collapsed")}
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
                  {selectedVenue.occupancy > 0 && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      </svg>
                      <span className="font-mono text-[9px] font-semibold text-white/40">{selectedVenue.occupancy} in</span>
                    </div>
                  )}
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
                  {walletStatus?.active && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(99,91,255,0.1)", border: "1px solid rgba(99,91,255,0.2)" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                      <span className="font-mono text-[9px] font-semibold" style={{ color: "#635bff" }}>${((walletStatus?.balanceCents || 0) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {/* Navigate button */}
                  {hasLocation && selectedVenue.latitude !== 0 && (
                    <button
                      onClick={() => navInfo ? clearNav() : fetchDirections(navProfile)}
                      disabled={navLoading}
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 active:scale-95"
                      style={{
                        backgroundColor: navInfo ? `${vibeColor}20` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${navInfo ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={navInfo ? vibeColor : "rgba(255,255,255,0.4)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                      <span className="font-sans text-[9px] font-semibold" style={{ color: navInfo ? vibeColor : "rgba(255,255,255,0.4)" }}>
                        {navLoading ? "..." : navInfo ? `${Math.round(navInfo.duration / 60)} min` : "Navigate"}
                      </span>
                    </button>
                  )}
                </div>

                {selectedVenue.tagline && (
                  <p className="mt-1 line-clamp-1 font-sans text-[10px] italic text-white/25">&ldquo;{selectedVenue.tagline}&rdquo;</p>
                )}
              </div>

              {/* Navigation directions panel */}
              <AnimatePresence>
                {navInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-4 mb-1 overflow-hidden rounded-xl"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${vibeColor}15` }}
                  >
                    {/* Profile toggle + summary */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Walking / Driving toggle */}
                        <div className="flex rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <button
                            onClick={() => fetchDirections("walking")}
                            className="flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[9px] font-semibold transition"
                            style={{
                              backgroundColor: navProfile === "walking" ? `${vibeColor}20` : "transparent",
                              color: navProfile === "walking" ? vibeColor : "rgba(255,255,255,0.35)",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="5" r="2" /><path d="M10 22V18L7 15V11L10 9L14 9L17 11V15L14 18V22" />
                            </svg>
                            Walk
                          </button>
                          <button
                            onClick={() => fetchDirections("driving")}
                            className="flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[9px] font-semibold transition"
                            style={{
                              backgroundColor: navProfile === "driving" ? `${vibeColor}20` : "transparent",
                              color: navProfile === "driving" ? vibeColor : "rgba(255,255,255,0.35)",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 3M19 17l1 3" />
                            </svg>
                            Drive
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[12px] font-bold" style={{ color: vibeColor }}>{Math.round(navInfo.duration / 60)} min</span>
                          <span className="font-mono text-[10px] text-white/30">
                            {navInfo.distance < 1000
                              ? `${Math.round(navInfo.distance)} m`
                              : `${(navInfo.distance / 1609).toFixed(1)} mi`
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={openInMaps}
                          className="flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[9px] font-semibold active:scale-95"
                          style={{ backgroundColor: `${vibeColor}15`, color: vibeColor, border: `1px solid ${vibeColor}25` }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          Open Maps
                        </button>
                        <button
                          onClick={clearNav}
                          className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/[0.08]"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Step-by-step directions */}
                    <div className="max-h-[120px] overflow-y-auto px-3 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                      {navInfo.steps.filter((s) => s.instruction).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 py-1" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${vibeColor}15` }}>
                            <span className="font-mono text-[7px] font-bold" style={{ color: vibeColor }}>{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-[11px] leading-[1.4] text-white/60">{step.instruction}</p>
                            <span className="font-mono text-[9px] text-white/20">
                              {step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1609).toFixed(1)} mi`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Points / Member Perks */}
              <PointsBadge venueId={selectedVenue.id} vibeColor={vibeColor} expanded={true} />

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Messages + Venue Profile */}
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
                      // Phase 5: Inline tab responses — text bubble + compact strip below
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                          {msg.body && (
                            <div className="flex justify-start">
                              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <AiMessageBody
                                  body={msg.body}
                                  theme={vibeColor}
                                  offeringsMap={offeringsMap[selectedVenue.id] || {}}
                                  onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)}
                                />
                              </div>
                            </div>
                          )}
                          {/* Compact tab strip */}
                          <div className="ml-1">
                            <button
                              onClick={() => handleTabTap(msg.tab!)}
                              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-medium active:scale-95"
                              style={{ backgroundColor: `${vibeColor}12`, color: vibeColor, border: `1px solid ${vibeColor}25` }}
                            >
                              <TabIcon path={TABS.find((t) => t.id === msg.tab)?.icon || ""} size={10} />
                              View full {msg.tab} details
                            </button>
                          </div>
                        </motion.div>
                      );
                    }

                    if (msg.checkout) {
                      const subtotal = msg.checkout.items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
                      const hasWallet = walletStatus?.active && walletStatus.balanceCents > 0;
                      const canUseWallet = hasWallet && walletStatus.balanceCents >= subtotal;
                      const stripeFee = Math.round(subtotal * 0.029 + 30);
                      const platformFee = Math.round(subtotal * 0.05);
                      const cardTotal = subtotal + stripeFee + platformFee;

                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                          {/* AI message text */}
                          {msg.body && (
                            <div className="flex justify-start">
                              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <AiMessageBody
                                  body={msg.body}
                                  theme={vibeColor}
                                  offeringsMap={offeringsMap[selectedVenue.id] || {}}
                                  onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)}
                                />
                              </div>
                            </div>
                          )}

                          {/* Order summary */}
                          <div className="w-full rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}15` }}>
                            <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="flex items-center gap-2 mb-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                <span className="font-sans text-[13px] font-bold text-white/80">Order at {selectedVenue.name}</span>
                              </div>
                              {msg.checkout.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-0.5">
                                  <span className="font-sans text-[12px] text-white/60">
                                    {item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}
                                  </span>
                                  <span className="font-mono text-[12px] text-white/50">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between mt-1 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <span className="font-sans text-[12px] font-semibold text-white/70">Subtotal</span>
                                <span className="font-mono text-[13px] font-bold text-white/80">${(subtotal / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Login gate */}
                          {!user && (
                            <a
                              href="/login"
                              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-sans text-[14px] font-bold text-black active:scale-[0.97]"
                              style={{ backgroundColor: vibeColor }}
                            >
                              Log in to checkout
                            </a>
                          )}

                          {/* ══ Compact payment buttons ══ */}
                          {user && <div className="flex gap-2 w-full">
                            {/* AI Credit */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "wallet")}
                              disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: canUseWallet ? "rgba(99,91,255,0.12)" : "rgba(99,91,255,0.05)", border: `1px solid ${canUseWallet ? "rgba(99,91,255,0.3)" : "rgba(99,91,255,0.1)"}` }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold" style={{ color: "#a78bfa" }}>${(subtotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold" style={{ color: "#a78bfa" }}>
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "AI Credit"}
                              </span>
                              {walletStatus?.active && <span className="font-mono text-[9px] text-white/25">Bal: ${(walletStatus.balanceCents / 100).toFixed(2)}</span>}
                              <span className="font-sans text-[8px]" style={{ color: "#4ade80" }}>No fees</span>
                            </button>
                            {/* Card */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "card")}
                              disabled={paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold text-white/80">${(cardTotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold text-white/50">
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "Card"}
                              </span>
                              <span className="font-mono text-[8px] text-white/20">+${((stripeFee + platformFee) / 100).toFixed(2)} fees</span>
                            </button>
                          </div>}

                          {/* Cancel */}
                          <button
                            onClick={handleCheckoutDismiss}
                            className="w-full rounded-xl py-2.5 font-sans text-[12px] font-medium text-white/30 transition hover:bg-white/[0.04]"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            Cancel
                          </button>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <AiMessageBody
                            body={msg.body}
                            theme={vibeColor}
                            offeringsMap={offeringsMap[selectedVenue.id] || {}}
                            onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  {loading && <LoadingDots />}
                </div>
              </div>

              {/* Cart pill */}
              {cartCount > 0 && selectedVenue && (
                <div className="px-3 pb-1">
                  <AnimatePresence>
                    {cartExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-1.5 overflow-hidden rounded-xl"
                        style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}20` }}
                      >
                        <div className="flex flex-col gap-1 px-3 py-2">
                          {currentCart.map((item) => (
                            <div key={item.offeringId} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate font-sans text-[12px] text-white/70">{item.name}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => removeFromCart(selectedVenue.id, item.offeringId)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                  <span className="font-mono text-[11px] font-bold text-white/50">-</span>
                                </button>
                                <span className="w-4 text-center font-mono text-[11px] font-bold text-white/60">{item.quantity}</span>
                                <button
                                  onClick={() => addToCart(selectedVenue.id, item.offeringId, item.name, item.priceCents)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: `${vibeColor}20` }}
                                >
                                  <span className="font-mono text-[11px] font-bold" style={{ color: vibeColor }}>+</span>
                                </button>
                                <span className="w-12 text-right font-mono text-[11px] font-semibold text-white/50">${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: `${vibeColor}15` }}>
                          <button
                            onClick={() => clearCart(selectedVenue.id)}
                            className="rounded-full px-2.5 py-1 font-sans text-[10px] font-medium text-white/30 active:scale-95"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            Clear
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => { setCartExpanded(false); send("__CHECKOUT__"); }}
                            className="rounded-full px-4 py-1.5 font-sans text-[11px] font-bold text-black active:scale-95"
                            style={{ backgroundColor: vibeColor }}
                          >
                            Checkout ${(cartTotal / 100).toFixed(2)}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setCartExpanded(!cartExpanded)}
                    className="flex w-full items-center justify-between rounded-full px-3 py-1.5 active:scale-[0.98]"
                    style={{ backgroundColor: `${vibeColor}12`, border: `1px solid ${vibeColor}25` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      <span className="font-sans text-[11px] font-semibold" style={{ color: vibeColor }}>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: vibeColor }}>${(cartTotal / 100).toFixed(2)}</span>
                  </button>
                </div>
              )}

              {/* Smart quick replies */}
              {!loading && selectedVenue && (() => {
                const replies = getVenueReplies();
                if (replies.length === 0) return null;
                return (
                  <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                    {replies.map((r) => (
                      <button
                        key={r.label}
                        onClick={() => send(r.action)}
                        className="shrink-0 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                        style={{ backgroundColor: `${vibeColor}08`, color: `${vibeColor}cc`, border: `1px solid ${vibeColor}20` }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                );
              })()}

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

          {/* ═══ VENUE CONTACT PAGE ═══ */}
          {mode === "venueChat" && venueChatExpanded && selectedVenue && showVenueContact && (
            <VenueContact
              venue={selectedVenue}
              onClose={() => setShowVenueContact(false)}
              onChat={() => setShowVenueContact(false)}
            />
          )}

          {/* ═══ VENUE CHAT — UNCLAIMED (Ghost Agent) ═══ */}
          {mode === "venueChat" && selectedVenue && selectedVenue.claimed === false && venueChatExpanded && user && (
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

                    {/* Biometric Security */}
                    <div className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: passkey.hasPasskey ? "rgba(74,222,128,0.06)" : "rgba(249,115,22,0.06)", border: `1px solid ${passkey.hasPasskey ? "rgba(74,222,128,0.15)" : "rgba(249,115,22,0.15)"}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={passkey.hasPasskey ? "#4ADE80" : "#F97316"} strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span className="font-sans text-[12px] font-semibold" style={{ color: passkey.hasPasskey ? "#4ADE80" : "rgba(255,255,255,0.6)" }}>
                            {passkey.hasPasskey ? "Biometric enabled" : "Biometric not set up"}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            const ok = await passkey.register();
                            if (ok) {
                              setDeviceRefreshKey((k) => k + 1);
                              setVenueThreads((prev) => {
                                const next = new Map(prev);
                                const vid = selectedVenue?.id || "global";
                                next.set(vid, [...(next.get(vid) || []), { id: `bio-ok-${Date.now()}`, sender: "ai", body: "Biometric registered on this device. Wallet payments are now enabled.", timestamp: Date.now() }]);
                                return next;
                              });
                            }
                          }}
                          disabled={passkey.verifying}
                          className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold active:scale-95 disabled:opacity-50"
                          style={{ backgroundColor: passkey.hasPasskey ? "rgba(74,222,128,0.15)" : "#F97316", color: passkey.hasPasskey ? "#4ADE80" : "#000" }}
                        >
                          {passkey.verifying ? "Setting up..." : passkey.hasPasskey ? "Add this device" : "Enable"}
                        </button>
                      </div>
                      <p className="mt-1.5 font-sans text-[9px] text-white/25">
                        {passkey.hasPasskey ? "Wallet not working? Tap \"Add this device\" to register biometric here." : "Required for wallet purchases. Uses Face ID / Touch ID."}
                      </p>
                    </div>

                    {/* Referral Keys */}
                    {referralKeys.length > 0 && (
                      <div className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)" }}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">REFERRAL KEYS</span>
                          <span className="font-mono text-[10px] font-bold" style={{ color: "#F97316" }}>
                            {referralKeys.filter((k) => !k.used_by_email).length}/{referralKeys.length} left
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {referralKeys.map((k) => (
                            <div key={k.id} className="flex items-center gap-2">
                              <span className={`flex-1 font-mono text-[11px] ${k.used_by_email ? "text-white/15 line-through" : "text-white/50"}`}>
                                {k.key}
                              </span>
                              {k.used_by_email ? (
                                <span className="font-sans text-[9px] text-white/15">used</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(`https://join.thekickback.net?ref=${k.key}`);
                                    }}
                                    className="rounded-md px-2 py-1 font-sans text-[9px] font-bold active:scale-95"
                                    style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316" }}
                                  >
                                    Copy
                                  </button>
                                  {typeof navigator !== "undefined" && "share" in navigator && (
                                    <button
                                      onClick={() => {
                                        navigator.share?.({
                                          title: "Join theKickBack",
                                          text: "Skip the waitlist — use my invite link to join theKickBack",
                                          url: `https://join.thekickback.net?ref=${k.key}`,
                                        }).catch(() => {});
                                      }}
                                      className="rounded-md px-2 py-1 font-sans text-[9px] font-bold active:scale-95"
                                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                                    >
                                      Share
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 font-sans text-[9px] text-white/20">Share a key with friends to let them skip the waitlist.</p>
                      </div>
                    )}

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

                    {/* KickBack Pass */}
                    <a
                      href={`https://thekickback.net/wallet/pass/${user.authId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 active:scale-[0.98]"
                      style={{ background: `linear-gradient(135deg, ${tierColor}15, ${tierColor}05)`, border: `1px solid ${tierColor}25` }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tierColor}20` }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tierColor} strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-sans text-[13px] font-bold text-white/90">Get KickBack Pass</p>
                        <p className="font-sans text-[9px] text-white/30">Add to Apple Wallet — your stats, tier, and balance</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </a>

                    {/* Memberships */}
                    {memberships.length > 0 && (
                      <div className="mt-3">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MEMBERSHIPS</span>
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {memberships.map((m) => (
                            <div key={m.venue_id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
                              <span className="text-[14px]">{"\u{1F451}"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-sans text-[12px] font-semibold text-white/80">{m.venue_name}</p>
                                <p className="font-sans text-[9px] text-white/30">{m.tier} · expires {new Date(m.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Perks */}
                    {perks.length > 0 && (
                      <div className="mt-3">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">PERKS YOU CAN CLAIM</span>
                        <div className="mt-1.5 flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                          {perks.slice(0, 8).map((p) => (
                            <div key={p.id} className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", width: 90 }}>
                              <span className="font-sans text-[11px] font-semibold text-white/70 text-center leading-tight line-clamp-2">{p.name}</span>
                              <span className="mt-1 font-mono text-[10px] font-bold text-orange">{p.point_cost} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Venue badges */}
                    {user.venueProfiles.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between px-1">
                          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">VENUES VISITED</span>
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

                    {/* My Collectibles */}
                    {myCollectibles.length > 0 && (() => {
                      // Group by hub
                      const groups = new Map<string, typeof myCollectibles>();
                      for (const c of myCollectibles) {
                        const key = c.hub_id || "network";
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(c);
                      }
                      return (
                        <div className="mt-3">
                          <div className="mb-2 flex items-center justify-between px-1">
                            <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MY COLLECTIBLES</span>
                            <span className="font-mono text-[11px] font-bold text-white/40">{myCollectibles.length}</span>
                          </div>
                          {Array.from(groups.entries()).map(([hubKey, items]) => {
                            const hubName = items[0]?.hub_name || "Network";
                            return (
                              <div key={hubKey} className="mb-2">
                                <p className="mb-1 px-1 font-sans text-[9px] font-semibold text-white/20">{hubName}</p>
                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                                  {items.map((c) => {
                                    const emoji = c.asset_type === "sticker" ? "\u{1F3F7}\uFE0F" : c.asset_type === "badge" ? "\u{1F3C5}" : "\u{1F4CC}";
                                    const color = c.asset_type === "sticker" ? "#4ADE80" : c.asset_type === "badge" ? "#F97316" : "#A78BFA";
                                    return (
                                      <button
                                        key={c.unlock_id}
                                        onClick={() => {
                                          const v = venues.find((v) => v.id === c.hub_id);
                                          if (v) {
                                            onVenueSelect(v);
                                            setTimeout(() => send(`Tell me about my ${c.name} ${c.asset_type}`), 300);
                                          }
                                        }}
                                        className="flex shrink-0 flex-col items-center active:scale-95"
                                        style={{ width: 64 }}
                                      >
                                        <div
                                          className="flex h-12 w-12 items-center justify-center rounded-full"
                                          style={{
                                            background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                                            border: `2px solid ${color}30`,
                                            boxShadow: `0 0 8px ${color}15`,
                                          }}
                                        >
                                          <span className="text-[20px]">{emoji}</span>
                                        </div>
                                        <p className="mt-1 w-full truncate text-center font-sans text-[8px] font-medium text-white/40">{c.name}</p>
                                        <span className="font-sans text-[7px] font-bold" style={{ color }}>
                                          {c.asset_type === "3d_pin" ? "3D" : c.asset_type.toUpperCase()}
                                        </span>
                                        {c.is_animated && <span className="text-[6px] text-white/15">{"\u2728"}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* AI Wallet */}
                <WalletSheet />

                {/* Device Management */}
                <DeviceManager key={deviceRefreshKey} />

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

      {/* ═══ ABOUT SHEET ═══ */}
      <AnimatePresence>
        {showAbout && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAbout(false)}
              className="fixed inset-0 z-[100]"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[101] rounded-t-3xl"
              style={{ backgroundColor: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "70dvh" }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="font-sans text-[14px] font-bold text-white/80">About</span>
                <button onClick={() => setShowAbout(false)} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "calc(70dvh - 60px)" }}>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="h-10 w-auto" />
                  <span className="font-mono text-[12px] text-white/30">v{APP_VERSION}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    ["Version", APP_VERSION],
                    ["Build", `#${BUILD_NUMBER}`],
                    ["Built", BUILD_DATE],
                    ["Platform", "Progressive Web App"],
                    ["Runtime", "Next.js 16 + React 19"],
                    ["AI", "OpenClaw (OpenRouter)"],
                    ["Payments", "Stripe Connect"],
                    ["Auth", "Supabase OTP + WebAuthn"],
                    ["Maps", "Mapbox GL"],
                    ["Wallet", "Apple Wallet + Google Wallet"],
                    ["Email", "Resend (hub@thekickback.net)"],
                    ["Hosting", "Docker + Caddy on VPS"],
                    ["Workers", "Cloudflare Workers"],
                    ["Database", "Supabase (PostgreSQL)"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="font-sans text-[11px] text-white/30">{label}</span>
                      <span className="font-mono text-[11px] text-white/50">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-center font-sans text-[10px] text-white/15">
                  theKickBack Protocol &mdash; tap in, text in, you&rsquo;re in
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
