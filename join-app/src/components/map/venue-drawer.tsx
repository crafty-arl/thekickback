"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Venue, getVibeHexColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
}

interface VenueDrawerProps {
  venue: Venue;
  onClose: () => void;
}

type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "settings", label: "Settings", icon: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  settings: "show me my settings and preferences",
};

function TabIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export function VenueDrawer({ venue, onClose }: VenueDrawerProps) {
  const vibeColor = getVibeHexColor(venue.vibe);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [dismissed, setDismissed] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      body: `Hey — welcome to ${venue.name}. ${venue.vibe === "quiet" ? "Quiet right now." : venue.vibe === "busy" ? "Pretty lively." : venue.vibe === "lit" ? "It's going off." : "Moderate crowd."} ${venue.occupancy} people here. Ask me anything.`,
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
    if (expanded) {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [expanded]);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

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
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          body: data.reply || "Couldn't reach the venue right now. Try again.",
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
  }, [input, loading, venue]);

  function handleTabTap(tab: Tab) {
    setActiveTab(tab);
    if (!expanded) setExpanded(true);
    const cmd = TAB_COMMANDS[tab];
    if (cmd && !hasSentTabCommand.current.has(tab)) {
      hasSentTabCommand.current.add(tab);
      send(cmd);
    }
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      if (expanded) {
        setExpanded(false);
      } else {
        setDismissed(true);
        setTimeout(onClose, 300);
      }
    }
  }

  function handleClose() {
    setDismissed(true);
    setTimeout(onClose, 300);
  }

  const pct = getOccupancyPercent(venue);

  return (
    <motion.div
      initial={{ y: 200 }}
      animate={dismissed ? { y: 200 } : { y: 0 }}
      exit={{ y: 200 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
    >
      {/* ===== DOCKED HUD — always visible ===== */}
      <div
        className="relative rounded-t-[20px] border-t border-white/[0.12]"
        style={{
          background: "rgba(15, 15, 18, 0.7)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.2)",
        }}
      >
        {/* Shimmer */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-[20px]"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 70%, transparent 100%)",
          }}
        />

        {/* Venue info row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ touchAction: "none" }}>
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: vibeColor }}
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="font-sans text-[14px] font-semibold text-white/90">{venue.name}</span>
            <span className="font-sans text-[11px] text-white/30">
              {getVibeLabel(venue.vibe)} · {pct}%
            </span>
          </div>
          <motion.button
            onClick={handleClose}
            whileTap={{ scale: 0.85 }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </motion.button>
        </div>

        {/* Tab icons row */}
        <div className="flex items-center justify-around px-2 pb-3">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id && expanded;
            return (
              <motion.button
                key={tab.id}
                onClick={() => handleTabTap(tab.id)}
                whileTap={{ scale: 0.85 }}
                className="relative flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5"
                style={{ color: isActive ? vibeColor : "rgba(255,255,255,0.35)" }}
              >
                {isActive && (
                  <motion.div
                    layoutId="hud-tab"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      boxShadow: `0 0 10px ${vibeColor}20`,
                    }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  />
                )}
                <span className="relative"><TabIcon path={tab.icon} size={18} /></span>
                <span className="relative font-sans text-[9px] font-medium">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ===== EXPANDED CHAT — slides up from behind the HUD ===== */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "50dvh", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="flex flex-col overflow-hidden"
            style={{
              background: "rgba(15, 15, 18, 0.65)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              touchAction: "none",
            }}
          >
            {/* Divider */}
            <div className="mx-4 h-px bg-white/[0.06]" />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex flex-col gap-2.5">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                        msg.sender === "guest" ? "rounded-br-sm" : "rounded-bl-sm"
                      }`}
                      style={
                        msg.sender === "guest"
                          ? {
                              backgroundColor: vibeColor,
                              color: "#000",
                              boxShadow: `0 2px 12px ${vibeColor}33`,
                            }
                          : {
                              backgroundColor: "rgba(255,255,255,0.07)",
                              color: "rgba(255,255,255,0.8)",
                              backdropFilter: "blur(8px)",
                              border: "1px solid rgba(255,255,255,0.05)",
                            }
                      }
                    >
                      <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-start">
                    <div
                      className="rounded-2xl rounded-bl-sm px-4 py-3"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.07)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
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
            <div className="flex items-center gap-2 px-4 pt-2 pb-3">
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
                className="flex-1 rounded-full px-4 font-sans text-[14px] text-white placeholder:text-white/25 focus:outline-none"
                style={{
                  height: 42,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <motion.button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.9 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{
                  backgroundColor: vibeColor,
                  boxShadow: `0 2px 12px ${vibeColor}40`,
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
