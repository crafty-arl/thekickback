"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { type Venue } from "@/lib/venues";


interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
}

interface MasterDrawerProps {
  venues: Venue[];
  onVenueSelect: (venue: Venue) => void;
  onRecenter?: () => void;
  hasLocation?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  onExpandedChange?: (expanded: boolean) => void;
}

const ACCENT = "#a78bfa";

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

const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171", packed: "#f87171",
};

const CATEGORY_ICONS: Record<string, string> = {
  rooftop: "M3 21h18M5 21V7l7-4 7 4v14",
  cafe: "M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z",
  bar: "M8 22h8M12 2v20M17 8H7l1-6h8l1 6z",
  lounge: "M20 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16M2 21h20",
  restaurant: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20",
  club: "M9 18V5l12-2v13",
  coworking: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z",
};

function parseVenueChips(
  venues: Venue[],
  apiVenues: Record<string, ApiVenue>,
  richVenues: Record<string, RichVenue>,
  text: string,
  onTap: (venue: Venue) => void
): React.ReactNode[] {
  // Split on both [[VENUE_CARD:id]] and [[venue:id:name]]
  const parts = text.split(/(\[\[VENUE_CARD:[^\]]+\]\]|\[\[venue:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    // Full venue card
    const cardMatch = part.match(/^\[\[VENUE_CARD:([^\]]+)\]\]$/);
    if (cardMatch) {
      const venueId = cardMatch[1];
      const rv = richVenues[venueId];
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) {
        venue = buildVenueFromApi(apiVenues[venueId]);
      }
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
          {/* Hero area */}
          <div className="relative flex items-center justify-center" style={{ height: 80, background: `linear-gradient(135deg, ${vibeColor}18 0%, ${vibeColor}06 50%, rgba(0,0,0,0.2) 100%)` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${vibeColor}35`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={catIcon} />
            </svg>
            {/* Vibe badge */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: VIBE_COLORS[vibe], boxShadow: `0 0 4px ${VIBE_COLORS[vibe]}` }} />
              <span className="font-sans text-[9px] font-semibold" style={{ color: VIBE_COLORS[vibe] }}>{vibeLabel}</span>
            </div>
            {/* Occupancy */}
            <div className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <span className="font-mono text-[9px] font-semibold text-white/40">{occ}/{cap}</span>
            </div>
            {/* Capacity bar */}
            <div className="absolute inset-x-3 bottom-2">
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: VIBE_COLORS[vibe] }} />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-3 py-2.5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="truncate font-sans text-[14px] font-bold text-white/90">{name}</p>
                {rv?.tagline && (
                  <p className="mt-0.5 line-clamp-1 font-sans text-[10px] italic text-white/30">"{rv.tagline}"</p>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  {rv?.type && rv.type !== "venue" && (
                    <span className="rounded-md px-1.5 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {rv.type}
                    </span>
                  )}
                  {(rv?.neighborhood || venue?.neighborhood) && (
                    <span className="font-sans text-[9px] text-white/20">{rv?.neighborhood || venue?.neighborhood}</span>
                  )}
                  {rv?.hours && (
                    <span className="font-sans text-[8px] text-white/15">{rv.hours.split(",")[0]}</span>
                  )}
                </div>
              </div>
              {/* Chat button */}
              <button
                onClick={() => { if (venue) onTap(venue); }}
                className="ml-2 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-bold text-black active:scale-95"
                style={{ backgroundColor: vibeColor }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Small chip (inline mention)
    const chipMatch = part.match(/^\[\[venue:([^:\]]+)(?::([^\]]*))?\]\]$/);
    if (chipMatch) {
      const venueId = chipMatch[1];
      const venueName = chipMatch[2];

      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) {
        venue = buildVenueFromApi(apiVenues[venueId]);
      }

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
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {displayName}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  explorer: { color: "#94a3b8", label: "Explorer" },
  regular: { color: "#4ade80", label: "Regular" },
  member: { color: "#f97316", label: "Member" },
  vip: { color: "#a78bfa", label: "VIP" },
};

export function MasterDrawer({ venues, onVenueSelect, onRecenter, hasLocation, userLocation, onExpandedChange }: MasterDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const [streak, setStreak] = useState(0);
  const controls = useAnimationControls();

  // Notify parent of expanded state changes
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  // Load minimal user data (streak for command bar)
  useEffect(() => {
    fetch("/api/points")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.balance?.current_streak) setStreak(data.balance.current_streak);
      })
      .catch(() => {});
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      body: "Hey. I'm KickBack. Ask me anything \u2014 what's happening tonight, where to go, or vibe check a spot.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiVenues, setApiVenues] = useState<Record<string, ApiVenue>>({});
  const [richVenues, setRichVenues] = useState<Record<string, RichVenue>>({});

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () =>
      window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    controls.start({
      height: expanded ? "70dvh" : 56,
      borderRadius: expanded ? "24px 24px 0 0" : 28,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [expanded, controls]);

  const send = useCallback(
    async (text?: string) => {
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
        const res = await fetch("/api/chat/general", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        });

        const data = await res.json();

        if (data.venues?.length) {
          setApiVenues((prev) => {
            const next = { ...prev };
            for (const v of data.venues) {
              next[v.id] = v;
            }
            return next;
          });
          // Store rich venue data for card rendering
          setRichVenues((prev) => {
            const next = { ...prev };
            for (const v of data.venues) {
              next[v.id] = v;
            }
            return next;
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: "ai",
            body:
              data.reply || "Something went wrong. Try again in a moment.",
            timestamp: Date.now(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "ai",
            body: "Something went wrong. Try again in a moment.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading, expanded]
  );

  function handleDrag(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { y: number }; velocity: { y: number } }
  ) {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      if (expanded) setExpanded(false);
    } else if (info.offset.y < -60 || info.velocity.y < -300) {
      if (!expanded) setExpanded(true);
    }
  }

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))",
      }}
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
          boxShadow: `0 0 0 1px rgba(255,255,255,0.1), 0 -4px 40px rgba(0,0,0,0.3), 0 4px 30px rgba(0,0,0,0.2)`,
          touchAction: "none",
        }}
      >
        {/* === COLLAPSED: [location] [dot KickBack] [input] [streak] === */}
        {!expanded && (
          <div className="flex h-full items-center gap-1.5 px-2">
            {/* Left cluster: location */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Location */}
              {hasLocation && onRecenter && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRecenter(); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  aria-label="Center on my location"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Center: KickBack brand + input */}
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 pl-1"
            >
              <motion.div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCENT }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <span className="whitespace-nowrap font-sans text-[12px] font-semibold text-white/80">
                KB
              </span>
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              onFocus={() => setExpanded(true)}
              placeholder="Where should I go tonight?"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
            />

            {/* Right: streak indicator */}
            {streak > 0 && (
              <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
                <span className="text-[10px]">&#x1f525;</span>
                <span className="font-mono text-[10px] font-bold text-orange">{streak}</span>
              </div>
            )}
          </div>
        )}

        {/* === EXPANDED: header + messages + input === */}
        {expanded && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <span className="font-sans text-[15px] font-semibold text-white/90">
                  KickBack
                </span>
                <span className="font-sans text-[11px] text-white/30">
                  Concierge
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Location */}
                {hasLocation && onRecenter && (
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
                {/* Collapse */}
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
            </div>

            {/* Quick suggestions — only show if no user messages yet */}
            {messages.length <= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex gap-2 overflow-x-auto px-4 pb-2"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {[
                  "What's open right now?",
                  "Somewhere quiet to work",
                  "Best spot for a date",
                  "Where's the party?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="shrink-0 rounded-full px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Divider */}
            <div
              className="mx-4 h-px"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              <div className="flex flex-col gap-2.5">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 25,
                      stiffness: 300,
                    }}
                    className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.sender === "guest"
                        ? "rounded-br-sm"
                        : "rounded-bl-sm"
                        }`}
                      style={
                        msg.sender === "guest"
                          ? {
                            backgroundColor: ACCENT,
                            color: "#000",
                            boxShadow: `0 2px 12px ${ACCENT}33`,
                          }
                          : {
                            backgroundColor: "rgba(255,255,255,0.07)",
                            color: "rgba(255,255,255,0.8)",
                            border: "1px solid rgba(255,255,255,0.05)",
                          }
                      }
                    >
                      <p className="font-sans text-[14px] leading-[1.5]">
                        {msg.sender === "ai"
                          ? parseVenueChips(venues, apiVenues, richVenues, msg.body, onVenueSelect)
                          : msg.body}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div
                      className="rounded-2xl rounded-bl-sm px-4 py-3"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div className="flex gap-1.5">
                        <motion.div
                          className="h-2 w-2 rounded-full bg-white/30"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0,
                          }}
                        />
                        <motion.div
                          className="h-2 w-2 rounded-full bg-white/30"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0.15,
                          }}
                        />
                        <motion.div
                          className="h-2 w-2 rounded-full bg-white/30"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0.3,
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
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
                style={{
                  height: 40,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
              <motion.button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `0 2px 10px ${ACCENT}40`,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="black"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
