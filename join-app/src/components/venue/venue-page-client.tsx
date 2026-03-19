"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import Image from "next/image";
import { VenueOfferings } from "./venue-offerings";
import { VenueGallery } from "./venue-gallery";
import { VenueStaff } from "./venue-staff";
import type { StaffMember } from "./venue-staff";
import { VibeCard, MenuCard, EventsCard, ReserveCard, ShopCard } from "../map/tab-cards";

/* ── Types ── */

interface Venue {
  id: string;
  name: string;
  state: string;
  occupancy: number;
  max_occupancy: number;
  vibe: string;
  rules: string[];
  address?: string;
  neighborhood?: string;
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

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

interface OfferingData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  price_cents: number;
  recurring: boolean;
  interval: string | null;
  perks: string[];
  active: boolean;
}

interface Props {
  page: VenuePage;
  venue: Venue;
  table?: string;
  ref?: string;
  user?: { id: string; email: string } | null;
  offerings: OfferingData[];
  gallery?: GalleryImage[];
  staff?: StaffMember[];
}

type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
}

/* ── Helpers ── */

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

function TabIcon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "shop", label: "Shop", icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  shop: "what can I buy or order here?",
};

/* ── Fake venue object for tab-cards (maps DB venue to lib/venues shape) ── */
function toCardVenue(venue: Venue) {
  return {
    id: venue.id,
    name: venue.name,
    category: "lounge" as const,
    neighborhood: venue.neighborhood || "",
    vibe: (venue.vibe || "quiet") as "quiet" | "moderate" | "busy" | "lit",
    occupancy: venue.occupancy,
    capacity: venue.max_occupancy,
    description: "",
    tags: [] as string[],
    hours: "",
    memberOnly: false,
    textNumber: "",
    latitude: 0,
    longitude: 0,
  };
}

/* ═══════════════════════════════════════════════════
   VENUE PAGE CLIENT — Immersive single-screen design
   ═══════════════════════════════════════════════════ */

export function VenuePageClient({ page, venue, table, user, offerings, gallery = [], staff = [] }: Props) {
  const color = vibeColor(venue.vibe);
  const theme = page.theme_color;
  const pct = Math.round((venue.occupancy / venue.max_occupancy) * 100);
  const cardVenue = toCardVenue(venue);

  /* ── Drawer state ── */
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const controls = useAnimationControls();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      body: `Welcome to ${venue.name}. ${vibeLabel(venue.vibe)} right now, ${venue.occupancy} people. Ask me anything.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentTabCommand = useRef<Set<Tab>>(new Set(["chat"]));

  /* ── Info panel ── */
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    controls.start({
      height: expanded ? "65dvh" : 56,
      borderRadius: expanded ? "24px 24px 0 0" : 28,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [expanded, controls]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!expanded) setExpanded(true);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "guest",
      body: msg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          venueId: venue.id,
          venueName: venue.name,
          vibe: venue.vibe,
          occupancy: venue.occupancy,
          table,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          body: data.reply || "Couldn't reach the venue right now.",
          timestamp: Date.now(),
          tab: activeTab,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again.", timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, venue, table, expanded, activeTab]);

  function handleTabTap(tab: Tab) {
    setActiveTab(tab);
    const cmd = TAB_COMMANDS[tab];
    if (cmd && !hasSentTabCommand.current.has(tab)) {
      hasSentTabCommand.current.add(tab);
      send(cmd);
    }
  }

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      if (expanded) setExpanded(false);
    } else if (info.offset.y < -60 || info.velocity.y < -300) {
      if (!expanded) setExpanded(true);
    }
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden text-white" style={{ backgroundColor: "#000" }}>
      {/* ═══ BACKGROUND: hero image or gradient ═══ */}
      <div className="absolute inset-0">
        {page.hero_image ? (
          <Image
            src={page.hero_image}
            alt={venue.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${theme}30 0%, transparent 60%), linear-gradient(to bottom, ${theme}10 0%, #000 100%)`,
            }}
          />
        )}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.95) 100%)" }} />
      </div>

      {/* ═══ TOP: Venue identity ═══ */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-[max(16px,env(safe-area-inset-top))]">
        {/* Back to map */}
        <div className="flex w-full items-center justify-between">
          <a
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="flex h-8 items-center gap-1.5 rounded-full px-3 backdrop-blur-md font-sans text-[11px] font-medium text-white/50"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Info
          </button>
        </div>

        {/* Venue name + LIVE badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-8 flex flex-col items-center gap-3 text-center sm:mt-12"
        >
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ backgroundColor: theme }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-black" />
            <span className="font-sans text-[10px] font-bold tracking-[1.5px] text-black">LIVE</span>
          </div>

          <h1 className="font-sans text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[40px]">
            {venue.name}
          </h1>

          {page.tagline && (
            <p className="font-sans text-[14px] text-white/40">{page.tagline}</p>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center gap-4"
        >
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-sans text-[12px] font-medium" style={{ color }}>{vibeLabel(venue.vibe)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="font-sans text-[12px] text-white/50">{venue.occupancy}/{venue.max_occupancy}</span>
            <span className="font-sans text-[12px] font-medium" style={{ color }}>{pct}%</span>
          </div>
          {venue.neighborhood && (
            <div className="rounded-full px-3 py-1.5 backdrop-blur-md font-sans text-[12px] text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {venue.neighborhood}
            </div>
          )}
        </motion.div>

        {/* Quick action pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 flex gap-2"
        >
          <a
            href={`https://thekickback.net/wallet/pass/${venue.id}/guest`}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[11px] font-medium text-white/50 backdrop-blur-md active:scale-95"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Wallet
          </a>
          {offerings.length > 0 && (
            <button
              onClick={() => setInfoOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[11px] font-medium backdrop-blur-md active:scale-95"
              style={{ backgroundColor: `${theme}20`, color: theme, border: `1px solid ${theme}30` }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Membership
            </button>
          )}
        </motion.div>

        {table && (
          <div className="mt-3 rounded-full px-3 py-1 backdrop-blur-md font-sans text-[11px] text-white/25" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
            Table {table}
          </div>
        )}
      </div>

      {/* ═══ INFO PANEL — slides over from right ═══ */}
      <AnimatePresence>
        {infoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoOpen(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-50 w-[85vw] max-w-md overflow-y-auto"
              style={{
                backgroundColor: "rgba(13,13,15,0.95)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-4">
                <h2 className="font-sans text-[16px] font-bold text-white">{venue.name}</h2>
                <button
                  onClick={() => setInfoOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-50">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col gap-5 px-5 pb-10">
                {/* Description */}
                {page.description && (
                  <p className="font-sans text-[13px] leading-relaxed text-white/40">{page.description}</p>
                )}

                {/* Gallery */}
                {gallery.length > 0 && (
                  <VenueGallery gallery={gallery} themeColor={theme} />
                )}

                {/* Staff */}
                {staff.length > 0 && (
                  <VenueStaff staff={staff} themeColor={theme} />
                )}

                {/* Offerings */}
                {offerings.length > 0 && (
                  <VenueOfferings offerings={offerings} themeColor={theme} venueName={venue.name} />
                )}

                {/* Address */}
                {venue.address && (
                  <div>
                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">LOCATION</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl p-3 active:opacity-80"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${theme}20` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-sans text-[13px] text-white/60">{venue.address}</p>
                        {venue.neighborhood && <p className="font-sans text-[11px] text-white/25">{venue.neighborhood}</p>}
                      </div>
                    </a>
                  </div>
                )}

                {/* Menu */}
                {page.menu_sections.length > 0 && (
                  <div>
                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MENU</p>
                    <div className="flex flex-col gap-3">
                      {page.menu_sections.map((section) => (
                        <div key={section.name} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <p className="mb-2 font-sans text-[13px] font-semibold text-white/60">{section.name}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {section.items.map((item) => (
                              <span key={item} className="rounded-lg px-2 py-1 font-sans text-[11px] text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hours */}
                {page.hours.length > 0 && (
                  <div>
                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">HOURS</p>
                    <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {page.hours.map((h) => (
                        <div key={h.day} className="flex justify-between py-1.5">
                          <span className="font-sans text-[12px] text-white/40">{h.day}</span>
                          <span className="font-sans text-[12px] text-white/60">{h.open} — {h.close}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rules */}
                {venue.rules?.length > 0 && (
                  <div>
                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">HOUSE RULES</p>
                    <div className="flex flex-col gap-1.5">
                      {venue.rules.map((rule) => (
                        <div key={rule} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme }} />
                          <span className="font-sans text-[12px] text-white/40">{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ COMMAND BAR — bottom, always visible ═══ */}
      <div
        className="fixed inset-x-0 bottom-0 z-30"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}
      >
        <motion.div
          animate={controls}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDrag}
          className="relative mx-3 flex flex-col overflow-hidden"
          style={{
            height: 56,
            borderRadius: 28,
            background: "rgba(15, 15, 18, 0.85)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.1), 0 -4px 40px rgba(0,0,0,0.3)`,
            touchAction: "none",
          }}
        >
          {/* Collapsed */}
          {!expanded && (
            <div className="flex h-full items-center gap-2 px-3">
              <button onClick={() => setExpanded(true)} className="flex items-center gap-2 pl-1">
                <motion.div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">
                  {venue.name}
                </span>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                onFocus={() => setExpanded(true)}
                placeholder="Ask anything..."
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
              />
            </div>
          )}

          {/* Expanded */}
          {expanded && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
                  <span className="font-sans text-[11px] text-white/30">{vibeLabel(venue.vibe)} · {pct}%</span>
                </div>
                <motion.button
                  onClick={() => setExpanded(false)}
                  whileTap={{ scale: 0.85 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </motion.button>
              </div>

              {/* Tabs */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex gap-1 px-3 pb-2"
              >
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => handleTabTap(tab.id)}
                      whileTap={{ scale: 0.92 }}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: isActive ? `${theme}20` : "rgba(255,255,255,0.04)",
                        color: isActive ? theme : "rgba(255,255,255,0.35)",
                        border: `1px solid ${isActive ? `${theme}30` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <TabIcon path={tab.icon} size={12} />
                      {tab.label}
                    </motion.button>
                  );
                })}
              </motion.div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
              >
                <div className="flex flex-col gap-2.5">
                  {messages.map((msg) => {
                    if (msg.sender === "guest") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5" style={{ backgroundColor: theme, color: "#000", boxShadow: `0 2px 12px ${theme}33` }}>
                            <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                          </div>
                        </motion.div>
                      );
                    }
                    if (msg.tab && msg.tab !== "chat") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                          {msg.tab === "vibe" && <VibeCard body={msg.body} venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "menu" && <MenuCard body={msg.body} venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "events" && <EventsCard body={msg.body} venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "reserve" && <ReserveCard body={msg.body} venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "shop" && <ShopCard body={msg.body} venue={cardVenue} vibeColor={color} />}
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}>
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

              {/* Input */}
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
                  style={{ backgroundColor: theme, boxShadow: `0 2px 10px ${theme}40` }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Powered by */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center pb-1" style={{ paddingBottom: "max(2px, calc(env(safe-area-inset-bottom, 2px) + 62px))" }}>
        <span className="font-sans text-[9px] text-white/10">powered by theKickBack</span>
      </div>
    </main>
  );
}
