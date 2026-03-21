"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OwnerMessageBody } from "./owner-message-body";
import { HubPreviewEditable } from "./hub-preview-editable";
import type { ChecklistState } from "./onboarding-checklist";
import type { HubData } from "./hub-preview";
import { updateVenue, updateVenuePage } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";
import { OrdersPanel } from "@/components/dashboard/orders-panel";
import Link from "next/link";

import type { VenueStats, GuestSession, VenueRequest, ChatMessage, VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";
import type { Booking } from "@/components/dashboard/bookings-panel";
import type { Order, RevenueStats, VenueTransaction } from "@/components/dashboard/orders-panel";

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
  transactions: VenueTransaction[];
  messages: ChatMessage[];
  perks: VenuePerk[];
  redemptions: PerkRedemption[];
  multipliers: VenueMultiplier[];
  leaderboard: PointLeaderboardEntry[];
}

interface OwnerDockProps {
  initialData: DashboardData;
  venue: { id: string; name: string; state: string; occupancy: number; max_occupancy: number; vibe: string; type?: string; address?: string };
  reviewStatus?: string;
  user: { id: string; email: string };
  pageData?: {
    slug: string;
    tagline: string | null;
    description: string | null;
    theme_color: string;
    hours: { day: string; open: string; close: string }[] | null;
    hero_image: string | null;
  };
  offerings?: { id: string; name: string; type: string; price_cents: number; description?: string }[];
  gallery?: { id: string; image_url: string }[];
  xpActions?: { label: string; points: number }[];
  xpMilestones?: { name: string; threshold: number }[];
  checklist?: Record<string, boolean>;
}

type ActiveView = "hub" | "chat" | "orders" | "guests";

const DEFAULT_CHECKLIST: ChecklistState = {
  basics: false, location: false, hours: false, branding: false,
  offerings: false, knowledge: false, photos: false, xp: false, stripe: false,
};

function getItemPrompt(key: keyof ChecklistState): string {
  const prompts: Record<keyof ChecklistState, string> = {
    basics: "Let\u2019s confirm your hub name and type are right.",
    location: "Let\u2019s make sure your address is correct.",
    hours: "What are your operating hours? You can edit them in the preview too.",
    branding: "Time to set your tagline, description, and theme color. Tap any section in the preview to edit.",
    offerings: "Review the offerings we auto-generated. You can edit them from the preview or your dashboard later.",
    knowledge: "Teach your AI about your spot \u2014 what should it know that isn\u2019t obvious? Signature drinks, house rules, parking tips?",
    photos: "Upload at least one photo. Tap the photos section in the preview to add images.",
    xp: "Review your loyalty program \u2014 we set up XP actions and milestones based on your hub type.",
    stripe: "Connect Stripe so you can accept payments. Head to Settings to get started.",
  };
  return prompts[key];
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const tierColors: Record<string, string> = {
  explorer: "#94a3b8",
  regular: "#4ade80",
  member: "#f97316",
  vip: "#a78bfa",
};

// ─── Nav items ──────────────────────────────────────────────────────

const NAV_ITEMS: { id: ActiveView; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: "hub",
    label: "Hub",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "orders",
    label: "Orders",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: "guests",
    label: "Guests",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function OwnerDock({ initialData, venue, reviewStatus, user, pageData, offerings: initialOfferings, gallery: initialGallery, xpActions: initialXpActions, xpMilestones: initialXpMilestones, checklist: initialChecklist }: OwnerDockProps) {
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<
    "fresh" | "stats_shown" | "bookings_shown" | "mutation_done"
  >("fresh");
  const [activeView, setActiveView] = useState<ActiveView>("hub");
  const [checklistState, setChecklistState] = useState<ChecklistState>(
    initialChecklist ? { ...DEFAULT_CHECKLIST, ...initialChecklist } as ChecklistState : DEFAULT_CHECKLIST
  );

  // Editable preview state
  const [hubData, setHubData] = useState<HubData>(() => {
    const hoursStr = pageData?.hours && Array.isArray(pageData.hours) && pageData.hours.length > 0
      ? pageData.hours.map((h) => `${h.day}: ${h.open}${h.close ? `-${h.close}` : ""}`).join(", ")
      : "";
    return {
      name: venue.name,
      type: venue.type || "",
      address: venue.address || "",
      tagline: pageData?.tagline || "",
      description: pageData?.description || "",
      themeColor: pageData?.theme_color || "#F97316",
      hours: hoursStr,
      capacity: venue.max_occupancy,
      slug: pageData?.slug || "",
    };
  });
  const [galleryImages, setGalleryImages] = useState(initialGallery || []);
  const [offeringsState, setOfferingsState] = useState(initialOfferings || []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isApproved = !reviewStatus || reviewStatus === "approved";
  const isPreApproval = reviewStatus && reviewStatus !== "approved";
  const checklistCompleted = Object.values(checklistState).filter(Boolean).length;
  const checklistTotal = Object.keys(checklistState).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  const feeRate = initialData.revenueStats?.platformFeeRate || 0.10;
  const todayEarnings = Math.round((initialData.revenueStats?.todayRevenue || 0) * (1 - feeRate));
  const pendingBookings = initialData.bookings.filter(
    (b) => new Date(b.starts_at) > new Date() && b.cal_status === "pending"
  ).length;
  const occupancyPct = venue.max_occupancy > 0 ? Math.round((initialData.stats.currentOccupancy / venue.max_occupancy) * 100) : 0;

  // ─── Scroll helper ──────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  // ─── Welcome message on mount ───────────────────────────────────

  useEffect(() => {
    if (isApproved) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
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
    } else {
      const statusLabel = reviewStatus === "pending" ? "under review" : reviewStatus === "rejected" ? "needs updates" : "in draft";
      const completed = Object.values(checklistState).filter(Boolean).length;
      const firstIncomplete = (Object.keys(checklistState) as (keyof ChecklistState)[]).find((k) => !checklistState[k]);

      const welcome = `Your hub is ${statusLabel}. Setup is ${Math.round((completed / 9) * 100)}% complete. ${firstIncomplete ? getItemPrompt(firstIncomplete) : "Looking good!"}`;
      setMessages([
        {
          id: "welcome",
          sender: "agent",
          body: welcome,
          timestamp: Date.now(),
        },
      ]);
    }
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

      // Auto-switch to chat when sending from another view
      if (activeView !== "chat") {
        setActiveView("chat");
      }

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
    [input, venue.id, scrollToBottom, activeView]
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

  // ─── Editable preview handlers ─────────────────────────────────

  const handleFieldSave = useCallback(async (field: string, value: unknown) => {
    if (field === "name_tagline") {
      const { name } = value as { name: string; tagline: string };
      await updateVenue(venue.id, { name });
      setHubData((prev) => ({ ...prev, name }));
    } else if (field === "tagline") {
      await updateVenuePage(venue.id, { tagline: value as string });
      setHubData((prev) => ({ ...prev, tagline: value as string }));
    } else if (field === "theme_color") {
      await updateVenuePage(venue.id, { theme_color: value as string });
      setHubData((prev) => ({ ...prev, themeColor: value as string }));
    } else if (field === "hours") {
      const hoursArr = [{ day: "Daily", open: value as string, close: "" }];
      await updateVenuePage(venue.id, { hours: hoursArr });
      setHubData((prev) => ({ ...prev, hours: value as string }));
    } else if (field === "description") {
      await updateVenuePage(venue.id, { description: value as string });
      setHubData((prev) => ({ ...prev, description: value as string }));
    }
  }, [venue.id]);

  const handlePhotoUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadGalleryImage(venue.id, formData);
    if (result && "url" in result && result.url) {
      setGalleryImages((prev) => [...prev, { id: `new-${Date.now()}`, image_url: result.url as string }]);
    }
  }, [venue.id]);

  const handleSectionEdited = useCallback((key: string) => {
    if (key in checklistState) {
      const newState = { ...checklistState, [key]: true };
      setChecklistState(newState as ChecklistState);
      fetch("/api/onboarding/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: key, completed: true }),
      }).catch(() => {});
    }
  }, [checklistState]);

  // ─── Quick replies ─────────────────────────────────────────────

  function getQuickReplies(): string[] {
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

  // ─── Format cents helper ─────────────────────────────────────────

  function fmtCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // ─── Canvas content ─────────────────────────────────────────────

  const renderCanvas = () => {
    switch (activeView) {
      case "hub":
        return (
          <div className="h-full overflow-y-auto no-scrollbar">
            <HubPreviewEditable
              data={hubData}
              venueId={venue.id}
              offerings={offeringsState}
              galleryImages={galleryImages}
              xpActions={initialXpActions}
              xpMilestones={initialXpMilestones}
              onFieldSave={handleFieldSave}
              onPhotoUpload={handlePhotoUpload}
              onSectionEdited={handleSectionEdited}
            />
          </div>
        );

      case "chat":
        return (
          <div className="flex h-full flex-col">
            {/* Messages */}
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
                    className={`mb-3 flex ${msg.sender === "owner" ? "justify-end" : "justify-start"}`}
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
                        <p className="font-sans text-[14px] leading-[1.6]">{msg.body}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-3">
                  <div
                    className="rounded-2xl rounded-bl-sm px-4 py-3"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.07)",
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

              <div ref={messagesEndRef} />
            </div>

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
          </div>
        );

      case "orders":
        return (
          <div className="h-full overflow-y-auto p-4 lg:p-6 no-scrollbar">
            <OrdersPanel
              orders={initialData.orders}
              revenue={initialData.revenueStats}
              transactions={initialData.transactions}
            />
          </div>
        );

      case "guests":
        return (
          <div className="h-full overflow-y-auto p-4 lg:p-6 no-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-[16px] font-semibold text-white/80">
                Active Guests
              </h2>
              <span className="font-sans text-[13px] text-white/30">
                {initialData.sessions.length} checked in
              </span>
            </div>

            {initialData.sessions.length === 0 ? (
              <div
                className="rounded-2xl px-6 py-12 text-center"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="font-sans text-[15px] font-medium text-white/40">No active guests</p>
                <p className="mt-1 font-sans text-[13px] text-white/25">When guests check in, they show up here</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {initialData.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-sans text-[14px] font-medium text-white/85 truncate">
                          {session.profiles?.display_name ?? "Guest"}
                        </p>
                        {session.tier && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tierColors[session.tier] ?? tierColors.explorer}20`,
                              color: tierColors[session.tier] ?? tierColors.explorer,
                            }}
                          >
                            {session.tier}
                          </span>
                        )}
                      </div>
                      <p className="font-sans text-[11px] text-white/35">
                        {session.venue_xp ?? 0} XP
                        {session.started_at && <> &middot; checked in {relativeTime(session.started_at)}</>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <main className="flex h-dvh flex-col bg-black">
      {/* ═══ Header ═══ */}
      <header
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${isApproved ? "bg-green-400 animate-pulse" : "bg-orange"}`} />
          <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
          <span className="font-sans text-[11px] text-white/30">
            {isApproved ? (venue.state === "active" ? "Live" : "Closed") : (reviewStatus === "pending" ? "In Review" : reviewStatus === "rejected" ? "Needs Updates" : "Draft")}
          </span>
          {isApproved && initialData.stats.currentOccupancy > 0 && (
            <span className="font-sans text-[11px] text-white/30">
              &middot; {initialData.stats.currentOccupancy} in
            </span>
          )}
          {/* Review status badge */}
          {isPreApproval && (
            <span
              className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold"
              style={{
                backgroundColor: reviewStatus === "pending" ? "rgba(249,115,22,0.12)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                color: reviewStatus === "pending" ? "#F97316" : reviewStatus === "rejected" ? "#EF4444" : "rgba(255,255,255,0.5)",
              }}
            >
              {reviewStatus === "pending" ? "Under Review" : reviewStatus === "rejected" ? "Not Approved" : "Draft"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <Link
              href="/scan"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-black"
              style={{ backgroundColor: "#F97316" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              </svg>
              QR
            </Link>
          )}
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/60"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ═══ Body: sidebar + canvas ═══ */}
      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar (desktop only) ── */}
        <aside
          className="hidden lg:flex w-[240px] shrink-0 flex-col"
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Stats section */}
          <div className="px-4 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Today's earnings */}
            <div>
              <p className="font-sans text-[10px] font-medium text-white/30 uppercase tracking-wider">Today&apos;s earnings</p>
              <p className="font-mono text-[24px] font-bold tracking-tight" style={{ color: "#16a34a" }}>
                {fmtCents(todayEarnings)}
              </p>
            </div>

            {/* Occupancy bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="font-sans text-[10px] font-medium text-white/30 uppercase tracking-wider">Occupancy</p>
                <p className="font-sans text-[11px] text-white/50">{initialData.stats.currentOccupancy}/{venue.max_occupancy}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${occupancyPct}%`, backgroundColor: "#F97316" }}
                />
              </div>
            </div>

            {/* Compact stats */}
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] text-white/30">Bookings today</span>
              <span className="font-sans text-[13px] font-semibold text-white/70" style={{ color: "#F97316" }}>{pendingBookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] text-white/30">Members</span>
              <span className="font-sans text-[13px] font-semibold text-white/70">{initialData.stats.members}</span>
            </div>
          </div>

          {/* Nav section */}
          <nav className="flex-1 px-2 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-[13px] font-medium transition ${
                    isActive ? "text-orange" : "text-white/40 hover:text-white/60"
                  }`}
                  style={{
                    backgroundColor: isActive ? "rgba(249,115,22,0.1)" : "transparent",
                    borderLeft: isActive ? "2px solid #F97316" : "2px solid transparent",
                  }}
                >
                  {item.icon(isActive)}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Setup progress (if < 100%) */}
          {checklistPercent < 100 && (
            <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => setActiveView("hub")}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-sans text-[11px] font-semibold text-white/40">Setup</span>
                  <span className="font-sans text-[11px] font-bold text-orange">{checklistPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${checklistPercent}%`, backgroundColor: "#F97316" }}
                  />
                </div>
              </button>
            </div>
          )}

          {/* Settings link */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link
              href="/settings"
              className="flex items-center gap-2 font-sans text-[12px] text-white/30 hover:text-white/50 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </Link>
          </div>
        </aside>

        {/* ── Main Canvas ── */}
        <div className="flex-1 min-w-0 min-h-0">
          {renderCanvas()}
        </div>
      </div>

      {/* ═══ Input bar (always visible) ═══ */}
      <div
        className="shrink-0"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-end gap-2 px-4 py-2">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ Mobile Bottom Tab Bar ═══ */}
      <div
        className="flex h-12 shrink-0 items-stretch lg:hidden"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 font-sans text-[10px] font-medium transition ${
                isActive ? "text-orange" : "text-white/30"
              }`}
            >
              {item.icon(isActive)}
              {item.label}
            </button>
          );
        })}
      </div>
    </main>
  );
}
