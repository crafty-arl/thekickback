"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo } from "framer-motion";
import { Venue, getVibeHexColor, getVibeLabel } from "@/lib/venues";

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

const QUICK_ACTIONS = [
  { label: "Vibe check", command: "what's the vibe?" },
  { label: "Menu", command: "menu" },
  { label: "Events", command: "any events tonight?" },
  { label: "Reserve", command: "request a booth" },
  { label: "Hours", command: "hours" },
];

export function VenueDrawer({ venue, onClose }: VenueDrawerProps) {
  const vibeColor = getVibeHexColor(venue.vibe);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

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

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      setDismissed(true);
      setTimeout(onClose, 300);
    }
  }

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={dismissed ? { y: "100%", opacity: 0 } : { y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      drag="y"
      dragConstraints={{ top: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      className="fixed inset-x-0 bottom-0 z-50 flex h-[50dvh] flex-col overflow-hidden rounded-t-[24px] border-t border-white/[0.15]"
      style={{
        background: "rgba(15, 15, 18, 0.65)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow: "0 -8px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {/* Glass shimmer edge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.2) 70%, transparent 100%)",
        }}
      />

      {/* Subtle gradient overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 rounded-t-[24px]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {/* Drag handle */}
      <div className="relative flex justify-center pb-2 pt-3" style={{ touchAction: "none" }}>
        <motion.div
          className="h-1 w-10 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          whileHover={{ scaleX: 1.2, backgroundColor: "rgba(255,255,255,0.4)" }}
        />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: vibeColor }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="font-sans text-[15px] font-semibold text-white/90">
            {venue.name}
          </span>
          <span className="font-sans text-xs text-white/30">
            {getVibeLabel(venue.vibe)} · {venue.occupancy}/{venue.capacity}
          </span>
        </div>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </motion.button>
      </div>

      {/* Divider */}
      <div className="relative mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
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
                  msg.sender === "guest"
                    ? "rounded-br-sm"
                    : "rounded-bl-sm"
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-start"
            >
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex gap-1.5">
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  />
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="no-scrollbar relative overflow-x-auto px-4 py-2">
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
          {QUICK_ACTIONS.map((action, i) => (
            <motion.button
              key={action.command}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => send(action.command)}
              disabled={loading}
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.12)" }}
              whileTap={{ scale: 0.95 }}
              className="flex shrink-0 items-center rounded-full px-3.5 font-sans text-[12px] font-medium text-white/60 disabled:opacity-40"
              style={{
                height: 34,
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div
        className="relative flex items-center gap-2.5 px-4 pt-2"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
      >
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
            height: 46,
            minHeight: 44,
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(8px)",
          }}
        />
        <motion.button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="flex shrink-0 items-center justify-center rounded-full disabled:opacity-30"
          style={{
            backgroundColor: vibeColor,
            width: 44,
            height: 44,
            boxShadow: `0 4px 20px ${vibeColor}40`,
          }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}
