"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo, useAnimationControls } from "framer-motion";
import { Venue, getVibeHexColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";

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

const TABS: { id: Tab; icon: string }[] = [
  { id: "chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "settings", icon: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  settings: "",
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
  const controls = useAnimationControls();

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
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // Animate height on expand/collapse
  useEffect(() => {
    controls.start({
      height: expanded ? "60dvh" : 88,
      borderRadius: expanded ? "24px 24px 0 0" : 20,
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
  }, [input, loading, venue, expanded]);

  function handleTabTap(tab: Tab) {
    setActiveTab(tab);
    if (!expanded) setExpanded(true);

    if (tab === "settings") {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        setMessages((prev) => [...prev, {
          id: `settings-${Date.now()}`, sender: "ai",
          body: user
            ? `Signed in as ${user.email}. Type "sign out" to sign out.`
            : "You're not signed in. Visit /login to create an account.",
          timestamp: Date.now(),
        }]);
      });
      hasSentTabCommand.current.add(tab);
      return;
    }

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
      animate={dismissed
        ? { y: 140, opacity: 0 }
        : { y: 0, opacity: 1 }
      }
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
        className="relative mx-3 flex flex-col overflow-hidden border border-white/[0.12]"
        style={{
          height: 88,
          borderRadius: 20,
          background: "rgba(15, 15, 18, 0.8)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.3), 0 4px 30px rgba(0,0,0,0.2)",
          touchAction: "none",
        }}
      >
        {/* Shimmer edge */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 75%, transparent 100%)",
          }}
        />

        {/* Depth gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: expanded
              ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 20%)"
              : "none",
            borderRadius: "inherit",
          }}
        />

        {/* === TOP SECTION: venue info (visible when expanded) === */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center justify-between px-4 pt-3 pb-1"
          >
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
            <div className="flex items-center gap-1.5">
              <motion.button
                onClick={() => setExpanded(false)}
                whileTap={{ scale: 0.85 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </motion.button>
              <motion.button
                onClick={() => { setDismissed(true); setTimeout(onClose, 300); }}
                whileTap={{ scale: 0.85 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08]"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* === MESSAGES (visible when expanded) === */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mx-3 my-1 h-px bg-white/[0.06]"
          />
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4"
          style={{
            display: expanded ? "block" : "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <div className="flex flex-col gap-2.5">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
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
                          border: "1px solid rgba(255,255,255,0.05)",
                        }
                  }
                >
                  <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                </div>
              </motion.div>
            ))}

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

        {/* === BOTTOM: tabs + input (always visible — the bar itself) === */}
        <div className="relative mt-auto flex items-center gap-1.5 px-2 py-2">
          {/* Collapsed venue pill — only when not expanded */}
          {!expanded && (
            <div className="flex items-center gap-1.5 pl-1 pr-2">
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: vibeColor }} />
              <span className="whitespace-nowrap font-sans text-[12px] font-semibold text-white/80">
                {venue.name}
              </span>
            </div>
          )}

          {/* Tab icons */}
          <div className="flex items-center gap-0.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => handleTabTap(tab.id)}
                  whileTap={{ scale: 0.85 }}
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ color: isActive && expanded ? vibeColor : "rgba(255,255,255,0.3)" }}
                >
                  {isActive && expanded && (
                    <motion.div
                      layoutId="morph-tab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundColor: `${vibeColor}18`,
                        border: `1px solid ${vibeColor}25`,
                      }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    />
                  )}
                  <span className="relative"><TabIcon path={tab.icon} size={14} /></span>
                </motion.button>
              );
            })}
          </div>

          <div className="h-5 w-px shrink-0 bg-white/[0.06]" />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            onFocus={() => { if (!expanded) setExpanded(true); }}
            placeholder={expanded ? "Ask anything..." : "Chat..."}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-full px-3 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
            style={{
              height: 34,
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />

          {/* Send / Close toggle */}
          {!expanded ? (
            <motion.button
              onClick={() => { setDismissed(true); setTimeout(onClose, 300); }}
              whileTap={{ scale: 0.85 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </motion.button>
          ) : (
            <motion.button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              whileTap={{ scale: 0.9 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
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
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
