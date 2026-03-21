"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OwnerMessageBody } from "./owner-message-body";
import Link from "next/link";

import type { VenueStats, GuestSession, VenueRequest, ChatMessage, VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";
import type { Booking } from "@/components/dashboard/bookings-panel";
import type { Order, RevenueStats } from "@/components/dashboard/orders-panel";

// ─── Types ──────────────────────────────────────────────────────────

interface OwnerMessage {
  id: string;
  sender: "owner" | "agent";
  body: string;
  timestamp: number;
}

interface DashboardData {
  stats: VenueStats;
  sessions: GuestSession[];
  requests: VenueRequest[];
  bookings: Booking[];
  orders: Order[];
  revenueStats: RevenueStats;
  messages: ChatMessage[];
  perks: VenuePerk[];
  redemptions: PerkRedemption[];
  multipliers: VenueMultiplier[];
  leaderboard: PointLeaderboardEntry[];
}

interface OwnerDockProps {
  initialData: DashboardData;
  venue: { id: string; name: string; state: string; occupancy: number; max_occupancy: number; vibe: string };
  reviewStatus?: string;
  user: { id: string; email: string };
}

// ─── Component ──────────────────────────────────────────────────────

export function OwnerDock({ initialData, venue, reviewStatus, user }: OwnerDockProps) {
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<
    "fresh" | "stats_shown" | "bookings_shown" | "mutation_done"
  >("fresh");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ─── Scroll helper ──────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  // ─── Welcome message on mount ───────────────────────────────────

  useEffect(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    const pendingBookings = initialData.bookings.filter(
      (b) => new Date(b.starts_at) > new Date() && b.cal_status === "pending"
    ).length;
    const statsJson = JSON.stringify({
      occupancy: initialData.stats.currentOccupancy,
      capacity: initialData.stats.capacity,
      visitorsToday: initialData.stats.totalToday,
      revenue: 0,
      members: initialData.stats.members,
    });
    const welcome = `${greeting}. ${initialData.stats.currentOccupancy} people in, ${pendingBookings} bookings pending, ${initialData.stats.totalToday} visitors today. What do you need?\n\n[[STATS:${statsJson}]]`;

    setMessages([
      {
        id: "welcome",
        sender: "agent",
        body: welcome,
        timestamp: Date.now(),
      },
    ]);
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Virtual keyboard handler ───────────────────────────────────

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => scrollToBottom();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollToBottom]);

  // ─── Send message ───────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg) return;

      const ownerMsg: OwnerMessage = {
        id: `owner-${Date.now()}`,
        sender: "owner",
        body: msg,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, ownerMsg]);
      setInput("");
      setLoading(true);
      scrollToBottom();

      try {
        const res = await fetch("/api/chat/owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, venueId: venue.id }),
        });

        const data = await res.json();
        const agentBody = data.reply || data.message || "Sorry, I couldn't process that.";

        const agentMsg: OwnerMessage = {
          id: `agent-${Date.now()}`,
          sender: "agent",
          body: agentBody,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, agentMsg]);

        // Update conversation phase based on response tags
        if (agentBody.includes("[[STATS:")) setConversationPhase("stats_shown");
        if (agentBody.includes("[[BOOKINGS:")) setConversationPhase("bookings_shown");
        if (agentBody.includes("[[GUESTS:")) setConversationPhase("stats_shown");
        if (agentBody.includes("[[ACTION_CONFIRM:")) setConversationPhase("mutation_done");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: "agent",
            body: "Something went wrong. Try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [input, venue.id, scrollToBottom]
  );

  // ─── Booking actions ───────────────────────────────────────────

  const handleApproveBooking = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "confirm_action",
            venueId: venue.id,
            action: { type: "approve_booking", id },
          }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-approve-${Date.now()}`,
            sender: "agent",
            body: data.reply || data.message || "Booking approved.",
            timestamp: Date.now(),
          },
        ]);
        setConversationPhase("mutation_done");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: "agent",
            body: "Failed to approve booking. Try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [venue.id, scrollToBottom]
  );

  const handleDeclineBooking = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "confirm_action",
            venueId: venue.id,
            action: { type: "decline_booking", id },
          }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-decline-${Date.now()}`,
            sender: "agent",
            body: data.reply || data.message || "Booking declined.",
            timestamp: Date.now(),
          },
        ]);
        setConversationPhase("mutation_done");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: "agent",
            body: "Failed to decline booking. Try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [venue.id, scrollToBottom]
  );

  // ─── Quick replies ─────────────────────────────────────────────

  function getQuickReplies(): string[] {
    const pendingBookings = initialData.bookings.filter(
      (b) => new Date(b.starts_at) > new Date() && b.cal_status === "pending"
    ).length;
    const activeSessions = initialData.sessions.length;

    switch (conversationPhase) {
      case "fresh": {
        const hour = new Date().getHours();
        const replies: string[] = [];
        replies.push(hour < 12 ? "Morning summary" : "How's tonight going?");
        if (pendingBookings > 0) replies.push("Show bookings");
        if (activeSessions > 0) replies.push("Who's here?");
        replies.push("Revenue today");
        return replies;
      }
      case "stats_shown":
        return ["Any pending bookings?", "Guest list", "Compare to last week", "Add an offering"];
      case "bookings_shown":
        return pendingBookings > 0
          ? ["Approve all pending", "Past bookings"]
          : ["Past bookings", "Create an event"];
      case "mutation_done":
        return ["What else?", "Show updated stats", "Change something else"];
      default:
        return [
          "Create an event",
          "Update hours",
          "Add knowledge",
          "Change venue name",
          "Set up loyalty",
          "Set AI chat limits",
        ];
    }
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div style={{ height: "100dvh" }} className="flex flex-col bg-black">
      {/* ── Pre-approval gate ── */}
      {reviewStatus && reviewStatus !== "approved" && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{
            backgroundColor: reviewStatus === "pending" ? "rgba(249,115,22,0.15)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
          }}>
            {reviewStatus === "pending" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            {reviewStatus === "rejected" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            {reviewStatus === "draft" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
          </div>
          <h2 className="mb-2 font-sans text-[20px] font-bold text-white/90">
            {reviewStatus === "pending" && "Under Review"}
            {reviewStatus === "rejected" && "Not Approved"}
            {reviewStatus === "draft" && "Draft"}
          </h2>
          <p className="mb-6 max-w-sm font-sans text-[14px] leading-[1.6] text-white/45">
            {reviewStatus === "pending" && "Your hub is being reviewed by our team. We\u2019ll email you once it\u2019s approved. You can edit your settings while you wait."}
            {reviewStatus === "rejected" && "Your hub wasn\u2019t approved this time. Check your email for details, update your settings, and resubmit."}
            {reviewStatus === "draft" && "Your hub is saved but not submitted yet. Finish setting it up and submit for review to go live."}
          </p>
          <div className="flex gap-3">
            <Link
              href="/settings"
              className="rounded-xl px-6 py-3 font-sans text-[14px] font-bold text-black active:scale-[0.98]"
              style={{ backgroundColor: "#F97316" }}
            >
              {reviewStatus === "rejected" ? "Edit & Resubmit" : "Edit Settings"}
            </Link>
          </div>
          <p className="mt-8 font-sans text-[12px] text-white/20">{venue.name}</p>
        </div>
      )}
      {/* ── Full dashboard (approved only) ── */}
      {(!reviewStatus || reviewStatus === "approved") && <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-sans text-[15px] font-semibold text-white/90">
            {venue.name}
          </span>
          <span className="font-sans text-[11px] text-white/30">
            {venue.state === "active" ? "Open" : "Closed"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-black"
            style={{ backgroundColor: "#F97316" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
            Scan
          </Link>
          <Link
            href="/settings"
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/40 hover:text-white/60"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        </div>
      </header>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 no-scrollbar"
        style={{ touchAction: "pan-y" }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`mb-3 flex ${
                msg.sender === "owner" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.sender === "owner"
                    ? "rounded-br-sm bg-orange/15 text-white/90"
                    : "rounded-bl-sm"
                }`}
                style={
                  msg.sender === "agent"
                    ? {
                        backgroundColor: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }
                    : undefined
                }
              >
                {msg.sender === "agent" ? (
                  <OwnerMessageBody
                    body={msg.body}
                    onApproveBooking={handleApproveBooking}
                    onDeclineBooking={handleDeclineBooking}
                  />
                ) : (
                  <p className="font-sans text-[14px] leading-[1.6]">
                    {msg.body}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start mb-3"
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

        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies + Input */}
      <div
        className="border-t border-white/[0.06]"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {/* Quick replies */}
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
          {getQuickReplies().map((reply) => (
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium text-white/50 active:scale-95 transition"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="flex items-end gap-2 px-4 pb-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message your agent..."
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 rounded-2xl px-4 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 outline-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-orange transition active:scale-95 disabled:opacity-30"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      </>}
    </div>
  );
}
