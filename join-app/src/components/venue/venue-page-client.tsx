"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import Image from "next/image";
import { VenueOfferings } from "./venue-offerings";
import { VenueGallery } from "./venue-gallery";
import { VenueStaff } from "./venue-staff";
import type { StaffMember } from "./venue-staff";
import { VibeCard, MenuCard, EventsCard, ReserveCard, ShopCard, SubscribeCard, JoinCard } from "../map/tab-cards";

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
  staffByOffering?: Record<string, { name: string; avatar_url: string | null }[]>;
}

type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "subscribe" | "join";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
}

/* ── Helpers ── */

function vc(vibe: string): string {
  switch (vibe) {
    case "quiet": return "#4ADE80";
    case "moderate": return "#FACC15";
    case "busy": return "#F97316";
    case "packed": return "#EF4444";
    default: return "#4ADE80";
  }
}

function vl(vibe: string): string {
  switch (vibe) {
    case "quiet": return "Quiet";
    case "moderate": return "Moderate";
    case "busy": return "Busy";
    case "packed": return "Packed";
    default: return vibe;
  }
}

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

const QUICK_REPLIES = [
  { label: "What's the vibe?", cmd: "what's the vibe right now?" },
  { label: "See the menu", cmd: "show me the menu" },
  { label: "Any events?", cmd: "any events tonight?" },
  { label: "Reserve a spot", cmd: "I'd like to reserve a spot" },
  { label: "What can I buy?", cmd: "what can I buy or order here?" },
  { label: "How to join", cmd: "tell me about this venue and how to join" },
];

function toCardVenue(venue: Venue) {
  return {
    id: venue.id, name: venue.name, category: "lounge" as const,
    neighborhood: venue.neighborhood || "", vibe: (venue.vibe || "quiet") as "quiet" | "moderate" | "busy" | "lit",
    occupancy: venue.occupancy, capacity: venue.max_occupancy, description: "",
    tags: [] as string[], hours: "", memberOnly: false, textNumber: "", latitude: 0, longitude: 0,
  };
}

/* ═══════════════════════════════════════════════════
   VENUE PAGE — Profile + Chat Dock
   ═══════════════════════════════════════════════════ */

export function VenuePageClient({ page, venue, table, user, offerings, gallery = [], staff = [], staffByOffering = {} }: Props) {
  const color = vc(venue.vibe);
  const theme = page.theme_color;
  const pct = Math.round((venue.occupancy / venue.max_occupancy) * 100);
  const cardVenue = toCardVenue(venue);

  /* ── Chat state ── */
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const controls = useAnimationControls();
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", sender: "ai", body: `Hey! ${vl(venue.vibe)} vibes right now, ${venue.occupancy} people in. Ask me anything about ${venue.name}.`, timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentTabCommand = useRef<Set<Tab>>(new Set(["chat"]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const h = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    window.visualViewport?.addEventListener("resize", h);
    return () => window.visualViewport?.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    controls.start({
      height: chatOpen ? "70dvh" : 0,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [chatOpen, controls]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!chatOpen) setChatOpen(true);

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, venueId: venue.id, venueName: venue.name, vibe: venue.vibe, occupancy: venue.occupancy, table }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: "ai", body: data.reply || "Couldn't reach the venue right now.", timestamp: Date.now(), tab: activeTab }]);
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, venue, table, chatOpen, activeTab]);

  function handleTabTap(tab: Tab) {
    setActiveTab(tab);
    const cmd = TAB_COMMANDS[tab];
    if (cmd && !hasSentTabCommand.current.has(tab)) {
      hasSentTabCommand.current.add(tab);
      send(cmd);
    }
  }

  return (
    <main className="relative min-h-dvh w-full text-white" style={{ backgroundColor: "#000" }}>

      {/* ═══ PROFILE HEADER ═══ */}
      <div className="relative" style={{ height: 280 }}>
        {page.hero_image ? (
          <Image src={page.hero_image} alt={venue.name} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 30%, ${theme}40 0%, transparent 60%), linear-gradient(to bottom, ${theme}15 0%, #000 100%)` }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)" }} />

        {/* Nav */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
          <a href="/" className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </a>
          <div className="flex items-center gap-2">
            <a href={`https://thekickback.net/wallet/pass/${venue.id}/guest`} className="flex h-9 items-center gap-1.5 rounded-full px-3.5 backdrop-blur-md font-sans text-[12px] font-medium text-white/70" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              Wallet
            </a>
          </div>
        </div>

        {/* Venue identity */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: theme }}>
              <div className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
              <span className="font-sans text-[10px] font-bold tracking-[1px] text-black">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-sans text-[11px] font-semibold" style={{ color }}>{vl(venue.vibe)}</span>
            </div>
            <div className="rounded-full px-2.5 py-1 font-sans text-[11px] text-white/60" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              {venue.occupancy}/{venue.max_occupancy} ({pct}%)
            </div>
          </div>
          <h1 className="font-sans text-[28px] font-bold leading-tight tracking-tight">{venue.name}</h1>
          {page.tagline && <p className="mt-1 font-sans text-[14px] text-white/50">{page.tagline}</p>}
          {venue.neighborhood && <p className="mt-1 font-sans text-[12px] text-white/30">{venue.neighborhood}{venue.address ? ` · ${venue.address}` : ""}</p>}
        </div>
      </div>

      {table && (
        <div className="flex justify-center py-2" style={{ backgroundColor: `${theme}15` }}>
          <span className="font-sans text-[12px] font-medium" style={{ color: theme }}>You're at Table {table}</span>
        </div>
      )}

      {/* ═══ SCROLLABLE BODY ═══ */}
      <div className="pb-[100px]">

        {/* Quick info row */}
        <div className="flex gap-2 overflow-x-auto px-4 py-4 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          {page.hours.length > 0 && (
            <div className="shrink-0 rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 140 }}>
              <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25 mb-1.5">HOURS</p>
              {page.hours.slice(0, 3).map((h) => (
                <div key={h.day} className="flex justify-between gap-4 py-0.5">
                  <span className="font-sans text-[11px] text-white/40">{h.day}</span>
                  <span className="font-sans text-[11px] text-white/60">{h.open}–{h.close}</span>
                </div>
              ))}
              {page.hours.length > 3 && <p className="font-sans text-[10px] text-white/20 mt-1">+{page.hours.length - 3} more</p>}
            </div>
          )}
          {venue.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-80" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 140 }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme}20` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              </div>
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">LOCATION</p>
                <p className="font-sans text-[12px] text-white/50 mt-0.5">{venue.address}</p>
              </div>
            </a>
          )}
          {offerings.filter((o) => o.type === "membership").length > 0 && (
            <button onClick={() => setChatOpen(true)} className="shrink-0 rounded-2xl px-4 py-3 text-left active:scale-[0.98]" style={{ backgroundColor: `${theme}10`, border: `1px solid ${theme}20`, minWidth: 140 }}>
              <p className="font-sans text-[10px] font-semibold tracking-[1px] mb-1.5" style={{ color: `${theme}80` }}>MEMBERSHIP</p>
              <p className="font-sans text-[13px] font-semibold" style={{ color: theme }}>
                {offerings.filter((o) => o.type === "membership")[0]?.name}
              </p>
              <p className="font-sans text-[11px] text-white/30 mt-0.5">Tap to learn more</p>
            </button>
          )}
        </div>

        {/* Description */}
        {page.description && (
          <div className="px-5 pb-4">
            <p className="font-sans text-[14px] leading-[1.7] text-white/50">{page.description}</p>
          </div>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="px-5 pb-5">
            <VenueGallery gallery={gallery} themeColor={theme} />
          </div>
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <div className="px-5 pb-5">
            <VenueStaff
              staff={staff}
              themeColor={theme}
              offeringsByStaff={(() => {
                const map: Record<string, string[]> = {};
                for (const [offeringId, staffMembers] of Object.entries(staffByOffering)) {
                  const offering = offerings.find((o) => o.id === offeringId);
                  if (!offering) continue;
                  for (const s of staffMembers) {
                    const sm = staff.find((st) => st.display_name === s.name);
                    if (sm) { if (!map[sm.id]) map[sm.id] = []; map[sm.id].push(offering.name); }
                  }
                }
                return map;
              })()}
            />
          </div>
        )}

        {/* Offerings */}
        {offerings.length > 0 && (
          <div className="px-5 pb-5">
            <VenueOfferings offerings={offerings} themeColor={theme} venueName={venue.name} staffByOffering={staffByOffering} />
          </div>
        )}

        {/* Menu */}
        {page.menu_sections.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MENU</p>
            <div className="flex flex-col gap-3">
              {page.menu_sections.map((section) => (
                <div key={section.name} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="mb-2.5 font-sans text-[13px] font-semibold text-white/60">{section.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {section.items.map((item) => (
                      <span key={item} className="rounded-lg px-2.5 py-1 font-sans text-[12px] text-white/45" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        {venue.rules?.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">HOUSE RULES</p>
            <div className="flex flex-col gap-2">
              {venue.rules.map((rule) => (
                <div key={rule} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme }} />
                  <span className="font-sans text-[13px] text-white/40">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ CHAT DOCK — fixed bottom ═══ */}
      <div className="fixed inset-x-0 bottom-0 z-30" style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom, 4px))" }}>

        {/* Expanded chat panel */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "70dvh" }}
              exit={{ height: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="mx-2 mb-1 flex flex-col overflow-hidden rounded-3xl"
              style={{
                background: "rgba(12, 12, 15, 0.95)",
                backdropFilter: "blur(40px) saturate(1.8)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
                  <span className="font-sans text-[11px] text-white/30">{vl(venue.vibe)} · {pct}%</span>
                </div>
                <motion.button onClick={() => setChatOpen(false)} whileTap={{ scale: 0.85 }} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50"><polyline points="18 15 12 9 6 15" /></svg>
                </motion.button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button key={tab.id} onClick={() => handleTabTap(tab.id)} whileTap={{ scale: 0.92 }}
                      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: isActive ? `${theme}20` : "rgba(255,255,255,0.04)",
                        color: isActive ? theme : "rgba(255,255,255,0.35)",
                        border: `1px solid ${isActive ? `${theme}30` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tab.icon} /></svg>
                      {tab.label}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
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
                          {msg.tab === "vibe" && <VibeCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "menu" && <MenuCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "events" && <EventsCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "reserve" && <ReserveCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "shop" && <ShopCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "subscribe" && <SubscribeCard body="" venue={cardVenue} vibeColor={color} />}
                          {msg.tab === "join" && <JoinCard body="" venue={cardVenue} vibeColor={color} />}
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

              {/* Quick replies */}
              {messages.length <= 2 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr.label} onClick={() => send(qr.cmd)} disabled={loading}
                      className="shrink-0 rounded-full px-3.5 py-2 font-sans text-[12px] font-medium text-white/50 active:scale-95 disabled:opacity-30"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >{qr.label}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything..." enterKeyHint="send" autoComplete="off" autoCorrect="off"
                  className="min-w-0 flex-1 rounded-full px-4 font-sans text-[14px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 44, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <motion.button onClick={() => send()} disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ backgroundColor: theme, boxShadow: `0 2px 10px ${theme}40` }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dock bar — always visible */}
        <div
          className="mx-3 flex items-center gap-2 rounded-full px-3"
          style={{
            height: 56,
            background: "rgba(15, 15, 18, 0.9)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 -4px 30px rgba(0,0,0,0.3)",
          }}
        >
          <button onClick={() => setChatOpen(!chatOpen)} className="flex items-center gap-2 pl-1 shrink-0">
            <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">{venue.name}</span>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { if (!chatOpen) setChatOpen(true); send(); } }}
            onFocus={() => { if (!chatOpen) setChatOpen(true); }}
            placeholder="Ask anything..."
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
          />
          <motion.button
            onClick={() => { if (!chatOpen) setChatOpen(true); send(); }}
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
      </div>

      {/* Powered by */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: "max(2px, calc(env(safe-area-inset-bottom, 2px) + 62px))" }}>
        <span className="font-sans text-[9px] text-white/10">powered by theKickBack</span>
      </div>
    </main>
  );
}
