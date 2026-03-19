"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo, useAnimationControls } from "framer-motion";
import { Venue, getVibeHexColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { VibeCard, MenuCard, EventsCard, ReserveCard, ShopCard, JoinCard } from "./tab-cards";
import { PointsBadge } from "./points-badge";
import { CheckoutCard, type CheckoutCardData, type CheckoutAddOn } from "./checkout-card";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
  checkout?: CheckoutCardData;
}

interface VenueDrawerProps {
  venue: Venue;
  onClose: () => void;
}

type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "join";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "shop", label: "Shop", icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2" },
  { id: "join", label: "Join", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  shop: "what can I buy or order here?",
  join: "tell me about this venue and how to join",
};

function TabIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export function VenueDrawer({ venue, onClose }: VenueDrawerProps) {
  const vibeColor = getVibeHexColor(venue.vibe);
  const isClaimed = venue.claimed !== false;

  // ── Unclaimed venue: simplified info card + claim CTA ──
  if (!isClaimed) {
    return (
      <motion.div
        initial={{ y: 140, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 140, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}
      >
        <div
          className="relative mx-3 overflow-hidden rounded-3xl"
          style={{
            background: "rgba(15, 15, 18, 0.85)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 -4px 40px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#6b7280" }} />
              <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-white/25">
                UNCLAIMED
              </span>
            </div>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.85 }}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </motion.button>
          </div>

          {/* Info */}
          <div className="px-4 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {venue.category && (
                <span className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 font-sans text-[11px] capitalize text-white/30">
                  {venue.category}
                </span>
              )}
              {venue.neighborhood && (
                <span className="font-sans text-[11px] text-white/20">{venue.neighborhood}</span>
              )}
            </div>
            {venue.description && (
              <p className="mt-2 font-sans text-[12px] leading-[1.5] text-white/30">{venue.description}</p>
            )}
          </div>

          {/* CTA */}
          <div className="px-4 pb-4 pt-2">
            <a
              href="https://dash.thekickback.net"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-bold text-black transition hover:opacity-90"
              style={{ backgroundColor: "#F97316" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Claim this venue on KickBack
            </a>
            <p className="mt-2 text-center font-sans text-[10px] text-white/15">
              Own this spot? Set up your venue page, AI agent, and member system — free.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Claimed venue: full chat experience ──
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [dismissed, setDismissed] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const controls = useAnimationControls();

  // Resolve authenticated user for personalization
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAuthUserId(user.id);
    });
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      body: `Welcome to ${venue.name}. ${getVibeLabel(venue.vibe)} right now, ${venue.occupancy} people. Ask me anything.`,
      timestamp: Date.now(),
    },
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
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    controls.start({
      height: expanded ? "70dvh" : 56,
      borderRadius: expanded ? "24px 24px 0 0" : 28,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [expanded, controls]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (!expanded) setExpanded(true);

    if (msg.toLowerCase() === "sign out" || msg.toLowerCase() === "signout") {
      const supabase = createClient();
      await supabase.auth.signOut();
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() },
        { id: `signout-${Date.now()}`, sender: "ai", body: "You've been signed out.", timestamp: Date.now() },
      ]);
      setInput("");
      return;
    }

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
          userId: authUserId,
        }),
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        body: data.reply || "Couldn't reach the venue right now. Try again.",
        timestamp: Date.now(),
        tab: activeTab,
      };

      // If the AI generated a checkout card, attach it
      if (data.checkout) {
        aiMsg.checkout = {
          ...data.checkout,
          venue_name: venue.name,
          venue_id: venue.id,
        };
      }

      setMessages((prev) => [...prev, aiMsg]);
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
  }, [input, loading, venue, expanded]);

  function handleTabTap(tab: Tab) {
    setActiveTab(tab);

    const cmd = TAB_COMMANDS[tab];
    if (cmd && !hasSentTabCommand.current.has(tab)) {
      hasSentTabCommand.current.add(tab);
      send(cmd);
    }
  }

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      if (expanded) {
        setExpanded(false);
      } else {
        setDismissed(true);
        setTimeout(onClose, 300);
      }
    } else if (info.offset.y < -60 || info.velocity.y < -300) {
      if (!expanded) setExpanded(true);
    }
  }

  const pct = getOccupancyPercent(venue);

  return (
    <motion.div
      initial={{ y: 140, opacity: 0 }}
      animate={dismissed ? { y: 140, opacity: 0 } : { y: 0, opacity: 1 }}
      exit={{ y: 140, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50"
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
          boxShadow: `0 0 0 1px rgba(255,255,255,0.1), 0 -4px 40px rgba(0,0,0,0.3), 0 4px 30px rgba(0,0,0,0.2)`,
          touchAction: "none",
        }}
      >
        {/* === COLLAPSED: clean pill — venue name + input + close === */}
        {!expanded && (
          <div className="flex h-full items-center gap-2 px-3">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2 pl-1"
            >
              <motion.div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: vibeColor }}
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">
                {venue.name}
              </span>
            </button>

            <PointsBadge userId={null} venueId={venue.id} vibeColor={vibeColor} expanded={false} />

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

            {/* Back to KickBack button */}
            <motion.button
              onClick={() => { setDismissed(true); setTimeout(onClose, 300); }}
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

        {/* === EXPANDED: header + tabs + messages + input === */}
        {expanded && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: vibeColor }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="font-sans text-[15px] font-semibold text-white/90">
                  {venue.name}
                </span>
                <span className="font-sans text-[11px] text-white/30">
                  {getVibeLabel(venue.vibe)} · {pct}%
                </span>
              </div>
              {/* Back to KickBack */}
              <motion.button
                onClick={() => { setDismissed(true); setTimeout(onClose, 300); }}
                whileTap={{ scale: 0.9 }}
                className="flex h-7 items-center gap-1.5 rounded-full px-2.5"
                style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="font-sans text-[10px] font-bold text-[#a78bfa]">KB</span>
              </motion.button>
            </div>

            {/* Tabs — clean horizontal row */}
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
                      backgroundColor: isActive ? `${vibeColor}20` : "rgba(255,255,255,0.04)",
                      color: isActive ? vibeColor : "rgba(255,255,255,0.35)",
                      border: `1px solid ${isActive ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <TabIcon path={tab.icon} size={12} />
                    {tab.label}
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Points */}
            <PointsBadge userId={null} venueId={venue.id} vibeColor={vibeColor} expanded={true} />

            {/* Divider */}
            <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex flex-col gap-2.5">
                {messages.map((msg) => {
                  // Guest messages — standard bubble
                  if (msg.sender === "guest") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="flex justify-end"
                      >
                        <div
                          className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5"
                          style={{ backgroundColor: vibeColor, color: "#000", boxShadow: `0 2px 12px ${vibeColor}33` }}
                        >
                          <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                        </div>
                      </motion.div>
                    );
                  }

                  // AI messages with a tab — render custom card
                  if (msg.tab && msg.tab !== "chat") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="flex justify-start"
                      >
                        {msg.tab === "vibe" && <VibeCard body={msg.body} venue={venue} vibeColor={vibeColor} />}
                        {msg.tab === "menu" && <MenuCard body={msg.body} venue={venue} vibeColor={vibeColor} />}
                        {msg.tab === "events" && <EventsCard body={msg.body} venue={venue} vibeColor={vibeColor} />}
                        {msg.tab === "reserve" && <ReserveCard body={msg.body} venue={venue} vibeColor={vibeColor} />}
                        {msg.tab === "shop" && <ShopCard body={msg.body} venue={venue} vibeColor={vibeColor} />}
                        {msg.tab === "join" && <JoinCard body={msg.body} venue={venue} vibeColor={vibeColor} userId={authUserId} />}
                      </motion.div>
                    );
                  }

                  // AI message with checkout card
                  if (msg.checkout) {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="flex flex-col gap-2"
                      >
                        {msg.body && (
                          <div className="flex justify-start">
                            <div
                              className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5"
                              style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}
                            >
                              <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                            </div>
                          </div>
                        )}
                        <CheckoutCard
                          data={msg.checkout}
                          vibeColor={vibeColor}
                          onConfirm={async (addOns: CheckoutAddOn[], pointsToSpend: number) => {
                            try {
                              const res = await fetch("/api/orders", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  venueId: venue.id,
                                  items: msg.checkout!.items,
                                  addOns,
                                  pointsToSpend,
                                  notes: msg.checkout!.notes,
                                }),
                              });
                              const result = await res.json();
                              if (result.orderId) {
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: `order-${Date.now()}`,
                                    sender: "ai",
                                    body: `You're all set! Order confirmed. ${pointsToSpend > 0 ? `Used ${pointsToSpend} points. ` : ""}Show this to the host when you arrive.`,
                                    timestamp: Date.now(),
                                  },
                                ]);
                              } else {
                                setMessages((prev) => [
                                  ...prev,
                                  { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() },
                                ]);
                              }
                            } catch {
                              setMessages((prev) => [
                                ...prev,
                                { id: `err-${Date.now()}`, sender: "ai", body: "Couldn't process the order. Try again.", timestamp: Date.now() },
                              ]);
                            }
                          }}
                          onDismiss={() => {
                            setMessages((prev) => [
                              ...prev,
                              { id: `cancel-${Date.now()}`, sender: "ai", body: "No worries — let me know if you change your mind.", timestamp: Date.now() },
                            ]);
                          }}
                        />
                      </motion.div>
                    );
                  }

                  // Default AI chat bubble
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="flex justify-start"
                    >
                      <div
                        className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5"
                        style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
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
                  backgroundColor: vibeColor,
                  boxShadow: `0 2px 10px ${vibeColor}40`,
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
