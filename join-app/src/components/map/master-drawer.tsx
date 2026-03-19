"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { PreferencesSection } from "./preferences-section";
import { StoreDrawer } from "./store-drawer";

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
}

const ACCENT = "#a78bfa"; // soft purple for the master agent

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

function parseVenueChips(
  venues: Venue[],
  apiVenues: Record<string, ApiVenue>,
  text: string,
  onTap: (venue: Venue) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\[venue:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[\[venue:([^:\]]+)(?::([^\]]*))?\]\]$/);
    if (match) {
      const venueId = match[1];
      const venueName = match[2];

      // Try local venues first, then API venues
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) {
        venue = buildVenueFromApi(apiVenues[venueId]);
      }

      const displayName = venue?.name || venueName || "View venue";

      return (
        <button
          key={i}
          onClick={() => {
            if (venue) onTap(venue);
          }}
          className="mx-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[13px] font-semibold active:scale-95"
          style={{
            backgroundColor: `${ACCENT}25`,
            color: ACCENT,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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

const TIER_CONFIG: Record<string, { color: string; label: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", label: "Explorer", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", label: "Regular", next: "Member", threshold: 1500 },
  member: { color: "#f97316", label: "Member", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", label: "VIP", next: "", threshold: Infinity },
};

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

export function MasterDrawer({ venues, onVenueSelect, onRecenter, hasLocation, userLocation }: MasterDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const controls = useAnimationControls();

  // Load user profile
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser?.email) return;

      // Try to get points balance
      try {
        const res = await fetch(`/api/points?userId=${authUser.id}`);
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
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      body: "Hey. I'm KickBack. Ask me anything — what's happening tonight, where to go, or vibe check a spot.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Venues returned by the API that may not be on the map
  const [apiVenues, setApiVenues] = useState<Record<string, { id: string; name: string; vibe: string; occupancy: number; capacity: number; latitude: number | null; longitude: number | null; neighborhood: string | null }>>({});

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
          body: JSON.stringify({ message: msg, userId: user?.authId }),
        });

        const data = await res.json();

        // Store venue metadata from API for chip navigation
        if (data.venues?.length) {
          setApiVenues((prev) => {
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
        {/* === COLLAPSED: [avatar+location] [dot KickBack] [input] [streak] === */}
        {!expanded && (
          <div className="flex h-full items-center gap-1.5 px-2">
            {/* Left cluster: profile + location */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Profile avatar */}
              <button
                onClick={() => { setExpanded(true); setShowProfile(true); }}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: user ? `${TIER_CONFIG[user.tier]?.color || "#94a3b8"}15` : "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${user ? `${TIER_CONFIG[user.tier]?.color || "#94a3b8"}30` : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {user ? (
                  <span className="font-sans text-[11px] font-bold" style={{ color: TIER_CONFIG[user.tier]?.color || "#94a3b8" }}>
                    {user.email[0].toUpperCase()}
                  </span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </button>

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

              {/* Store */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowStore(true); }}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                aria-label="Explore venues"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
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
            {user && user.streak > 0 && (
              <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
                <span className="text-[10px]">🔥</span>
                <span className="font-mono text-[10px] font-bold text-orange">{user.streak}</span>
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
                {/* Store */}
                <button
                  onClick={() => { setShowStore(true); setExpanded(false); setShowProfile(false); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  aria-label="Explore venues"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                {/* Profile */}
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-all"
                  style={{
                    backgroundColor: showProfile
                      ? `${TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8"}20`
                      : "rgba(255,255,255,0.06)",
                    border: `1.5px solid ${showProfile ? `${TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8"}40` : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {user ? (
                    <span className="font-sans text-[10px] font-bold" style={{ color: showProfile ? (TIER_CONFIG[user.tier]?.color || "#94a3b8") : "rgba(255,255,255,0.4)" }}>
                      {user.email[0].toUpperCase()}
                    </span>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>
                {/* Collapse */}
                <motion.button
                  onClick={() => { setExpanded(false); setShowProfile(false); }}
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

            {/* Profile panel */}
            <AnimatePresence>
              {showProfile && user && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3">
                    {/* Identity row */}
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}30, ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}10)`,
                          border: `2px solid ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}40`,
                        }}
                      >
                        <span className="font-sans text-[18px] font-bold" style={{ color: TIER_CONFIG[user.tier]?.color || "#94a3b8" }}>
                          {user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-sans text-[13px] font-semibold text-white/80">{user.email}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${TIER_CONFIG[user.tier]?.color || "#94a3b8"}15`,
                              color: TIER_CONFIG[user.tier]?.color || "#94a3b8",
                            }}
                          >
                            {TIER_CONFIG[user.tier]?.label || "Explorer"}
                          </span>
                          {user.streak > 0 && (
                            <span className="flex items-center gap-1 font-sans text-[10px] font-semibold text-orange">
                              🔥 {user.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* KickBack Score — XP meter (aggregate of all venue XP) */}
                    <div className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">KICKBACK SCORE</span>
                        <span className="font-mono text-[13px] font-bold" style={{ color: TIER_CONFIG[user.tier]?.color || "#94a3b8" }}>
                          {user.kickbackScore.toLocaleString()}
                          {TIER_CONFIG[user.tier]?.next && (
                            <span className="text-white/20 font-normal"> / {TIER_CONFIG[user.tier].threshold.toLocaleString()}</span>
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
                            background: `linear-gradient(90deg, ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}, ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}cc)`,
                            boxShadow: `0 0 10px ${TIER_CONFIG[user.tier]?.color || "#94a3b8"}40`,
                          }}
                        />
                      </div>
                      {TIER_CONFIG[user.tier]?.next && (
                        <p className="mt-1.5 font-sans text-[9px] text-white/20">
                          {(TIER_CONFIG[user.tier].threshold - user.kickbackScore).toLocaleString()} XP to {TIER_CONFIG[user.tier].next}
                        </p>
                      )}
                    </div>

                    {/* Venue Badges — real per-venue XP profiles */}
                    <div className="mt-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">VENUES</span>
                        <span className="font-mono text-[11px] font-bold text-white/40">{user.venueProfiles.length}</span>
                      </div>
                      {user.venueProfiles.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {user.venueProfiles.slice(0, 6).map((vp) => {
                            const milestoneColor = vp.venue_xp_milestones?.color || "#94a3b8";
                            const milestoneName = vp.venue_xp_milestones?.name;
                            const venueName = vp.venues?.name || "Venue";
                            return (
                              <div
                                key={vp.venue_id}
                                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                                style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                              >
                                {/* Badge dot */}
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: `${milestoneColor}15`, border: `1.5px solid ${milestoneColor}30` }}
                                >
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: milestoneColor, boxShadow: `0 0 6px ${milestoneColor}50` }} />
                                </div>
                                {/* Venue name + milestone */}
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-sans text-[11px] font-semibold text-white/70">{venueName}</p>
                                  <p className="font-sans text-[9px] text-white/25">
                                    {milestoneName || "New"} · {vp.visits} visit{vp.visits !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                {/* XP at this venue */}
                                <span className="font-mono text-[11px] font-bold" style={{ color: milestoneColor }}>
                                  {vp.xp.toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                          {user.venueProfiles.length > 6 && (
                            <p className="text-center font-sans text-[9px] text-white/20">
                              +{user.venueProfiles.length - 6} more venues
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="font-sans text-[11px] text-white/20">Visit venues to start earning XP</p>
                      )}
                    </div>

                    {/* What I know about you */}
                    <PreferencesSection userId={user.authId} />

                    {/* Sign out */}
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        window.location.reload();
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 font-sans text-[11px] font-medium text-white/25 transition hover:bg-white/[0.04] hover:text-white/40"
                      style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                          ? parseVenueChips(venues, apiVenues, msg.body, onVenueSelect)
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

      {/* Store drawer overlay */}
      <AnimatePresence>
        {showStore && (
          <StoreDrawer
            venues={venues}
            onClose={() => setShowStore(false)}
            onVenueSelect={(venue) => {
              setShowStore(false);
              onVenueSelect(venue);
            }}
            userLocation={userLocation}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
