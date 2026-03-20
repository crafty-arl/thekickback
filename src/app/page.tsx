"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { MapBackdrop, MapHandle } from "@/components/map-backdrop";

/* ═══ CONSTANTS (mirrored from real TheDock) ═══ */
const ACCENT = "#a78bfa";
const ORANGE = "#f97316";

/* Each use case: venue coords for flyTo + demo script */
interface Demo {
  id: string; label: string; emoji: string;
  venue: { lng: number; lat: number; name: string; vibe: string };
  tabs: string[]; activeTab: number;
  messages: { sender: "guest" | "ai"; text: string }[];
  offerings?: { name: string; price: number; emoji: string }[];
  event?: { name: string; date: string; price: number; capacity: number; rsvps: number };
  results?: { name: string; spec: string; dist: string; vibe: string }[];
  schedule?: { day: string; hours: string; active: boolean }[];
  setup?: string[];
}
const DEMOS: Demo[] = [
  {
    id: "barber", label: "The Barber", emoji: "✂️",
    venue: { lng: -97.7431, lat: 30.2672, name: "Metro Barbershop", vibe: "busy" },
    tabs: ["Chat", "Vibe", "Menu", "Reserve", "Shop"],
    activeTab: 0,
    messages: [
      { sender: "guest" as const, text: "What time can Marcus take me today?" },
      { sender: "ai" as const, text: "Marcus has a 2:15 PM slot open. Classic cut. Want me to lock it in?" },
      { sender: "guest" as const, text: "Yeah book it" },
      { sender: "ai" as const, text: "Done. Classic cut at 2:15 with Marcus. You'll get a reminder 30 min before. ✂️" },
    ],
  },
  {
    id: "league", label: "The League", emoji: "🏀",
    venue: { lng: -97.7407, lat: 30.274, name: "Thursday Night League", vibe: "lit" },
    tabs: ["Chat", "Vibe", "Events", "Join"],
    activeTab: 0,
    messages: [
      { sender: "guest" as const, text: "Which court tonight?" },
      { sender: "ai" as const, text: "Court 3 at Johnson Park. 12 confirmed so far. Bring water — it's hot." },
      { sender: "guest" as const, text: "How do I get there?" },
      { sender: "ai" as const, text: "0.8 mi from you. Walking: 15 min. I'll drop a pin. 📍" },
    ],
  },
  {
    id: "nailtech", label: "The Nail Tech", emoji: "💅",
    venue: { lng: -97.7341, lat: 30.2849, name: "Mai's Nails", vibe: "moderate" },
    tabs: ["Chat", "Vibe", "Menu", "Reserve", "Shop"],
    activeTab: 4,
    messages: [
      { sender: "guest" as const, text: "What can I buy or order here?" },
      { sender: "ai" as const, text: "Here's what's available today:" },
    ],
    offerings: [
      { name: "Gel Full Set", price: 6500, emoji: "💅" },
      { name: "Fill + Design", price: 4500, emoji: "✨" },
      { name: "Pedicure Deluxe", price: 5500, emoji: "🦶" },
    ],
  },
  {
    id: "eventgoer", label: "The Event Goer", emoji: "🎤",
    venue: { lng: -97.742, lat: 30.295, name: "Community Arts Center", vibe: "busy" },
    tabs: ["Chat", "Vibe", "Events", "Reserve"],
    activeTab: 2,
    messages: [
      { sender: "guest" as const, text: "Anything happening tonight?" },
      { sender: "ai" as const, text: "There's a Poetry Night listed tonight. $10 entry, 22 spots left. Want me to grab you a ticket?" },
      { sender: "guest" as const, text: "Yeah, I'm in" },
      { sender: "ai" as const, text: "You're on the list. Doors at 7:30 — show this thread at the door. 🎤" },
    ],
    event: { name: "Poetry Night", date: "Tonight · 7:30 PM", price: 1000, capacity: 40, rsvps: 18 },
  },
  {
    id: "seeker", label: "The Seeker", emoji: "🔍",
    venue: { lng: -97.7505, lat: 30.2695, name: "Precision Tailoring", vibe: "quiet" },
    tabs: ["Chat"],
    activeTab: 0,
    messages: [
      { sender: "guest" as const, text: "I need a good tailor near downtown. Alterations by Saturday." },
      { sender: "ai" as const, text: "Found 2 spots near you that do same-week alterations:" },
    ],
    results: [
      { name: "Precision Tailoring", spec: "Alterations · Hemming", dist: "0.3 mi", vibe: "quiet" },
      { name: "Stitch & Press", spec: "Alterations · Rush Orders", dist: "0.9 mi", vibe: "moderate" },
    ],
  },
  {
    id: "staff", label: "The Staff", emoji: "👤",
    venue: { lng: -97.726, lat: 30.2615, name: "Ink & Iron Tattoo", vibe: "moderate" },
    tabs: ["Chat", "My Hours", "Schedule"],
    activeTab: 1,
    messages: [
      { sender: "guest" as const, text: "I can't do Wednesdays anymore" },
      { sender: "ai" as const, text: "Got it. Wednesday removed. Clients with bookings will be notified automatically." },
    ],
    schedule: [
      { day: "Mon", hours: "10am – 6pm", active: true },
      { day: "Tue", hours: "10am – 6pm", active: true },
      { day: "Wed", hours: "Off", active: false },
      { day: "Thu", hours: "12pm – 8pm", active: true },
      { day: "Fri", hours: "10am – 6pm", active: true },
    ],
  },
  {
    id: "owner", label: "The Owner", emoji: "🏠",
    venue: { lng: -97.748, lat: 30.2555, name: "Amir's Tea House", vibe: "quiet" },
    tabs: ["Chat"],
    activeTab: 0,
    messages: [
      { sender: "guest" as const, text: "I just opened a tea house. How do I get set up?" },
      { sender: "ai" as const, text: "Welcome! Tell me about your spot and I'll build everything for you." },
      { sender: "guest" as const, text: "It's called Amir's Tea House. We're on South Lamar." },
      { sender: "ai" as const, text: "You're live. Storefront, AI agent, and map pin — all set. People can find you now." },
    ],
    setup: ["Storefront created", "AI agent trained", "Pin on the map", "Share link ready"],
  },
  {
    id: "regular", label: "The Regular", emoji: "📍",
    venue: { lng: -97.738, lat: 30.278, name: "The Commons", vibe: "moderate" },
    tabs: ["Chat", "Vibe", "Menu", "Events"],
    activeTab: 0,
    messages: [
      { sender: "guest" as const, text: "What's alive near me right now?" },
      { sender: "ai" as const, text: "8 spots are live within walking distance. The Commons is closest — moderate vibe. Tap to start chatting." },
    ],
  },
];

const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171",
};

const TAB_ICONS: Record<string, string> = {
  Chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  Vibe: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  Menu: "M3 6h18M3 12h18M3 18h18",
  Events: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4",
  Reserve: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  Shop: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6",
  Join: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  "My Hours": "M12 8v4l3 3M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  Schedule: "M3 6h18M3 12h18M3 18h18",
};

const QUICK_ACTIONS = [
  "How does it work?",
  "I own a small business",
  "I want to find an event",
  "I'm looking for a service",
  "I work at a venue",
  "What's the AI Wallet?",
];

/* ═══ CHAT TYPES ═══ */
interface Msg { role: "user" | "assistant"; content: string; }

/* ═══ MAIN ═══ */
export default function Home() {
  const mapRef = useRef<MapHandle>(null);
  const [activeCase, setActiveCase] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const current = DEMOS[activeCase];
  const vibeColor = VIBE_COLORS[current.venue.vibe] || ACCENT;

  /* Manual navigation only — no autoplay */
  function selectCase(idx: number) {
    setExpanded(true);
    setActiveCase(idx);
    setMsgIndex(0);
    mapRef.current?.flyTo(DEMOS[idx].venue.lng, DEMOS[idx].venue.lat);
  }

  function stepForward() {
    const maxMsgs = current.messages.length - 1;
    if (msgIndex < maxMsgs) {
      setMsgIndex(msgIndex + 1);
    } else {
      const next = (activeCase + 1) % DEMOS.length;
      setActiveCase(next);
      setMsgIndex(0);
      mapRef.current?.flyTo(DEMOS[next].venue.lng, DEMOS[next].venue.lat);
    }
  }

  function stepBack() {
    if (msgIndex > 0) {
      setMsgIndex(msgIndex - 1);
    } else {
      const prev = (activeCase - 1 + DEMOS.length) % DEMOS.length;
      setActiveCase(prev);
      setMsgIndex(DEMOS[prev].messages.length - 1);
      mapRef.current?.flyTo(DEMOS[prev].venue.lng, DEMOS[prev].venue.lat);
    }
  }

  const visibleMsgs = current.messages.slice(0, msgIndex + 1);

  /* ── OpenClaw Q&A Chat ── */
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey. I'm KickBack — infrastructure for every gathering place that deserves a front door. Barbershops, courts, salons, leagues, studios. Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  async function sendChat(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setChatMsgs((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const userCount = chatMsgs.filter(m => m.role === "user").length + 1; // +1 for current
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), messageCount: userCount }),
      });
      const data = await res.json();
      setChatMsgs((p) => [...p, { role: "assistant", content: data.reply || "I'm here to help." }]);
    } catch {
      setChatMsgs((p) => [...p, { role: "assistant", content: "Connection lost. Try again." }]);
    } finally { setLoading(false); }
  }

  function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    sendChat(input);
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a0a0a" }}>
      {/* ── FULL-SCREEN MAP (left side, desktop only) ── */}
      <div className="absolute inset-0 lg:right-[420px] hidden lg:block">
        <MapBackdrop ref={mapRef} />
      </div>

      {/* ── LOGO (top-left, desktop only) ── */}
      <div className="absolute top-5 left-4 z-50 hidden lg:block">
        <Image src="/logo.png" alt="theKickBack" width={180} height={60} priority style={{ height: "auto", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }} />
      </div>

      {/* ── NAV (top-right, desktop only) ── */}
      <div className="absolute top-5 right-4 z-50 hidden lg:flex items-center gap-2">
        <a href="https://join.thekickback.net"
          className="flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:text-white/90"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >Explore</a>
        <a href="https://dash.thekickback.net"
          className="flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{ backgroundColor: ORANGE, color: "#fff" }}
        >Dashboard</a>
      </div>

      {/* ── USE CASE STRIP (over map, below logo) ── */}
      <div className="absolute top-16 left-4 right-[420px] z-50 hidden lg:flex justify-center">
        <div className="flex gap-1 rounded-full px-1.5 py-1 overflow-x-auto"
          style={{ backgroundColor: "rgba(12,12,14,0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {DEMOS.map((d, i) => (
            <button key={d.id} onClick={() => selectCase(i)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all"
              style={i === activeCase
                ? { backgroundColor: `${ACCENT}25`, color: ACCENT }
                : { color: "rgba(255,255,255,0.35)" }
              }
            >
              <span className="text-xs">{d.emoji}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ THE DOCK (bottom of map area) ═══ */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed bottom-0 left-0 z-40"
        style={{ right: "420px", paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}
      >
        {/* Mobile: show dock full-width; Desktop: only left of chat */}
        <div className="hidden lg:block">
          <motion.div
            animate={{ height: expanded ? "50vh" : 56, borderRadius: expanded ? "20px" : 28 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative mx-3 flex flex-col overflow-hidden"
            style={{
              background: "rgba(12, 12, 14, 0.92)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 -4px 30px rgba(0,0,0,0.3)",
            }}
          >
            {/* Collapsed */}
            {!expanded && (
              <button onClick={() => setExpanded(true)} className="flex h-full items-center gap-2 px-4">
                <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 6px ${vibeColor}60` }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <span className="font-sans text-[13px] font-semibold text-white/70">{current.venue.name}</span>
                <span className="font-sans text-[11px] text-white/25">{current.label}</span>
                <div className="ml-auto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </button>
            )}

            {/* Expanded */}
            {expanded && (
              <>
                {/* Drag handle */}
                <button onClick={() => setExpanded(false)} className="flex shrink-0 justify-center pt-2 pb-1 cursor-pointer">
                  <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
                </button>

                {/* Venue header */}
                <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `linear-gradient(135deg, ${vibeColor}30, ${vibeColor}10)`, border: `2px solid ${vibeColor}40` }}
                  >
                    <span className="text-[16px]">{current.emoji}</span>
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="font-sans text-[14px] font-semibold text-white/90">{current.venue.name}</span>
                    <span className="font-sans text-[10px] text-white/30">{current.label}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: `${vibeColor}12`, border: `1px solid ${vibeColor}25` }}>
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor, boxShadow: `0 0 4px ${vibeColor}` }} />
                    <span className="font-sans text-[10px] font-semibold capitalize" style={{ color: vibeColor }}>{current.venue.vibe}</span>
                  </div>
                  {/* Navigation */}
                  <div className="flex items-center gap-1">
                    <button onClick={stepBack}
                      className="flex items-center justify-center rounded-full w-7 h-7"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <button onClick={stepForward}
                      className="flex items-center justify-center rounded-full w-7 h-7"
                      style={{ backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}25` }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
                    </button>
                  </div>
                  <button onClick={() => setExpanded(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="6 15 12 9 18 15" /></svg>
                  </button>
                </div>

                {/* Tab strip */}
                <div className="flex gap-0.5 px-3 pb-2">
                  {current.tabs.map((tab, i) => (
                    <div key={tab} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap"
                      style={i === current.activeTab ? { backgroundColor: `${ACCENT}15`, color: ACCENT } : { color: "rgba(255,255,255,0.25)" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={TAB_ICONS[tab] || TAB_ICONS.Chat} /></svg>
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Chat messages + cards */}
                <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={activeCase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                      {visibleMsgs.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          className={`flex ${m.sender === "guest" ? "justify-end" : "justify-start"}`}
                        >
                          {m.sender === "ai" && (
                            <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}15` }}>
                              <motion.div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                            </div>
                          )}
                          <div className="max-w-[80%] px-3.5 py-2.5 font-sans text-[13px] leading-relaxed"
                            style={m.sender === "guest"
                              ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, color: "#000", borderRadius: "16px 16px 4px 16px", fontWeight: 500 }
                              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", borderRadius: "16px 16px 16px 4px", border: "1px solid rgba(255,255,255,0.05)" }
                            }
                          >{m.text}</div>
                        </motion.div>
                      ))}

                      {/* Offerings */}
                      {!!current.offerings && msgIndex >= 1 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollSnapType: "x mandatory" }}>
                          {(current.offerings as { name: string; price: number; emoji: string }[]).map((o) => (
                            <div key={o.name} className="flex shrink-0 flex-col overflow-hidden rounded-2xl" style={{ width: 150, backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${ACCENT}15`, scrollSnapAlign: "start" }}>
                              <div className="relative flex h-16 items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}06)` }}>
                                <span className="text-2xl">{o.emoji}</span>
                                <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                                  <span className="font-mono text-[10px] font-bold" style={{ color: ACCENT }}>${(o.price / 100).toFixed(0)}</span>
                                </div>
                              </div>
                              <div className="px-2.5 py-2"><span className="font-sans text-[12px] font-semibold text-white/80">{o.name}</span></div>
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {/* Event card */}
                      {!!current.event && msgIndex >= 1 && (() => {
                        const ev = current.event as { name: string; date: string; price: number; capacity: number; rsvps: number };
                        return (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${ACCENT}15` }}>
                            <div className="relative flex h-16 items-center justify-center" style={{ background: `linear-gradient(135deg, ${ORANGE}20, ${ORANGE}06)` }}>
                              <span className="text-2xl">🎤</span>
                              <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                                <span className="font-mono text-[10px] font-bold" style={{ color: ORANGE }}>${(ev.price / 100).toFixed(0)}</span>
                              </div>
                            </div>
                            <div className="px-3 py-2.5">
                              <div className="font-sans text-[12px] font-semibold text-white/80">{ev.name}</div>
                              <div className="font-sans text-[9px] text-white/30 mb-1.5">{ev.date}</div>
                              <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                                <div className="h-full rounded-full" style={{ width: `${(ev.rsvps / ev.capacity) * 100}%`, backgroundColor: ORANGE }} />
                              </div>
                              <div className="font-sans text-[9px] text-white/25 mt-1">{ev.rsvps}/{ev.capacity} RSVPs</div>
                            </div>
                          </motion.div>
                        );
                      })()}

                      {/* Search results */}
                      {!!current.results && msgIndex >= 1 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                          {(current.results as { name: string; spec: string; dist: string; vibe: string }[]).map((v) => {
                            const c = VIBE_COLORS[v.vibe] || ACCENT;
                            return (
                              <div key={v.name} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${c}15` }}>
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}` }} />
                                <div className="flex-1">
                                  <div className="font-sans text-[12px] font-semibold text-white/80">{v.name}</div>
                                  <div className="font-sans text-[9px] text-white/30">{v.spec}</div>
                                </div>
                                <div className="font-sans text-[10px] text-white/25">{v.dist}</div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {/* Schedule */}
                      {!!current.schedule && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25 mb-1.5">THIS WEEK</div>
                          {(current.schedule as { day: string; hours: string; active: boolean }[]).map((d) => (
                            <div key={d.day} className="flex justify-between py-1 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                              <span className={`font-sans text-[11px] font-medium ${d.active ? "text-white/50" : "text-white/15"}`}>{d.day}</span>
                              <span className={`font-sans text-[11px] ${d.active ? "" : "line-through text-white/15"}`} style={{ color: d.active ? ACCENT : undefined }}>{d.hours}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {/* Setup checklist */}
                      {!!current.setup && msgIndex >= 3 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {(current.setup as string[]).map((step, i) => (
                            <div key={i} className="flex items-center gap-2 py-1">
                              <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}25` }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              </div>
                              <span className="font-sans text-[11px] text-white/50">{step}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Dock input (visual) */}
                <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                  <div className="min-w-0 flex-1 rounded-full px-4 flex items-center font-sans text-[13px] text-white/25"
                    style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >Ask {current.venue.name} anything...</div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 2px 10px ${ACCENT}40` }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ═══ Q&A CHAT (right panel, fixed) ═══ */}
      <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[420px] z-30 flex flex-col"
        style={{
          background: "rgba(12, 12, 14, 0.96)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {/* Mobile: show logo */}
          <div className="lg:hidden mr-1">
            <Image src="/logo.png" alt="theKickBack" width={100} height={32} priority style={{ height: "auto", filter: "brightness(0) invert(1)" }} />
          </div>
          {/* Desktop: show pulsing dot + KickBack text */}
          <div className="hidden lg:flex items-center gap-3">
            <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORANGE }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <span className="font-sans text-[15px] font-semibold text-white/90">KickBack</span>
            <span className="font-sans text-[11px] text-white/30">Ask me anything</span>
          </div>
          {/* Mobile nav links */}
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <a href="https://join.thekickback.net"
              className="flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium text-white/60"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >Explore</a>
            <a href="https://dash.thekickback.net"
              className="flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ backgroundColor: ORANGE, color: "#fff" }}
            >Dashboard</a>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {chatMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${ORANGE}15` }}>
                  <span className="text-[10px] font-bold" style={{ color: ORANGE }}>KB</span>
                </div>
              )}
              <div className="max-w-[85%] px-4 py-2.5 font-sans text-[13px] leading-relaxed"
                style={m.role === "user"
                  ? { background: ORANGE, color: "#fff", borderRadius: "16px 16px 4px 16px" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", borderRadius: "16px 16px 16px 4px", border: "1px solid rgba(255,255,255,0.05)" }
                }
              >{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl font-sans text-[13px]" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>Thinking...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick actions */}
        {chatMsgs.length <= 1 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((q) => (
              <button key={q} onClick={() => sendChat(q)}
                className="px-3 py-1.5 rounded-full font-sans text-[11px] font-medium transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}
              >{q}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about KickBack..."
            className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
            style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {input.trim() && (
            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
              style={{ backgroundColor: ORANGE, boxShadow: `0 2px 10px ${ORANGE}40` }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </motion.button>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-center gap-4 px-4 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <a href="https://join.thekickback.net" className="font-sans text-[11px] font-semibold" style={{ color: ORANGE }}>Find Your Spot</a>
          <a href="https://dash.thekickback.net" className="font-sans text-[11px] font-semibold" style={{ color: ORANGE }}>Set Up Your Hub</a>
          <span className="text-white/10">·</span>
          <a href="/about" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">About</a>
          <a href="/privacy" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">Privacy</a>
        </div>
      </div>
    </div>
  );
}
