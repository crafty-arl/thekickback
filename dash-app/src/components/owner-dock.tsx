"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OwnerMessageBody } from "./owner-message-body";
import { HubPreviewEditable } from "./hub-preview-editable";
import { OnboardingChecklist } from "./onboarding-checklist";
import type { ChecklistState } from "./onboarding-checklist";
import type { HubData } from "./hub-preview";
import { updateVenue, updateVenuePage } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";
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

// ─── Component ──────────────────────────────────────────────────────

export function OwnerDock({ initialData, venue, reviewStatus, user, pageData, offerings: initialOfferings, gallery: initialGallery, xpActions: initialXpActions, xpMilestones: initialXpMilestones, checklist: initialChecklist }: OwnerDockProps) {
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<
    "fresh" | "stats_shown" | "bookings_shown" | "mutation_done"
  >("fresh");
  const [showPreview, setShowPreview] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [checklistState, setChecklistState] = useState<ChecklistState>(
    initialChecklist ? { ...DEFAULT_CHECKLIST, ...initialChecklist } as ChecklistState : DEFAULT_CHECKLIST
  );
  const [currentItem, setCurrentItem] = useState<keyof ChecklistState | null>(null);

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
    } else {
      // Pre-approval welcome
      const statusLabel = reviewStatus === "pending" ? "under review" : reviewStatus === "rejected" ? "needs updates" : "in draft";
      const completed = Object.values(checklistState).filter(Boolean).length;
      const firstIncomplete = (Object.keys(checklistState) as (keyof ChecklistState)[]).find((k) => !checklistState[k]);
      setCurrentItem(firstIncomplete || null);

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
      // Persist to API
      fetch("/api/onboarding/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: key, completed: true }),
      }).catch(() => {});
    }
  }, [checklistState]);

  // ─── Checklist item click ───────────────────────────────────────

  const handleChecklistItemClick = useCallback((key: keyof ChecklistState) => {
    setCurrentItem(key);
    if (checklistState[key]) return; // already done

    const prompt = getItemPrompt(key);
    const msg: OwnerMessage = {
      id: `guide-${key}-${Date.now()}`,
      sender: "agent",
      body: prompt,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  }, [checklistState, scrollToBottom]);

  const handleChecklistSubmit = useCallback(async () => {
    // Submit for review — navigate to settings for now
    window.location.href = "/settings";
  }, []);

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

  // ─── Review status banner (for pre-approval, shown at top of chat) ──

  const ReviewBanner = () => {
    if (!isPreApproval) return null;
    return (
      <div
        className="mx-4 mb-3 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: reviewStatus === "pending" ? "rgba(249,115,22,0.08)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${reviewStatus === "pending" ? "rgba(249,115,22,0.15)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{
          backgroundColor: reviewStatus === "pending" ? "rgba(249,115,22,0.15)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
        }}>
          {reviewStatus === "pending" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          {reviewStatus === "rejected" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {reviewStatus === "draft" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[13px] font-semibold text-white/80">
            {reviewStatus === "pending" && "Under Review"}
            {reviewStatus === "rejected" && "Not Approved"}
            {reviewStatus === "draft" && "Draft"}
          </p>
          <p className="font-sans text-[11px] text-white/35 truncate">
            {reviewStatus === "pending" && "We\u2019ll email you once approved."}
            {reviewStatus === "rejected" && "Update your hub and resubmit."}
            {reviewStatus === "draft" && "Finish setup and submit for review."}
          </p>
        </div>
        <Link
          href="/settings"
          className="shrink-0 rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black"
          style={{ backgroundColor: "#F97316" }}
        >
          Settings
        </Link>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <main className="flex h-dvh bg-black">
      {/* Left: Chat panel */}
      <div className={`flex w-full flex-col lg:w-1/2 ${showPreview ? "hidden lg:flex" : ""}`}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${isApproved ? "bg-green-400 animate-pulse" : "bg-orange"}`} />
            <span className="font-sans text-[15px] font-semibold text-white/90">
              {venue.name}
            </span>
            <span className="font-sans text-[11px] text-white/30">
              {isApproved ? (venue.state === "active" ? "Open" : "Closed") : (reviewStatus === "pending" ? "In Review" : reviewStatus === "rejected" ? "Needs Updates" : "Draft")}
            </span>
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
                Scan
              </Link>
            )}
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

        {/* Collapsible checklist */}
        {checklistPercent < 100 && (
          <div className="border-b border-white/[0.06]">
            {/* Collapse toggle + progress bar */}
            <button
              onClick={() => setChecklistOpen(!checklistOpen)}
              className="flex w-full items-center gap-3 px-4 py-2.5"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-sans text-[11px] font-semibold text-white/40">Setup Progress</span>
                  <span className="font-sans text-[11px] font-bold text-orange">{checklistCompleted} of {checklistTotal}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full bg-orange"
                    initial={{ width: 0 }}
                    animate={{ width: `${checklistPercent}%` }}
                    transition={{ type: "spring", damping: 20, stiffness: 100 }}
                  />
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 transition-transform ${checklistOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Checklist items */}
            <AnimatePresence>
              {checklistOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-[35vh] overflow-y-auto">
                    <OnboardingChecklist
                      checklist={checklistState}
                      currentItem={currentItem}
                      onItemClick={handleChecklistItemClick}
                      onSubmit={handleChecklistSubmit}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Review status banner (pre-approval) */}
        {isPreApproval && (
          <div className="pt-3">
            <ReviewBanner />
          </div>
        )}

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
      </div>

      {/* Right: Live editable preview (desktop only) */}
      <div className="hidden w-1/2 border-l border-white/[0.06] lg:block">
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

      {/* Mobile: Preview FAB */}
      <button
        onClick={() => setShowPreview(true)}
        className="fixed bottom-24 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-orange shadow-lg lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Mobile: Preview sheet */}
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 lg:hidden" onClick={() => setShowPreview(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 top-16 rounded-t-3xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="font-sans text-[14px] font-semibold text-white/80">Hub Preview</span>
                <button onClick={() => setShowPreview(false)} className="text-white/40">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
