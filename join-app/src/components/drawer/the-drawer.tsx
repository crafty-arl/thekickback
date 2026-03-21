"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useAnimationControls } from "framer-motion";
import {
  type Venue,
  getVibeHexColor,
  getVibeLabel,
} from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { type CheckoutCardData, type CheckoutAddOn } from "../map/checkout-card";
import { useWalletStatus } from "../map/wallet-sheet";
import { usePasskey } from "@/lib/use-passkey";
import { sendOtp, verifyOtp } from "@/app/login/actions";
import { getDeviceId } from "@/lib/device-id";
import { APP_VERSION } from "@/lib/version";
import Image from "next/image";

import { DrawerPeek } from "./drawer-peek";
import { DrawerExplore } from "./drawer-explore";
import { DrawerVenue } from "./drawer-venue";
import { DrawerChat } from "./drawer-chat";
import { DrawerProfile } from "./drawer-profile";
import { DrawerLogin } from "./drawer-login";
import { DrawerCheckout } from "./drawer-checkout";

// ─── Re-export Tag so join-page-client can import from here ────
export type { Tag } from "../map/the-dock";
import type { Tag } from "../map/the-dock";

// ─── Types ───────────────────────────────────────────────────────

export type DrawerSnap = "peek" | "mid" | "full";
export type DrawerView = "explore" | "venue" | "chat" | "profile" | "login" | "checkout";

export interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
  checkout?: CheckoutCardData;
}

export type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "subscribe" | "join";

export interface OfferingMeta {
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  type: string;
}

export interface CartItem {
  offeringId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface Perk {
  id: string;
  venue_id: string;
  name: string;
  point_cost: number;
  category: string;
  description: string | null;
}

export interface VenueXpProfile {
  venue_id: string;
  xp: number;
  visits: number;
  venues?: { id: string; name: string; vibe: string };
  venue_xp_milestones?: { name: string; color: string; threshold: number } | null;
}

export interface UserProfile {
  authId: string;
  email: string;
  kickbackScore: number;
  totalEarned: number;
  tier: string;
  streak: number;
  venueProfiles: VenueXpProfile[];
}

interface RouteData {
  geometry: GeoJSON.LineString;
  color: string;
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

interface TheDrawerProps {
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

// ─── Constants ───────────────────────────────────────────────────

export const ACCENT = "#F97316";

export const TIER_CONFIG: Record<string, { color: string; label: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", label: "Explorer", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", label: "Regular", next: "Member", threshold: 1500 },
  member: { color: "#f97316", label: "Member", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", label: "VIP", next: "", threshold: Infinity },
};

export const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171", packed: "#f87171",
};

export const CATEGORY_ICONS: Record<string, string> = {
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

export const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Cafes", bar: "Bars", restaurant: "Eats", lounge: "Lounges",
  cowork: "Cowork", coworking: "Cowork", rooftop: "Rooftops", club: "Clubs",
  barbershop: "Barbershops", nail_salon: "Nail Salons",
};

export const VIBE_LABELS: Record<string, string> = {
  quiet: "Chill", moderate: "Lively", busy: "Poppin", lit: "Lit", packed: "Packed",
};

const VIBE_ORDER: Record<string, number> = { lit: 4, packed: 4, busy: 3, moderate: 2, quiet: 1 };

export const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  shop: "what can I buy or order here?",
  subscribe: "how can I stay updated on what's happening here?",
  join: "tell me about this venue and how to join",
};

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "shop", label: "Shop", icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2" },
  { id: "subscribe", label: "Subscribe", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { id: "join", label: "Join", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

export const PERK_EMOJI: Record<string, string> = { drink: "\u2615", food: "\ud83c\udf54", access: "\ud83d\udd11", experience: "\u2728", merch: "\ud83c\udf81", other: "\ud83c\udfaf" };

// ─── Helpers ─────────────────────────────────────────────────────

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function snapToHeight(snap: DrawerSnap): string {
  if (snap === "peek") return "80px";
  if (snap === "mid") return "45dvh";
  return "92dvh";
}

function buildVenueFromApi(av: ApiVenue): Venue {
  return {
    id: av.id, name: av.name, category: "lounge", neighborhood: av.neighborhood || "",
    vibe: (av.vibe || "quiet") as Venue["vibe"], occupancy: av.occupancy, capacity: av.capacity,
    description: "", tags: [], hours: "", memberOnly: false, textNumber: "",
    latitude: av.latitude || 0, longitude: av.longitude || 0, claimed: true,
  };
}

export function parseVenueChips(
  venues: Venue[], apiVenues: Record<string, ApiVenue>, richVenues: Record<string, RichVenue>,
  text: string, onTap: (venue: Venue) => void
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
                  {rv?.type && rv.type !== "venue" && <span className="rounded-md px-1.5 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{rv.type}</span>}
                  {(rv?.neighborhood || venue?.neighborhood) && <span className="font-sans text-[9px] text-white/20">{rv?.neighborhood || venue?.neighborhood}</span>}
                </div>
              </div>
              <button onClick={() => { if (venue) onTap(venue); }} className="ml-2 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-bold text-black active:scale-95" style={{ backgroundColor: vibeColor }}>
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
        <button key={i} onClick={() => { if (venue) onTap(venue); }} className="mx-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[12px] font-semibold active:scale-95" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          {displayName}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiMessageBody({ body, theme, onAddToCart, offeringsMap }: {
  body: string; theme: string;
  onAddToCart: (offeringId: string, name: string, priceCents: number) => void;
  offeringsMap: Record<string, OfferingMeta>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const parts = body.split(/(\[\[OFFER:[^\]]+\]\])/g);
  if (parts.length === 1) return <p className="font-sans text-[15px] leading-[1.6]">{body}</p>;
  const textParts: string[] = [];
  const offerParts: { id: string; name: string; price: number }[] = [];
  for (const part of parts) {
    const match = part.match(/\[\[OFFER:([^:]+):([^:]+):(\d+)\]\]/);
    if (match) offerParts.push({ id: match[1], name: match[2], price: parseInt(match[3]) / 100 });
    else if (part.trim()) textParts.push(part);
  }
  return (
    <div className="flex flex-col gap-2">
      {textParts.length > 0 && <p className="font-sans text-[15px] leading-[1.6]">{textParts.join("")}</p>}
      <div className="flex flex-col gap-1.5 mt-1">
        {offerParts.map((offer) => {
          const meta = offeringsMap[offer.id];
          const isExpanded = expandedId === offer.id;
          return (
            <div key={offer.id} className="rounded-xl overflow-hidden transition" style={{ backgroundColor: `${theme}10`, border: `1px solid ${theme}25` }}>
              {isExpanded && meta?.image_url && (
                <div className="relative" style={{ height: 120 }}>
                  <img src={meta.image_url} alt={offer.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)" }} />
                </div>
              )}
              <button onClick={() => setExpandedId(isExpanded ? null : offer.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:opacity-80">
                {!isExpanded && meta?.image_url && <img src={meta.image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-[15px] font-medium text-white/85">{offer.name}</span>
                  {isExpanded && meta?.description && <p className="mt-0.5 font-sans text-[12px] leading-[1.4] text-white/40">{meta.description}</p>}
                </div>
                <span className="shrink-0 font-mono text-[18px] font-bold" style={{ color: theme }}>${offer.price % 1 === 0 ? offer.price : offer.price.toFixed(2)}</span>
                <button onClick={(e) => { e.stopPropagation(); onAddToCart(offer.id, offer.name, Math.round(offer.price * 100)); }} className="shrink-0 rounded-full px-2.5 py-1 font-sans text-[12px] font-bold active:scale-90" style={{ backgroundColor: theme, color: "#000" }}>ADD</button>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LoadingDots() {
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

// ─── Main Component ──────────────────────────────────────────────

export function TheDrawer({
  venues, selectedVenue, onVenueSelect, userLocation, onRecenter, hasLocation,
  activeTag, onTagSelect, onNavigateVenue, onRouteChange, mapRef: parentMapRef,
}: TheDrawerProps) {

  // ── Snap + view state ──
  const [snap, setSnap] = useState<DrawerSnap>("peek");
  const [view, setView] = useState<DrawerView>("explore");
  const [showAbout, setShowAbout] = useState(false);

  // ── Chat state ──
  const [conciergeMessages, setConciergeMessages] = useState<Message[]>([
    { id: "welcome", sender: "ai", body: "Hey. I'm KickBack. Ask me anything \u2014 what's happening tonight, where to go, or vibe check a spot.", timestamp: Date.now() },
  ]);
  const [venueThreads, setVenueThreads] = useState<Map<string, Message[]>>(new Map());
  const [hasSentTabCommands, setHasSentTabCommands] = useState<Map<string, Set<Tab>>>(new Map());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // ── User / profile state ──
  const [user, setUser] = useState<UserProfile | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [memberships, setMemberships] = useState<{ venue_id: string; venue_name: string; tier: string; expires_at: string }[]>([]);
  const [balance, setBalance] = useState(0);
  const [myCollectibles, setMyCollectibles] = useState<{ unlock_id: string; asset_id: string; name: string; asset_type: string; category: string; description: string | null; is_animated: boolean; hub_id: string | null; hub_name: string; payment_method: string; unlocked_at: string }[]>([]);
  const [referralKeys, setReferralKeys] = useState<{ id: string; key: string; used_by_email: string | null }[]>([]);

  // ── Offerings ──
  const [offeringsMap, setOfferingsMap] = useState<Record<string, Record<string, OfferingMeta>>>({});
  const [venueOfferings, setVenueOfferings] = useState<Record<string, { id: string; type: string; name: string }[]>>({});
  const [exploreOfferings, setExploreOfferings] = useState<{ id: string; name: string; type: string; price_cents: number; venue_id: string; description: string | null; image_url: string | null; category: string | null }[]>([]);
  const [exploreDigitalAssets, setExploreDigitalAssets] = useState<{ id: string; name: string; asset_type: string; category: string; venue_id: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }[]>([]);
  const exploreOfferingsLoaded = useRef(false);

  // ── Cart ──
  const [carts, setCarts] = useState<Map<string, CartItem[]>>(new Map());
  const [cartExpanded, setCartExpanded] = useState(false);

  // ── Wallet / passkey ──
  const walletStatus = useWalletStatus();
  const passkey = usePasskey();
  const [paymentMode, setPaymentMode] = useState<"choose" | "processing" | null>(null);
  const [deviceRefreshKey, setDeviceRefreshKey] = useState(0);

  // ── Navigation ──
  const [navInfo, setNavInfo] = useState<{ steps: { instruction: string; distance: number; duration: number }[]; distance: number; duration: number; profile: "walking" | "driving" } | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navProfile, setNavProfile] = useState<"walking" | "driving">("walking");

  // ── Concierge venue data ──
  const [apiVenues, setApiVenues] = useState<Record<string, ApiVenue>>({});
  const [richVenues, setRichVenues] = useState<Record<string, RichVenue>>({});

  // ── Refs ──
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conciergeHistoryLoaded = useRef(false);

  // ── Derived ──
  const currentVenueMessages = selectedVenue ? (venueThreads.get(selectedVenue.id) || []) : [];
  const currentCart = selectedVenue ? (carts.get(selectedVenue.id) || []) : [];
  const cartTotal = currentCart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const cartCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);
  const tierColor = TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8";
  const vibeColor = selectedVenue ? (selectedVenue.themeColor || "#F97316") : ACCENT;

  // ── Cart helpers ──
  const addToCart = useCallback((venueId: string, offeringId: string, name: string, priceCents: number) => {
    setCarts((prev) => {
      const next = new Map(prev);
      const items = [...(next.get(venueId) || [])];
      const existing = items.find((i) => i.offeringId === offeringId);
      if (existing) existing.quantity += 1;
      else items.push({ offeringId, name, priceCents, quantity: 1 });
      next.set(venueId, items);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((venueId: string, offeringId: string) => {
    setCarts((prev) => {
      const next = new Map(prev);
      const items = (next.get(venueId) || []).map((i) => i.offeringId === offeringId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0);
      if (items.length === 0) next.delete(venueId); else next.set(venueId, items);
      return next;
    });
    if (currentCart.length <= 1) setCartExpanded(false);
  }, [currentCart.length]);

  const clearCart = useCallback((venueId: string) => {
    setCarts((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
    setCartExpanded(false);
  }, []);

  const clearThread = useCallback((venueId: string) => {
    setVenueThreads((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
  }, []);

  const clearConcierge = useCallback(() => {
    setConciergeMessages([{ id: "welcome", sender: "ai", body: "Hey. I\u2019m KickBack. Ask me anything \u2014 what\u2019s happening tonight, where to go, or vibe check a spot.", timestamp: Date.now() }]);
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
      setNavInfo({
        steps: route.legs[0].steps.map((s: { maneuver: { instruction: string }; distance: number; duration: number }) => ({ instruction: s.maneuver.instruction, distance: s.distance, duration: s.duration })),
        distance: route.distance, duration: route.duration, profile,
      });
      const color = selectedVenue ? getVibeHexColor(selectedVenue.vibe) : ACCENT;
      onRouteChange?.({ geometry: route.geometry, color });
      const coords2 = route.geometry.coordinates as [number, number][];
      const lngs = coords2.map((c) => c[0]);
      const lats = coords2.map((c) => c[1]);
      parentMapRef?.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 100, bottom: 350, left: 60, right: 60 }, duration: 1000 }
      );
    } catch { setNavInfo(null); } finally { setNavLoading(false); }
  }, [userLocation, selectedVenue, onRouteChange, parentMapRef]);

  const clearNav = useCallback(() => { setNavInfo(null); onRouteChange?.(null); }, [onRouteChange]);

  const openInMaps = useCallback(() => {
    if (!selectedVenue) return;
    const { latitude, longitude } = selectedVenue;
    const label = encodeURIComponent(selectedVenue.name);
    const mode = navProfile === "walking" ? "w" : "d";
    const appleUrl = `maps://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=${mode}&q=${label}`;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${navProfile}`;
    const w = window.open(appleUrl, "_blank");
    if (!w || w.closed) window.open(googleUrl, "_blank");
  }, [selectedVenue, navProfile]);

  useEffect(() => { if (!selectedVenue) clearNav(); }, [selectedVenue, clearNav]);

  // ── Animate drawer on snap change ──
  useEffect(() => {
    controls.start({
      height: snapToHeight(snap),
      borderRadius: snap === "peek" ? "28px" : snap === "full" ? "24px 24px 0 0" : "20px",
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [snap, controls]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conciergeMessages, venueThreads, selectedVenue]);

  // ── Keyboard resize handler ──
  useEffect(() => {
    const handleResize = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // ── Load thread history ──
  const loadThreadHistory = useCallback(async (venueId: string | null) => {
    try {
      const url = venueId ? `/api/threads?venueId=${venueId}` : "/api/threads?master=true";
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.messages?.length) return null;
      return data.messages.map((m: { id: string; sender_type: string; body: string; created_at: string }) => ({
        id: m.id, sender: m.sender_type as "guest" | "ai", body: m.body, timestamp: new Date(m.created_at).getTime(),
      })) as Message[];
    } catch { return null; }
  }, []);

  // ── Load explore offerings ──
  useEffect(() => {
    if (view !== "explore" || snap === "peek" || exploreOfferingsLoaded.current) return;
    exploreOfferingsLoaded.current = true;
    const claimed = venues.filter((v) => v.claimed !== false).slice(0, 15);
    Promise.all(claimed.map((v) => fetch(`/api/offerings?venueId=${v.id}`).then((r) => r.ok ? r.json() : { offerings: [] }).then((d) => (d.offerings || []).map((o: { id: string; name: string; type: string; price_cents: number; description: string | null; image_url?: string | null; category?: string | null }) => ({ ...o, venue_id: v.id, image_url: o.image_url || null, category: o.category || null }))).catch(() => []))).then((results) => setExploreOfferings(results.flat()));
    Promise.all(claimed.map((v) => fetch(`/api/digital-assets?venueId=${v.id}`).then((r) => r.ok ? r.json() : { assets: [] }).then((d) => (d.assets || []).map((a: { id: string; name: string; asset_type: string; category: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }) => ({ ...a, venue_id: v.id }))).catch(() => []))).then((results) => setExploreDigitalAssets(results.flat()));
  }, [view, snap, venues]);

  // ── Load concierge history on first open ──
  useEffect(() => {
    if (view !== "explore" || conciergeHistoryLoaded.current) return;
    // Delay concierge history loading — only when chat is opened
  }, [view]);

  // ── Sync selectedVenue → view ──
  useEffect(() => {
    if (selectedVenue) {
      if (!user) {
        setView("venue");
        setSnap("mid");
        return;
      }
      setView("venue");
      setSnap("mid");
      setActiveTab("chat");
      if (venueThreads.has(selectedVenue.id)) return;
      const isGhost = selectedVenue.claimed === false;
      const welcomeBody = isGhost
        ? `Hey \u2014 I know a bit about ${selectedVenue.name} from public info. ${selectedVenue.category ? `It's a ${selectedVenue.category}` : ""}${selectedVenue.neighborhood ? ` in ${selectedVenue.neighborhood}` : ""}. Ask me what you want to know.`
        : `Welcome to ${selectedVenue.name}. ${getVibeLabel(selectedVenue.vibe)} right now, ${selectedVenue.occupancy} people. Ask me anything.`;
      const welcomeMsg: Message = { id: `welcome-${selectedVenue.id}`, sender: "ai", body: welcomeBody, timestamp: Date.now() };
      setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [welcomeMsg]); return next; });
      const vid = selectedVenue.id;
      loadThreadHistory(vid).then((messages) => { if (messages?.length) setVenueThreads((prev) => { const next = new Map(prev); next.set(vid, messages); return next; }); });
      if (!venueOfferings[vid]) {
        fetch(`/api/offerings?venueId=${vid}`).then((r) => r.ok ? r.json() : { offerings: [] }).then((d) => { if (d.offerings?.length) setVenueOfferings((prev) => ({ ...prev, [vid]: d.offerings.map((o: { id: string; type: string; name: string }) => ({ id: o.id, type: o.type, name: o.name })) })); }).catch(() => {});
      }
    } else {
      if (view === "venue" || view === "chat") {
        setView("explore");
        setSnap("mid");
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
          authId: authUser.id, email: authUser.email,
          kickbackScore: data.balance?.kickback_score || data.balance?.total_earned || 0,
          totalEarned: data.balance?.total_earned || 0,
          tier: data.balance?.tier || "explorer",
          streak: data.balance?.current_streak || 0,
          venueProfiles: data.venueProfiles || [],
        });
        setBalance(data.balance?.balance || 0);
        try { const mRes = await fetch("/api/points?memberships=true"); if (mRes.ok) { const mData = await mRes.json(); if (mData.memberships) setMemberships(mData.memberships); } } catch {}
        const allPerks: Perk[] = [];
        for (const v of venues.filter((v) => v.claimed !== false).slice(0, 10)) {
          try { const pRes = await fetch(`/api/points?venueId=${v.id}`); const pData = await pRes.json(); if (pData.perks) allPerks.push(...pData.perks); } catch {}
        }
        setPerks(allPerks);
        try { const cRes = await fetch("/api/my-collectibles"); if (cRes.ok) { const cData = await cRes.json(); if (cData.collectibles) setMyCollectibles(cData.collectibles); } } catch {}
        try { const rkRes = await fetch("/api/referral-keys"); if (rkRes.ok) { const rkData = await rkRes.json(); if (rkData.keys) setReferralKeys(rkData.keys); } } catch {}
      } catch {
        setUser({ authId: authUser.id, email: authUser.email, kickbackScore: 0, totalEarned: 0, tier: "explorer", streak: 0, venueProfiles: [] });
      }
    });
  }, [venues]);

  // ── Tag generation ──
  const tags = useMemo(() => {
    const result: Tag[] = [];
    const seen = new Set<string>();
    const catGroups = new Map<string, string[]>();
    for (const v of venues) { const cat = v.category?.toLowerCase(); if (!cat || cat === "venue" || cat === "other") continue; if (!catGroups.has(cat)) catGroups.set(cat, []); catGroups.get(cat)!.push(v.id); }
    for (const [cat, ids] of catGroups) { if (ids.length === 0) continue; const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1); if (seen.has(label)) continue; seen.add(label); result.push({ id: `cat-${cat}`, label, type: "category", color: "#a78bfa", venueIds: ids }); }
    const vibeGroups = new Map<string, string[]>();
    for (const v of venues) { if (!vibeGroups.has(v.vibe)) vibeGroups.set(v.vibe, []); vibeGroups.get(v.vibe)!.push(v.id); }
    for (const [vibe, ids] of vibeGroups) { const label = VIBE_LABELS[vibe] || vibe; if (seen.has(label)) continue; seen.add(label); result.push({ id: `vibe-${vibe}`, label, type: "vibe", color: getVibeHexColor(vibe), venueIds: ids }); }
    const hoodGroups = new Map<string, string[]>();
    for (const v of venues) { const hood = v.neighborhood?.trim(); if (!hood) continue; if (!hoodGroups.has(hood)) hoodGroups.set(hood, []); hoodGroups.get(hood)!.push(v.id); }
    for (const [hood, ids] of hoodGroups) { if (ids.length < 1 || seen.has(hood)) continue; seen.add(hood); result.push({ id: `hood-${hood}`, label: hood, type: "neighborhood", color: "#60a5fa", venueIds: ids }); }
    for (const v of venues) { if (v.claimed === false) continue; result.push({ id: `venue-${v.id}`, label: v.name, type: "venue", color: v.themeColor || getVibeHexColor(v.vibe), venueIds: [v.id] }); }
    return result;
  }, [venues]);

  // ── Shelf memos ──
  const claimedVenues = useMemo(() => venues.filter((v) => v.claimed !== false), [venues]);
  const happeningNow = useMemo(() => [...claimedVenues].sort((a, b) => (VIBE_ORDER[b.vibe] || 0) - (VIBE_ORDER[a.vibe] || 0)).slice(0, 10), [claimedVenues]);
  const quietSpots = useMemo(() => claimedVenues.filter((v) => v.vibe === "quiet" || v.vibe === "moderate"), [claimedVenues]);
  const nearYou = useMemo(() => {
    if (!userLocation) return [];
    return [...venues].map((v) => ({ venue: v, dist: getDistance(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) })).sort((a, b) => a.dist - b.dist).slice(0, 10);
  }, [venues, userLocation]);
  const yourSpots = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    return user.venueProfiles.map((vp) => { const venue = venues.find((v) => v.id === vp.venue_id); return venue ? { venue, xp: vp.xp } : null; }).filter(Boolean) as { venue: Venue; xp: number }[];
  }, [venues, user]);
  const recommended = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    const visitedVenueIds = new Set(user.venueProfiles.map((vp) => vp.venue_id));
    const visitedCategories = new Set(user.venueProfiles.map((vp) => venues.find((v) => v.id === vp.venue_id)?.category).filter(Boolean));
    return claimedVenues.filter((v) => !visitedVenueIds.has(v.id) && visitedCategories.has(v.category)).slice(0, 10);
  }, [claimedVenues, venues, user]);
  const affordablePerks = useMemo(() => perks.sort((a, b) => a.point_cost - b.point_cost), [perks]);
  const venueNameMap = useMemo(() => { const m = new Map<string, string>(); for (const v of venues) m.set(v.id, v.name); return m; }, [venues]);

  // ── Quick replies ──
  const getVenueReplies = useCallback((): { label: string; action: string }[] => {
    if (!selectedVenue) return [];
    const offerings = venueOfferings[selectedVenue.id] || [];
    const cart = carts.get(selectedVenue.id) || [];
    const msgCount = currentVenueMessages.length;
    const lastAi = [...currentVenueMessages].reverse().find((m) => m.sender === "ai");
    if (lastAi && (/confirmed|all set|order.*placed/i.test(lastAi.body))) {
      const replies = [{ label: "Anything else?", action: "anything else?" }, { label: "What's happening later?", action: "what's happening later?" }];
      if (user) replies.unshift({ label: "Add to Wallet", action: "__WALLET_PASS__" });
      return replies;
    }
    if (cart.length > 0) return [{ label: `Checkout (${cart.reduce((s, i) => s + i.quantity, 0)} items)`, action: "__CHECKOUT__" }, { label: "Add more", action: "what else do you have?" }, { label: "Clear cart", action: "__CLEAR_CART__" }];
    const offersShown = currentVenueMessages.some((m) => m.sender === "ai" && m.body.includes("[[OFFER:"));
    if (offersShown && offerings.length > 0) {
      const products = offerings.filter((o) => o.type === "product" || o.type === "service");
      const replies: { label: string; action: string }[] = products.slice(0, 2).map((o) => ({ label: `Order the ${o.name}`, action: `I'd like to order the ${o.name}` }));
      replies.push({ label: "What's popular?", action: "what's popular here?" });
      return replies;
    }
    if (msgCount <= 2) {
      const types = new Set(offerings.map((o) => o.type));
      const replies: { label: string; action: string }[] = [];
      if (types.has("product") || types.has("service")) {
        if (offerings.some((o) => o.type === "product")) replies.push({ label: "See the menu", action: "show me the menu" });
        if (offerings.some((o) => o.type === "service")) { const svc = offerings.find((o) => o.type === "service"); replies.push({ label: `Book a ${svc?.name || "service"}`, action: `I'd like to book a ${svc?.name || "service"}` }); }
      }
      if (types.has("event")) replies.push({ label: "What's happening tonight?", action: "any events tonight?" });
      if (types.has("membership")) replies.push({ label: "Tell me about membership", action: "tell me about membership" });
      if (types.has("reservation")) replies.push({ label: "Reserve a spot", action: "I'd like to reserve a spot" });
      replies.push({ label: "What's the vibe?", action: "what's the vibe right now?" });
      return replies.slice(0, 4);
    }
    return [];
  }, [selectedVenue, venueOfferings, carts, currentVenueMessages, user]);

  // ── Send message ──
  const send = useCallback(async (text?: string) => {
    if (!user) return;
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const userMsg: Message = { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() };

    if (selectedVenue && (view === "venue" || view === "chat")) {
      if (snap === "mid" && view === "venue") { setView("chat"); setSnap("full"); }
      else if (view === "venue") { setView("chat"); setSnap("full"); }
      // Cart special actions
      if (msg === "__CHECKOUT__") {
        setInput("");
        const cart = carts.get(selectedVenue.id) || [];
        if (cart.length === 0) return;
        const checkoutData: CheckoutCardData = {
          venue_name: selectedVenue.name, venue_id: selectedVenue.id,
          items: cart.map((item) => ({ offering_id: item.offeringId, slot_id: null, name: item.name, quantity: item.quantity, unit_price_cents: item.priceCents })),
        };
        const checkoutMsg: Message = { id: `checkout-${Date.now()}`, sender: "ai", body: "Here's your order \u2014 review and confirm when ready.", timestamp: Date.now(), checkout: checkoutData };
        setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), checkoutMsg]); return next; });
        setCartExpanded(false);
        return;
      }
      if (msg === "__WALLET_PASS__") { setInput(""); if (user) window.open(`https://thekickback.net/wallet/pass/${user.authId}`, "_blank"); return; }
      if (msg === "__CLEAR_CART__") {
        setInput(""); clearCart(selectedVenue.id);
        const clearMsg: Message = { id: `clear-${Date.now()}`, sender: "ai", body: "Cart cleared. What else can I help with?", timestamp: Date.now() };
        setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), clearMsg]); return next; });
        return;
      }
      if (msg.toLowerCase() === "sign out" || msg.toLowerCase() === "signout") {
        const supabase = createClient();
        await supabase.auth.signOut();
        setVenueThreads((prev) => { const next = new Map(prev); const thread = [...(next.get(selectedVenue.id) || []), userMsg, { id: `signout-${Date.now()}`, sender: "ai" as const, body: "You've been signed out.", timestamp: Date.now() }]; next.set(selectedVenue.id, thread); return next; });
        setInput(""); return;
      }
      setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), userMsg]); return next; });
      setInput(""); setLoading(true);
      try {
        const isGhost = selectedVenue.claimed === false;
        const chatUrl = isGhost ? "/api/chat/ghost" : "/api/chat";
        const chatBody = isGhost
          ? { message: msg, venueId: selectedVenue.id, venueName: selectedVenue.name, category: selectedVenue.category, neighborhood: selectedVenue.neighborhood, description: selectedVenue.description, tags: selectedVenue.tags }
          : { message: msg, venueId: selectedVenue.id, venueName: selectedVenue.name, vibe: selectedVenue.vibe, occupancy: selectedVenue.occupancy };
        const res = await fetch(chatUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(chatBody) });
        const data = await res.json();
        if (data.offerings && Object.keys(data.offerings).length > 0) setOfferingsMap((prev) => ({ ...prev, [selectedVenue.id]: { ...(prev[selectedVenue.id] || {}), ...data.offerings } }));
        const cardTab = data.card || (activeTab !== "chat" ? activeTab : undefined);
        const aiMsg: Message = { id: `ai-${Date.now()}`, sender: "ai", body: data.reply || "Couldn't reach the venue right now. Try again.", timestamp: Date.now(), tab: cardTab as Tab | undefined };
        if (data.checkout) aiMsg.checkout = { ...data.checkout, venue_name: selectedVenue.name, venue_id: selectedVenue.id };
        if (data.booking?.booking) {
          const bk = data.booking.booking;
          const bkStart = bk.start ? new Date(bk.start) : null;
          const dateStr = bkStart ? bkStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
          const timeStr = bkStart ? bkStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          const bkEnd = bk.end ? new Date(bk.end) : null;
          const endTimeStr = bkEnd ? bkEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          aiMsg.body += `\n\nBooking confirmed: ${data.booking.message || ""}${dateStr ? `\nDate: ${dateStr}` : ""}${timeStr ? `\nTime: ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}` : ""}${user ? `\n\nAdd to Apple Wallet: https://thekickback.net/wallet/pass/${user.authId}` : ""}`;
        }
        setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), aiMsg]); return next; });
      } catch {
        setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() }]); return next; });
      } finally { setLoading(false); inputRef.current?.focus(); }
    } else {
      // Concierge chat
      setConciergeMessages((prev) => [...prev, userMsg]);
      setInput(""); setLoading(true);
      try {
        const res = await fetch("/api/chat/general", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
        const data = await res.json();
        if (data.venues?.length) {
          setApiVenues((prev) => { const next = { ...prev }; for (const v of data.venues) next[v.id] = v; return next; });
          setRichVenues((prev) => { const next = { ...prev }; for (const v of data.venues) next[v.id] = v; return next; });
        }
        setConciergeMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: "ai", body: data.reply || "Something went wrong. Try again in a moment.", timestamp: Date.now() }]);
      } catch {
        setConciergeMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() }]);
      } finally { setLoading(false); inputRef.current?.focus(); }
    }
  }, [input, loading, selectedVenue, view, snap, activeTab, carts, clearCart, user]);

  // ── Tab tap ──
  const handleTabTap = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (!selectedVenue) return;
    const cmd = TAB_COMMANDS[tab];
    if (!cmd) return;
    const venueId = selectedVenue.id;
    const sentForVenue = hasSentTabCommands.get(venueId) || new Set<Tab>();
    if (sentForVenue.has(tab)) return;
    setHasSentTabCommands((prev) => { const next = new Map(prev); const s = new Set(next.get(venueId) || []); s.add(tab); next.set(venueId, s); return next; });
    send(cmd);
  }, [selectedVenue, hasSentTabCommands, send]);

  // ── Checkout / payment ──
  const processPayment = useCallback(async (msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card") => {
    if (!selectedVenue || !msg.checkout) return;
    setPaymentMode("processing");
    const itemsTotal = msg.checkout.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price_cents, 0);
    const subtotal = itemsTotal + addOnsTotal - pointsToSpend;
    try {
      if (method === "wallet") {
        const spendRes = await fetch("/api/wallet/spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: subtotal, venueId: selectedVenue.id, description: `Order at ${selectedVenue.name}` }) });
        const spendResult = await spendRes.json();
        if (!spendRes.ok) throw new Error(spendResult.error || "Wallet spend failed");
      }
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venueId: selectedVenue.id, items: msg.checkout.items, addOns, pointsToSpend, notes: msg.checkout.notes, paymentMethod: method }) });
      const result = await res.json();
      const walletPassNote = result.orderId && user ? `\n\nAdd your pass to Apple Wallet: https://thekickback.net/wallet/pass/${user.authId}` : "";
      const itemNames = msg.checkout.items.map((i: { name: string; quantity?: number }) => i.quantity && i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name).join(", ");
      const bonusPts = Math.floor(subtotal / 10);
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed: ${itemNames}. Total: $${(subtotal / 100).toFixed(2)}.${method === "wallet" ? " Paid from AI Credit." : " Charged to card on file."}${pointsToSpend > 0 ? ` Used ${pointsToSpend} points.` : ""}${bonusPts > 0 ? ` +${bonusPts} XP earned!` : ""} Show this to the host when you arrive.${walletPassNote}`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), confirmMsg]); return next; });
      if (result.orderId) {
        clearCart(selectedVenue.id);
        walletStatus?.refresh?.();
        fetch("/api/points").then((r) => r.ok ? r.json() : null).then((data) => {
          if (data?.balance && user) setUser({ ...user, kickbackScore: data.balance.kickback_score || data.balance.total_earned || user.kickbackScore, totalEarned: data.balance.total_earned || user.totalEarned, tier: data.balance.tier || user.tier, streak: data.balance.current_streak || user.streak, venueProfiles: data.venueProfiles || user.venueProfiles });
        }).catch(() => {});
      }
    } catch {
      setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Couldn't process the order. Try again.", timestamp: Date.now() }]); return next; });
    } finally { setPaymentMode(null); }
  }, [selectedVenue, clearCart, walletStatus, user]);

  const handleCheckoutConfirm = useCallback(async (msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card" = "card") => {
    if (!selectedVenue || !msg.checkout) return;
    if (method === "wallet") {
      let verified = false;
      if (passkey.hasPasskey) verified = await passkey.verify();
      if (!verified) {
        setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `bio-setup-${Date.now()}`, sender: "ai", body: "Setting up biometric on this device for wallet payments. Follow the prompt.", timestamp: Date.now() }]); return next; });
        const registered = await passkey.register();
        if (!registered) {
          setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `bio-${Date.now()}`, sender: "ai", body: "Biometric setup cancelled. Pay with card instead \u2014 no biometric needed.", timestamp: Date.now() }]); return next; });
          return;
        }
        verified = await passkey.verify();
        if (!verified) {
          setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `bio-err-${Date.now()}`, sender: "ai", body: "Verification failed. Try card payment instead.", timestamp: Date.now() }]); return next; });
          return;
        }
      }
    }
    await processPayment(msg, addOns, pointsToSpend, method);
  }, [selectedVenue, passkey, processPayment]);

  const handleCheckoutDismiss = useCallback(() => {
    if (!selectedVenue) return;
    setVenueThreads((prev) => { const next = new Map(prev); next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `cancel-${Date.now()}`, sender: "ai", body: "No worries \u2014 let me know if you change your mind.", timestamp: Date.now() }]); return next; });
  }, [selectedVenue]);

  // ── Drag handling ──
  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info;
    const draggingDown = offset.y > 60 || velocity.y > 300;
    const draggingUp = offset.y < -60 || velocity.y < -300;
    if (snap === "peek" && draggingUp) setSnap("mid");
    else if (snap === "mid" && draggingUp) setSnap("full");
    else if (snap === "mid" && draggingDown) setSnap("peek");
    else if (snap === "full" && draggingDown) setSnap("mid");
  }

  // ── Handlers ──
  const handlePeekTap = useCallback(() => {
    if (snap === "peek") setSnap("mid");
  }, [snap]);

  const handleAvatarTap = useCallback(() => {
    if (!user) { setView("login"); setSnap("mid"); return; }
    setView("profile"); setSnap("mid");
  }, [user]);

  const handleBack = useCallback(() => {
    if (view === "chat") { setView("venue"); setSnap("mid"); return; }
    if (view === "profile" || view === "login") { setView("explore"); setSnap("mid"); return; }
    if (view === "venue") { onVenueSelect(null); return; }
    setSnap("peek");
  }, [view, onVenueSelect]);

  const handleVenueChat = useCallback(() => {
    if (!user) { setView("login"); setSnap("mid"); return; }
    setView("chat"); setSnap("full");
  }, [user]);

  const handleInputFocus = useCallback(() => {
    if (!user) return;
    if (snap === "peek") setSnap("mid");
    if (view === "explore" && !selectedVenue) {
      setView("chat"); setSnap("full"); // Open concierge
    } else if (view === "venue" && selectedVenue) {
      setView("chat"); setSnap("full");
    }
  }, [snap, view, selectedVenue, user]);

  // ═══════════════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════

  return (
    <>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-40"
      >
        <motion.div
          animate={controls}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDrag}
          className="relative flex flex-col overflow-hidden"
          style={{
            height: 80,
            borderRadius: "24px 24px 0 0",
            background: "rgba(10, 10, 14, 0.95)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 -2px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
            touchAction: "none",
          }}
        >
          {/* ── Peek state ── */}
          {snap === "peek" && (
            <DrawerPeek
              user={user}
              selectedVenue={selectedVenue}
              vibeColor={vibeColor}
              tierColor={tierColor}
              onTap={handlePeekTap}
              onSignIn={() => { setView("login"); setSnap("mid"); }}
            />
          )}

          {/* ── Mid / Full content ── */}
          {snap !== "peek" && (
            <>
              {/* Drag handle */}
              <div className="flex shrink-0 justify-center pt-2 pb-1">
                <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
              </div>

              {/* Login view */}
              {view === "login" && (
                <DrawerLogin
                  onSuccess={() => window.location.reload()}
                  onBack={handleBack}
                />
              )}

              {/* Explore view */}
              {view === "explore" && user && (
                <DrawerExplore
                  user={user}
                  venues={venues}
                  tags={tags}
                  activeTag={activeTag}
                  onTagSelect={onTagSelect}
                  onVenueSelect={onVenueSelect}
                  happeningNow={happeningNow}
                  nearYou={nearYou}
                  quietSpots={quietSpots}
                  yourSpots={yourSpots}
                  recommended={recommended}
                  affordablePerks={affordablePerks}
                  balance={balance}
                  venueNameMap={venueNameMap}
                  exploreOfferings={exploreOfferings}
                  exploreDigitalAssets={exploreDigitalAssets}
                  userLocation={userLocation}
                  tierColor={tierColor}
                  onAvatarTap={handleAvatarTap}
                  scrollRef={scrollRef}
                  send={send}
                  snap={snap}
                />
              )}

              {/* Explore — not logged in */}
              {view === "explore" && !user && (
                <DrawerLogin
                  onSuccess={() => window.location.reload()}
                  onBack={handleBack}
                />
              )}

              {/* Venue profile */}
              {view === "venue" && selectedVenue && (
                <DrawerVenue
                  venue={selectedVenue}
                  user={user}
                  vibeColor={vibeColor}
                  onBack={handleBack}
                  onChat={handleVenueChat}
                  walletStatus={walletStatus}
                  hasLocation={hasLocation}
                  navInfo={navInfo}
                  navLoading={navLoading}
                  navProfile={navProfile}
                  fetchDirections={fetchDirections}
                  clearNav={clearNav}
                  openInMaps={openInMaps}
                  scrollRef={scrollRef}
                />
              )}

              {/* Chat view */}
              {view === "chat" && user && (
                <DrawerChat
                  venue={selectedVenue}
                  user={user}
                  messages={currentVenueMessages}
                  conciergeMessages={conciergeMessages}
                  loading={loading}
                  input={input}
                  setInput={setInput}
                  send={send}
                  onBack={handleBack}
                  vibeColor={vibeColor}
                  offeringsMap={selectedVenue ? (offeringsMap[selectedVenue.id] || {}) : {}}
                  addToCart={(oid, name, price) => selectedVenue && addToCart(selectedVenue.id, oid, name, price)}
                  currentCart={currentCart}
                  cartTotal={cartTotal}
                  cartCount={cartCount}
                  cartExpanded={cartExpanded}
                  setCartExpanded={setCartExpanded}
                  removeFromCart={(oid) => selectedVenue && removeFromCart(selectedVenue.id, oid)}
                  clearCart={() => selectedVenue && clearCart(selectedVenue.id)}
                  getVenueReplies={getVenueReplies}
                  handleTabTap={handleTabTap}
                  handleCheckoutConfirm={handleCheckoutConfirm}
                  handleCheckoutDismiss={handleCheckoutDismiss}
                  walletStatus={walletStatus}
                  passkey={passkey}
                  paymentMode={paymentMode}
                  scrollRef={scrollRef}
                  inputRef={inputRef}
                  venues={venues}
                  apiVenues={apiVenues}
                  richVenues={richVenues}
                  onVenueSelect={onVenueSelect}
                  onClearThread={selectedVenue ? () => clearThread(selectedVenue.id) : undefined}
                  onClearConcierge={clearConcierge}
                />
              )}

              {/* Profile view */}
              {view === "profile" && user && (
                <DrawerProfile
                  user={user}
                  venues={venues}
                  perks={perks}
                  memberships={memberships}
                  referralKeys={referralKeys}
                  myCollectibles={myCollectibles}
                  tierColor={tierColor}
                  passkey={passkey}
                  onBack={handleBack}
                  onVenueSelect={onVenueSelect}
                  send={send}
                  deviceRefreshKey={deviceRefreshKey}
                  setDeviceRefreshKey={setDeviceRefreshKey}
                  setVenueThreads={setVenueThreads}
                  selectedVenue={selectedVenue}
                  scrollRef={scrollRef}
                />
              )}

              {/* Input bar (explore + chat) */}
              {(view === "explore" || view === "chat") && user && (
                <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    onFocus={handleInputFocus}
                    placeholder={view === "chat" ? "Ask anything..." : "Ask KickBack anything..."}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    className="min-w-0 flex-1 rounded-full px-4 font-sans text-[16px] text-white placeholder:text-white/25 focus:outline-none"
                    style={{ height: 48, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  {input.trim() && (
                    <motion.button
                      onClick={() => send()}
                      disabled={loading}
                      whileTap={{ scale: 0.9 }}
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                      style={{ backgroundColor: vibeColor, boxShadow: `0 2px 10px ${vibeColor}40` }}
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      {/* ═══ ABOUT SHEET ═══ */}
      <AnimatePresence>
        {showAbout && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAbout(false)} className="fixed inset-0 z-[100]" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed inset-x-0 bottom-0 z-[101] rounded-t-3xl" style={{ backgroundColor: "#0A0A0E", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "70dvh" }}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="font-sans text-[15px] font-bold text-white/80">About</span>
                <button onClick={() => setShowAbout(false)} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "calc(70dvh - 60px)" }}>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="h-10 w-auto" />
                  <span className="font-mono text-[12px] text-white/30">v{APP_VERSION}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
