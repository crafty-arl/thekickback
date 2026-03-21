"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { OwnerMessageBody } from "./owner-message-body";
import { HubPreviewEditable } from "./hub-preview-editable";
import type { ChecklistState } from "./onboarding-checklist";
import type { HubData } from "./hub-preview";
import { updateVenue, updateVenuePage } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";
import { OrdersPanel } from "@/components/dashboard/orders-panel";
import { StripeConnect } from "@/components/dashboard/stripe-connect";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

import type {
  VenueStats,
  GuestSession,
  VenueRequest,
  ChatMessage,
  VenuePerk,
  PerkRedemption,
  VenueMultiplier,
  PointLeaderboardEntry,
} from "@/lib/dashboard";
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
  venue: {
    id: string;
    name: string;
    state: string;
    occupancy: number;
    max_occupancy: number;
    vibe: string;
    type?: string;
    address?: string;
  };
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
  offerings?: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }[];
  gallery?: { id: string; image_url: string }[];
  xpActions?: { label: string; points: number }[];
  xpMilestones?: { name: string; threshold: number }[];
  checklist?: Record<string, boolean>;
}

const DEFAULT_CHECKLIST: ChecklistState = {
  basics: false,
  location: false,
  hours: false,
  branding: false,
  offerings: false,
  knowledge: false,
  photos: false,
  xp: false,
  stripe: false,
};

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

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Tab icon components ────────────────────────────────────────────

function HubIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function GuestsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </svg>
  );
}

// ─── Sub-components for More tab sheets ─────────────────────────────

function MoreMenuItem({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-white/[0.04]"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[18px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-medium text-white/80">{label}</p>
        <p className="font-sans text-[11px] text-white/30">{desc}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function OwnerDock({
  initialData,
  venue,
  reviewStatus,
  user,
  pageData,
  offerings: initialOfferings,
  gallery: initialGallery,
  xpActions: initialXpActions,
  xpMilestones: initialXpMilestones,
  checklist: initialChecklist,
}: OwnerDockProps) {
  const [activeTab, setActiveTab] = useState(0);

  // AI Chat state (Hub tab)
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<
    "fresh" | "stats_shown" | "bookings_shown" | "mutation_done"
  >("fresh");

  // Checklist
  const [checklistState, setChecklistState] = useState<ChecklistState>(
    initialChecklist
      ? ({ ...DEFAULT_CHECKLIST, ...initialChecklist } as ChecklistState)
      : DEFAULT_CHECKLIST
  );

  // Editable preview state
  const [hubData, setHubData] = useState<HubData>(() => {
    const hoursStr =
      pageData?.hours && Array.isArray(pageData.hours) && pageData.hours.length > 0
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
  const [offeringsState] = useState(initialOfferings || []);

  // Seed demo state
  const [seeding, setSeeding] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isApproved = !reviewStatus || reviewStatus === "approved";
  const isPreApproval = reviewStatus && reviewStatus !== "approved";
  const checklistCompleted = Object.values(checklistState).filter(Boolean).length;
  const checklistTotal = Object.keys(checklistState).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  const feeRate = initialData.revenueStats?.platformFeeRate || 0.1;
  const pendingBookings = initialData.bookings.filter(
    (b) => new Date(b.starts_at) > new Date() && b.cal_status === "pending"
  ).length;

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
      setMessages([{ id: "welcome", sender: "agent", body: welcome, timestamp: Date.now() }]);
    } else {
      const statusLabel =
        reviewStatus === "pending"
          ? "under review"
          : reviewStatus === "rejected"
            ? "needs updates"
            : "in draft";
      const completed = Object.values(checklistState).filter(Boolean).length;
      const firstIncomplete = (Object.keys(checklistState) as (keyof ChecklistState)[]).find(
        (k) => !checklistState[k]
      );
      const welcome = `Your hub is ${statusLabel}. Setup is ${Math.round((completed / 9) * 100)}% complete. ${firstIncomplete ? `Let's work on: ${firstIncomplete}` : "Looking good!"}`;
      setMessages([{ id: "welcome", sender: "agent", body: welcome, timestamp: Date.now() }]);
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
          { id: `error-${Date.now()}`, sender: "agent", body: "Something went wrong. Try again.", timestamp: Date.now() },
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
          body: JSON.stringify({ message: "confirm_action", venueId: venue.id, action: { type: "approve_booking", id } }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: `agent-approve-${Date.now()}`, sender: "agent", body: data.reply || data.message || "Booking approved.", timestamp: Date.now() },
        ]);
        setConversationPhase("mutation_done");
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, sender: "agent", body: "Failed to approve booking. Try again.", timestamp: Date.now() },
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
          body: JSON.stringify({ message: "confirm_action", venueId: venue.id, action: { type: "decline_booking", id } }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: `agent-decline-${Date.now()}`, sender: "agent", body: data.reply || data.message || "Booking declined.", timestamp: Date.now() },
        ]);
        setConversationPhase("mutation_done");
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, sender: "agent", body: "Failed to decline booking. Try again.", timestamp: Date.now() },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [venue.id, scrollToBottom]
  );

  // ─── Editable preview handlers ─────────────────────────────────

  const handleFieldSave = useCallback(
    async (field: string, value: unknown) => {
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
    },
    [venue.id]
  );

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadGalleryImage(venue.id, formData);
      if (result && "url" in result && result.url) {
        setGalleryImages((prev) => [...prev, { id: `new-${Date.now()}`, image_url: result.url as string }]);
      }
    },
    [venue.id]
  );

  const handleSectionEdited = useCallback(
    (key: string) => {
      if (key in checklistState) {
        const newState = { ...checklistState, [key]: true };
        setChecklistState(newState as ChecklistState);
        fetch("/api/onboarding/checklist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: key, completed: true }),
        }).catch(() => {});
      }
    },
    [checklistState]
  );

  // ─── Quick replies ────────────────────────────────────────────

  function getQuickReplies(): string[] {
    switch (conversationPhase) {
      case "fresh": {
        const hour = new Date().getHours();
        const replies: string[] = [];
        replies.push(hour < 12 ? "Morning summary" : "How's tonight going?");
        if (pendingBookings > 0) replies.push("Show bookings");
        if (initialData.sessions.length > 0) replies.push("Who's here?");
        replies.push("Revenue today");
        return replies;
      }
      case "stats_shown":
        return ["Any pending bookings?", "Guest list", "Compare to last week", "Add an offering"];
      case "bookings_shown":
        return pendingBookings > 0 ? ["Approve all pending", "Past bookings"] : ["Past bookings", "Create an event"];
      case "mutation_done":
        return ["What else?", "Show updated stats", "Change something else"];
      default:
        return ["Create an event", "Update hours", "Add knowledge", "Change venue name"];
    }
  }

  // ─── Seed demo ────────────────────────────────────────────────

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed-demo", { method: "POST" });
      window.location.reload();
    } catch {
      setSeeding(false);
    }
  };

  // ─── Status badge helper ──────────────────────────────────────

  const statusText = isApproved
    ? venue.state === "active"
      ? "Live"
      : "Closed"
    : reviewStatus === "pending"
      ? "In Review"
      : reviewStatus === "rejected"
        ? "Needs Updates"
        : "Draft";

  const statusColor = isApproved
    ? "#4ade80"
    : reviewStatus === "pending"
      ? "#F97316"
      : reviewStatus === "rejected"
        ? "#EF4444"
        : "rgba(255,255,255,0.5)";

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="flex h-dvh flex-col bg-black">
      {/* ═══ Header ═══ */}
      <header
        className="flex h-14 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          {/* Logo */}
          <span className="font-sans text-[14px] font-bold tracking-tight text-white/90">
            <span style={{ color: "#F97316" }}>the</span>KickBack
          </span>
          {/* Separator */}
          <div className="h-4 w-px bg-white/10" />
          {/* Venue name + status */}
          <span className="font-sans text-[14px] font-semibold text-white/70">{venue.name}</span>
          <Badge
            className="h-5 rounded-full border-0 px-2 text-[10px] font-semibold"
            style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
          >
            {statusText}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {isApproved && (
            <Link
              href="/scan"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-black transition active:scale-95"
              style={{ backgroundColor: "#F97316" }}
            >
              <ScanIcon />
              Scan
            </Link>
          )}
          <span className="font-mono text-[10px] text-white/20">v1.0.0</span>
        </div>
      </header>

      {/* ═══ Tab Content Area ═══ */}
      <Tabs
        defaultValue={0}
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as number)}
        className="flex flex-1 flex-col min-h-0 gap-0"
      >
        {/* Desktop top tab bar */}
        <div
          className="hidden lg:block shrink-0 px-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <TabsList
            variant="line"
            className="h-10 w-full justify-start gap-0 bg-transparent p-0"
          >
            <TabsTrigger
              value={0}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-white/40 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <HubIcon active={activeTab === 0} />
              Hub
            </TabsTrigger>
            <TabsTrigger
              value={1}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-white/40 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <OrdersIcon active={activeTab === 1} />
              Orders
            </TabsTrigger>
            <TabsTrigger
              value={2}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-white/40 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <GuestsIcon active={activeTab === 2} />
              Guests
            </TabsTrigger>
            <TabsTrigger
              value={3}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-white/40 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <MoreIcon active={activeTab === 3} />
              More
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: Hub ── */}
        <TabsContent value={0} className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-1 min-h-0">
            {/* Edit fields */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              {/* Setup progress (if < 100%) */}
              {checklistPercent < 100 && (
                <div
                  className="shrink-0 mx-4 mt-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-sans text-[11px] font-semibold text-white/50">Setup Progress</span>
                    <span className="font-sans text-[11px] font-bold" style={{ color: "#F97316" }}>
                      {checklistPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${checklistPercent}%`, backgroundColor: "#F97316" }}
                    />
                  </div>
                </div>
              )}

              {/* Hub preview editable */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
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

              {/* AI chat at bottom of Hub */}
              <div
                className="shrink-0"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingBottom: "max(4px, env(safe-area-inset-bottom))",
                }}
              >
                {/* Chat messages (collapsed, shows last message) */}
                {messages.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto px-4 pt-2 no-scrollbar">
                    <div ref={messagesContainerRef}>
                      <AnimatePresence initial={false}>
                        {messages.slice(-3).map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className={`mb-2 flex ${msg.sender === "owner" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                msg.sender === "owner"
                                  ? "rounded-br-sm bg-orange/15 text-white/90"
                                  : "rounded-bl-sm"
                              }`}
                              style={
                                msg.sender === "agent"
                                  ? { backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }
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
                                <p className="font-sans text-[13px] leading-[1.5]">{msg.body}</p>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-2">
                          <div
                            className="rounded-2xl rounded-bl-sm px-3 py-2"
                            style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            <div className="flex gap-1.5">
                              <motion.div className="h-1.5 w-1.5 rounded-full bg-white/30" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                              <motion.div className="h-1.5 w-1.5 rounded-full bg-white/30" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                              <motion.div className="h-1.5 w-1.5 rounded-full bg-white/30" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                )}

                {/* Quick replies */}
                <div className="flex gap-2 overflow-x-auto px-4 py-1.5 no-scrollbar">
                  {getQuickReplies().map((reply) => (
                    <button
                      key={reply}
                      onClick={() => sendMessage(reply)}
                      className="shrink-0 rounded-full px-3 py-1 font-sans text-[11px] font-medium text-white/50 active:scale-95 transition"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {reply}
                    </button>
                  ))}
                </div>

                {/* Input */}
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
                    placeholder="What do you want to change?"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    className="flex-1 rounded-2xl px-4 py-2.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30"
                    style={{ backgroundColor: "#F97316" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop: live preview iframe */}
            <div
              className="hidden lg:flex w-[420px] shrink-0 items-center justify-center"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              {hubData.slug ? (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="overflow-hidden rounded-[32px]"
                    style={{ width: 375, height: 680, border: "2px solid rgba(255,255,255,0.08)" }}
                  >
                    <iframe
                      src={`https://join.thekickback.net/${hubData.slug}`}
                      className="h-full w-full"
                      style={{ border: "none", background: "#000" }}
                      title="Hub Preview"
                    />
                  </div>
                  <span className="font-mono text-[10px] text-white/20">
                    join.thekickback.net/{hubData.slug}
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-sans text-[14px] text-white/30">Preview will appear here</p>
                  <p className="mt-1 font-sans text-[12px] text-white/15">Complete setup to see your live page</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Preview button */}
          {hubData.slug && (
            <div className="lg:hidden shrink-0 px-4 pb-2">
              <a
                href={`https://join.thekickback.net/${hubData.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[13px] font-semibold text-white/60 transition active:scale-[0.98]"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Preview Hub Page
              </a>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Orders ── */}
        <TabsContent value={1} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div className="p-4 lg:p-6 space-y-6">
            {/* Stripe Connect */}
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <StripeConnect />
            </div>

            {/* Revenue stat cards (dark themed) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Today", value: fmtCents(Math.round(initialData.revenueStats.todayRevenue * (1 - feeRate))), sub: `${fmtCents(initialData.revenueStats.todayRevenue)} gross`, color: "#16a34a" },
                { label: "This Week", value: fmtCents(Math.round(initialData.revenueStats.weekRevenue * (1 - feeRate))), sub: `${fmtCents(initialData.revenueStats.weekRevenue)} gross`, color: "#F97316" },
                { label: "All-time", value: fmtCents(initialData.revenueStats.totalEarnings || 0), sub: null, color: "#8B5CF6" },
                { label: "Total Orders", value: String(initialData.revenueStats.totalOrders), sub: `${Math.round(feeRate * 100)}% platform fee`, color: "rgba(255,255,255,0.8)" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="font-mono text-[24px] font-bold tracking-tight" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="font-sans text-[12px] text-white/40">{stat.label}</p>
                  {stat.sub && <p className="font-sans text-[10px] text-white/20">{stat.sub}</p>}
                </div>
              ))}
            </div>

            {/* Orders list */}
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <h3 className="mb-4 font-sans text-[15px] font-semibold text-white/80">Orders</h3>
              <OrdersPanel
                orders={initialData.orders}
                revenue={initialData.revenueStats}
                transactions={initialData.transactions}
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 3: Guests ── */}
        <TabsContent value={2} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div className="p-4 lg:p-6 space-y-6">
            {/* Stat row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Active Now", value: String(initialData.sessions.length), color: "#4ade80" },
                { label: "Today", value: String(initialData.stats.totalToday), color: "#F97316" },
                { label: "Members", value: String(initialData.stats.members), color: "#8B5CF6" },
                { label: "Bookings", value: String(initialData.bookings.length), color: "rgba(255,255,255,0.8)" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="font-mono text-[28px] font-bold tracking-tight" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="font-sans text-[12px] text-white/40">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Active sessions */}
            <div>
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-white/80">
                Active Sessions
              </h3>
              {initialData.sessions.length === 0 ? (
                <div
                  className="rounded-2xl px-6 py-12 text-center"
                  style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="font-sans text-[15px] font-medium text-white/40">No active guests</p>
                  <p className="mt-1 font-sans text-[13px] text-white/25">
                    When guests check in, they show up here
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {initialData.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
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
                          {session.is_member && (
                            <span className="shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-medium" style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                              Member
                            </span>
                          )}
                        </div>
                        <p className="font-sans text-[11px] text-white/35">
                          {session.venue_xp ?? 0} XP &middot; {session.venue_visits ?? 0} visits
                          {session.started_at && <> &middot; checked in {relativeTime(session.started_at)}</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming bookings */}
            {initialData.bookings.length > 0 && (
              <div>
                <h3 className="mb-3 font-sans text-[15px] font-semibold text-white/80">
                  Upcoming Bookings
                </h3>
                <div className="flex flex-col gap-2">
                  {initialData.bookings
                    .filter((b) => new Date(b.starts_at) > new Date())
                    .slice(0, 10)
                    .map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-[14px] font-medium text-white/80">{booking.guest_name}</p>
                          <p className="font-sans text-[11px] text-white/35">
                            {booking.offering_name} &middot;{" "}
                            {new Date(booking.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                            {new Date(booking.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold"
                          style={{
                            backgroundColor:
                              booking.cal_status === "pending"
                                ? "rgba(250,204,21,0.12)"
                                : booking.cal_status === "accepted"
                                  ? "rgba(74,222,128,0.12)"
                                  : "rgba(255,255,255,0.06)",
                            color:
                              booking.cal_status === "pending"
                                ? "#FACC15"
                                : booking.cal_status === "accepted"
                                  ? "#4ade80"
                                  : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {booking.cal_status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 4: More ── */}
        <TabsContent value={3} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div className="p-4 lg:p-6 space-y-3">
            {/* Offerings */}
            <Sheet>
              <SheetTrigger
                render={
                  <MoreMenuItem
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
                    label="Offerings"
                    desc={`${offeringsState.length} active offerings`}
                  />
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md bg-black border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">Offerings</SheetTitle>
                  <SheetDescription className="text-white/40">Manage your products, services, and memberships</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                  {offeringsState.length === 0 ? (
                    <p className="text-center py-8 font-sans text-[13px] text-white/30">No offerings yet</p>
                  ) : (
                    offeringsState.map((o) => (
                      <div key={o.id} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-[13px] font-medium text-white/80">{o.name}</span>
                          <span className="font-mono text-[12px] text-white/40">{fmtCents(o.price_cents)}</span>
                        </div>
                        <p className="mt-0.5 font-sans text-[11px] text-white/25">{o.type}{o.description ? ` — ${o.description}` : ""}</p>
                      </div>
                    ))
                  )}
                  <Link
                    href="/settings#offerings"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
                    style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.2)" }}
                  >
                    Edit in Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            {/* Staff */}
            <Sheet>
              <SheetTrigger
                render={
                  <MoreMenuItem
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>}
                    label="Staff Management"
                    desc="Manage your team members"
                  />
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md bg-black border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">Staff Management</SheetTitle>
                  <SheetDescription className="text-white/40">Add and manage your team</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <Link
                    href="/settings#staff"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
                    style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    Manage Staff in Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            {/* AI Knowledge */}
            <Sheet>
              <SheetTrigger
                render={
                  <MoreMenuItem
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>}
                    label="AI Knowledge Base"
                    desc="Teach your AI about your venue"
                  />
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md bg-black border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">AI Knowledge Base</SheetTitle>
                  <SheetDescription className="text-white/40">Add info your AI should know about your venue</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <Link
                    href="/settings#knowledge"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
                    style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}
                  >
                    Edit Knowledge in Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            {/* XP & Loyalty */}
            <Sheet>
              <SheetTrigger
                render={
                  <MoreMenuItem
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                    label="XP & Loyalty"
                    desc={`${initialXpActions?.length || 0} actions, ${initialXpMilestones?.length || 0} milestones`}
                  />
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md bg-black border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">XP & Loyalty</SheetTitle>
                  <SheetDescription className="text-white/40">Configure how guests earn and redeem points</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                  {/* XP Actions */}
                  {initialXpActions && initialXpActions.length > 0 && (
                    <div>
                      <p className="mb-2 font-sans text-[11px] font-semibold text-white/30 uppercase tracking-wider">Actions</p>
                      {initialXpActions.map((a, i) => (
                        <div key={i} className="mb-1.5 flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <span className="font-sans text-[13px] text-white/70">{a.label}</span>
                          <span className="font-sans text-[12px] font-medium text-green-400/70">+{a.points} XP</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Milestones */}
                  {initialXpMilestones && initialXpMilestones.length > 0 && (
                    <div>
                      <p className="mb-2 font-sans text-[11px] font-semibold text-white/30 uppercase tracking-wider">Milestones</p>
                      {initialXpMilestones.map((m, i) => (
                        <div key={i} className="mb-1.5 flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <span className="font-sans text-[13px] text-white/60">{m.name}</span>
                          <span className="font-sans text-[11px] text-white/30">{m.threshold} XP</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link
                    href="/settings#xp"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
                    style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    Edit XP in Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Account section */}
            <div
              className="rounded-xl px-4 py-4 space-y-3"
              style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="font-sans text-[11px] font-semibold text-white/30 uppercase tracking-wider">Account</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sans text-[13px] text-white/70">{user.email}</p>
                  <p className="font-sans text-[11px] text-white/30">Owner</p>
                </div>
                <SignOutButton />
              </div>
            </div>

            {/* Seed Demo (sandbox-only visual indicator) */}
            <div
              className="rounded-xl px-4 py-4"
              style={{ backgroundColor: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.1)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sans text-[13px] font-medium text-yellow-500/80">Seed Demo Data</p>
                  <p className="font-sans text-[11px] text-yellow-500/40">Populate sandbox with sample data</p>
                </div>
                <button
                  onClick={handleSeedDemo}
                  disabled={seeding}
                  className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold text-black transition active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: "#FACC15" }}
                >
                  {seeding ? "Seeding..." : "Seed"}
                </button>
              </div>
            </div>

            {/* Full settings link */}
            <Link
              href="/settings"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-medium text-white/40 transition hover:text-white/60"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              All Settings
            </Link>
          </div>
        </TabsContent>

        {/* ═══ Mobile Bottom Tab Bar ═══ */}
        <div
          className="flex shrink-0 items-stretch lg:hidden"
          style={{
            backgroundColor: "rgba(0,0,0,0.95)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {(
            [
              { idx: 0, label: "Hub", Icon: HubIcon },
              { idx: 1, label: "Orders", Icon: OrdersIcon },
              { idx: 2, label: "Guests", Icon: GuestsIcon },
              { idx: 3, label: "More", Icon: MoreIcon },
            ] as const
          ).map(({ idx, label, Icon }) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 font-sans text-[10px] font-medium transition ${
                  isActive ? "text-[#F97316]" : "text-white/30"
                }`}
              >
                <Icon active={isActive} />
                {label}
              </button>
            );
          })}
        </div>
      </Tabs>
    </main>
  );
}
