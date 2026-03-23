"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { ChecklistState } from "./onboarding-checklist";
import type { PlaceData } from "./place-preview";
import { updateVenue, updateVenuePage, updateOffering, deleteOffering } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";

import { TodayTab, type ActivityItem } from "@/components/dashboard/today-tab";
import { OrdersTab } from "@/components/dashboard/orders-tab";
import { GuestsTab } from "@/components/dashboard/guests-tab";
import { HubTab } from "@/components/dashboard/hub-tab";
import { OwnerChatFloat, type OwnerChatFloatHandle } from "@/components/owner-chat-float";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import { GuestDetailDrawer } from "@/components/dashboard/guest-detail-drawer";
import { OfferingDetailDrawer } from "@/components/dashboard/offering-detail-drawer";

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
import type { Order, OrderItem, RevenueStats, VenueTransaction } from "@/components/dashboard/orders-panel";

// ─── Types ──────────────────────────────────────────────────────────

interface OwnerMessage {
  id: string;
  sender: "owner" | "agent";
  body: string;
  timestamp: number;
}

interface XpActivityEntry {
  amount: number;
  reason: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
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
  xpActivity?: XpActivityEntry[];
  staff?: { id: string; display_name: string | null; role_title: string | null; avatar_url: string | null; bio: string | null; specialties: string[] | null; visible: boolean; schedule: unknown }[];
  knowledge?: { id: string; content: string; category: string; created_at: string }[];
  aiLimits?: { enabled: boolean; free_messages_per_day: number; require_membership: boolean; gate_message: string } | null;
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

function extractTopics(messages: ChatMessage[]): { topic: string; count: number }[] {
  const guestMsgs = messages.filter(m => m.sender_type === "guest");
  const words: Record<string, number> = {};
  const stopWords = new Set(["the","a","an","is","it","to","in","for","of","and","or","my","i","me","what","how","can","do","this","that","your","you","are","was","be","have","has","with","at","on","from","but","not","all","just","get","got","like","want","would","could","should","there","here","about","been","will","they","them","than","more","some","any","also","very","too","much","well","back","out","let","know","see","thing","things","going","really","right","make","need","take","give","come","look","think","tell","ask","try","use","way","did","said","say","had","put","still","does","done","went","made","work"]);
  for (const m of guestMsgs) {
    const tokens = m.body.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const t of tokens) words[t] = (words[t] || 0) + 1;
  }
  return Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
}

// ─── Tab icon components ────────────────────────────────────────────

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function GuestsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HubIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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
  xpActivity,
  staff: initialStaff,
  knowledge: initialKnowledge,
  aiLimits: initialAiLimits,
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
  const [hubData, setHubData] = useState<PlaceData>(() => {
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
  const [offeringsState, setOfferingsState] = useState(initialOfferings || []);

  // Drawer states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<GuestSession | null>(null);
  const [selectedOffering, setSelectedOffering] = useState<{
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  } | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);

  // Local orders state for status updates
  const [ordersState, setOrdersState] = useState(initialData.orders);

  const isApproved = !reviewStatus || reviewStatus === "approved";
  const isPreApproval = reviewStatus && reviewStatus !== "approved";
  const checklistCompleted = Object.values(checklistState).filter(Boolean).length;
  const checklistTotal = Object.keys(checklistState).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  const feeRate = initialData.revenueStats?.platformFeeRate || 0.1;
  const pendingBookings = initialData.bookings.filter(
    (b) => new Date(b.starts_at) > new Date() && b.cal_status === "pending"
  ).length;

  // ─── Insights: Top Selling Items ──────────────────────────────────

  const topSellingItems = useMemo(() => {
    const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of ordersState) {
      if (order.status === "cancelled" || order.status === "refunded") continue;
      for (const item of (order.order_items || []) as OrderItem[]) {
        const key = item.name || "Unknown";
        const existing = itemMap.get(key);
        const qty = item.quantity || 1;
        const price = item.unit_price_cents || 0;
        if (existing) {
          existing.count += qty;
          existing.revenue += price * qty;
        } else {
          itemMap.set(key, { name: key, count: qty, revenue: price * qty });
        }
      }
    }
    return Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [ordersState]);

  // ─── Insights: Recent Purchases ───────────────────────────────────

  const recentPurchases = useMemo(() => {
    return ordersState
      .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        guestName: (o.profiles as Record<string, unknown> | null)?.display_name as string || "Guest",
        items: ((o.order_items || []) as OrderItem[]).map((i) => i.name || "Item").join(", "),
        total: o.total_cents || 0,
        time: o.created_at,
      }));
  }, [ordersState]);

  // ─── Insights: XP Activity ────────────────────────────────────────

  const xpBreakdown = useMemo(() => {
    if (!xpActivity || xpActivity.length === 0) return [];
    const reasonMap = new Map<string, { reason: string; count: number; totalXp: number }>();
    for (const entry of xpActivity) {
      const reason = entry.reason || "other";
      const existing = reasonMap.get(reason);
      if (existing) {
        existing.count += 1;
        existing.totalXp += entry.amount;
      } else {
        reasonMap.set(reason, { reason, count: 1, totalXp: entry.amount });
      }
    }
    return Array.from(reasonMap.values()).sort((a, b) => b.count - a.count);
  }, [xpActivity]);

  const recentXp = useMemo(() => {
    if (!xpActivity || xpActivity.length === 0) return [];
    return xpActivity.slice(0, 5).map((e) => ({
      name: e.profiles?.display_name || "Guest",
      reason: e.reason || "activity",
      amount: e.amount,
      time: e.created_at,
    }));
  }, [xpActivity]);

  const maxXpCount = useMemo(() => {
    if (xpBreakdown.length === 0) return 1;
    return Math.max(...xpBreakdown.map((x) => x.count));
  }, [xpBreakdown]);

  // ─── Insights: Bot Conversation Topics ────────────────────────────

  const topics = useMemo(() => {
    return extractTopics(initialData.messages as ChatMessage[]);
  }, [initialData.messages]);

  // ─── Chat float ref ───────────────────────────────────────────
  const chatFloatRef = useRef<OwnerChatFloatHandle>(null);

  // ─── Today tab data ──────────────────────────────────────────
  const ordersToday = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return ordersState.filter(o => new Date(o.created_at) >= todayStart && o.status !== "cancelled" && o.status !== "refunded");
  }, [ordersState]);

  const pendingRequests = useMemo(() => {
    return initialData.requests.filter(r => r.status === "pending");
  }, [initialData.requests]);

  const upcomingBookings = useMemo(() => {
    return initialData.bookings
      .filter(b => new Date(b.starts_at) > new Date())
      .slice(0, 3);
  }, [initialData.bookings]);

  const recentActivity = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];
    for (const o of ordersState.slice(0, 5)) {
      const guestName = (o.profiles as Record<string, unknown> | null)?.display_name as string || "Guest";
      const itemNames = ((o.order_items || []) as { name?: string }[]).map(i => i.name || "Item").join(", ");
      items.push({ kind: "order", id: o.id, name: guestName, desc: itemNames, time: o.created_at, order: o });
    }
    for (const s of initialData.sessions.slice(0, 5)) {
      items.push({ kind: "checkin", id: s.id, name: s.profiles?.display_name || "Guest", desc: "Checked in", time: s.started_at, guest: s });
    }
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
  }, [ordersState, initialData.sessions]);

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
      const welcome = `Your place is ${statusLabel}. Setup is ${Math.round((completed / 9) * 100)}% complete. ${firstIncomplete ? `Let's work on: ${firstIncomplete}` : "Looking good!"}`;
      setMessages([{ id: "welcome", sender: "agent", body: welcome, timestamp: Date.now() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      }
    },
    [input, venue.id]
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
      }
    },
    [venue.id]
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
      }
    },
    [venue.id]
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

  // ─── Drawer: Order actions ──────────────────────────────────
  const handleOrderStatusUpdate = useCallback(
    async (orderId: string, status: string) => {
      setDrawerSaving(true);
      try {
        const res = await fetch("/api/orders/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, status }),
        });
        if (res.ok) {
          setOrdersState((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: status as Order["status"] } : o))
          );
          setSelectedOrder((prev) =>
            prev && prev.id === orderId ? { ...prev, status: status as Order["status"] } : prev
          );
        }
      } finally {
        setDrawerSaving(false);
      }
    },
    []
  );

  // ─── Drawer: Refund order ──────────────────────────────────
  const handleRefundOrder = useCallback(
    async (orderId: string) => {
      setDrawerSaving(true);
      try {
        const res = await fetch("/api/orders/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        if (res.ok) {
          setOrdersState((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: "refunded" as Order["status"] } : o))
          );
          setSelectedOrder((prev) =>
            prev && prev.id === orderId ? { ...prev, status: "refunded" as Order["status"] } : prev
          );
        }
      } finally {
        setDrawerSaving(false);
      }
    },
    []
  );

  // ─── Drawer: Offering actions ──────────────────────────────
  const handleOpenOfferingDrawer = useCallback(
    (offering: { id: string; name: string; type: string; price_cents: number; description?: string }) => {
      setSelectedOffering(offering);
    },
    []
  );

  const handleSaveOffering = useCallback(
    async (form: { name: string; description: string; price_cents: number; type: string }) => {
      if (!selectedOffering) return;
      setDrawerSaving(true);
      try {
        await updateOffering(selectedOffering.id, {
          name: form.name,
          description: form.description || undefined,
          price_cents: form.price_cents,
        });
        setOfferingsState((prev) =>
          prev.map((o) =>
            o.id === selectedOffering.id
              ? { ...o, name: form.name, description: form.description, price_cents: form.price_cents }
              : o
          )
        );
        setSelectedOffering(null);
      } finally {
        setDrawerSaving(false);
      }
    },
    [selectedOffering]
  );

  const handleDeleteOffering = useCallback(
    async () => {
      if (!selectedOffering) return;
      setDrawerSaving(true);
      try {
        await deleteOffering(selectedOffering.id);
        setOfferingsState((prev) => prev.filter((o) => o.id !== selectedOffering.id));
        setSelectedOffering(null);
      } finally {
        setDrawerSaving(false);
      }
    },
    [selectedOffering]
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
        : "rgba(0,0,0,0.4)";

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="flex h-dvh flex-col bg-gray-50">
      {/* Header */}
      <header
        className="relative z-10 flex h-14 shrink-0 items-center justify-between bg-white px-4"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-sans text-[14px] font-bold tracking-tight text-gray-900">
            <span style={{ color: "#F97316" }}>the</span>KickBack
          </span>
          <div className="h-4 w-px bg-gray-200" />
          <span className="font-sans text-[14px] font-semibold text-gray-700">{venue.name}</span>
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
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white transition active:scale-95"
              style={{ backgroundColor: "#F97316" }}
            >
              <ScanIcon />
              Scan
            </Link>
          )}
          <span className="font-mono text-[10px] text-gray-300">v1.0.0</span>
        </div>
      </header>

      {/* Tab Content Area */}
      <Tabs
        defaultValue={0}
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as number)}
        className="flex flex-1 flex-col min-h-0 gap-0"
      >
        {/* Desktop top tab bar */}
        <div
          className="relative z-10 hidden lg:block shrink-0 bg-white px-4"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
        >
          <TabsList
            variant="line"
            className="h-10 w-full justify-start gap-0 bg-transparent p-0"
          >
            <TabsTrigger
              value={0}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <TodayIcon active={activeTab === 0} />
              Today
            </TabsTrigger>
            <TabsTrigger
              value={1}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <OrdersIcon active={activeTab === 1} />
              Orders
            </TabsTrigger>
            <TabsTrigger
              value={2}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <GuestsIcon active={activeTab === 2} />
              Guests
            </TabsTrigger>
            <TabsTrigger
              value={3}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <HubIcon active={activeTab === 3} />
              Hub
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Today */}
        <TabsContent value={0} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <TodayTab
            revenueToday={initialData.revenueStats?.todayRevenue || 0}
            ordersToday={ordersToday.length}
            activeGuests={initialData.sessions.length}
            members={initialData.stats.members}
            feeRate={feeRate}
            pendingRequests={pendingRequests}
            upcomingBookings={upcomingBookings}
            recentActivity={recentActivity}
            onRequestsTap={() => setActiveTab(2)}
            onOrderTap={(order) => setSelectedOrder(order)}
            onGuestTap={(guest) => setSelectedGuest(guest)}
          />
        </TabsContent>

        {/* Tab 2: Orders */}
        <TabsContent value={1} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <OrdersTab
            ordersState={ordersState}
            revenueStats={initialData.revenueStats}
            transactions={initialData.transactions}
            feeRate={feeRate}
            topSellingItems={topSellingItems}
            recentPurchases={recentPurchases}
            onOrderTap={(order) => setSelectedOrder(order)}
          />
        </TabsContent>

        {/* Tab 3: Guests */}
        <TabsContent value={2} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <GuestsTab
            sessions={initialData.sessions}
            stats={{ totalToday: initialData.stats.totalToday, members: initialData.stats.members }}
            bookings={initialData.bookings}
            xpBreakdown={xpBreakdown}
            maxXpCount={maxXpCount}
            recentXp={recentXp}
            topics={topics}
            onGuestTap={(guest) => setSelectedGuest(guest)}
            requests={initialData.requests}
            perks={initialData.perks}
            redemptions={initialData.redemptions}
            multipliers={initialData.multipliers}
            leaderboard={initialData.leaderboard}
            pointsIssuedToday={initialData.stats.pointsIssuedToday || 0}
            perksRedeemedToday={initialData.stats.perksRedeemedToday || 0}
          />
        </TabsContent>

        {/* Tab 4: Hub */}
        <TabsContent value={3} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <HubTab
            hubData={hubData}
            venueId={venue.id}
            offeringsState={offeringsState}
            galleryImages={galleryImages}
            initialXpActions={initialXpActions}
            initialXpMilestones={initialXpMilestones}
            checklistPercent={checklistPercent}
            onFieldSave={handleFieldSave}
            onPhotoUpload={handlePhotoUpload}
            onSectionEdited={handleSectionEdited}
            onOfferingTap={handleOpenOfferingDrawer}
            onOfferingsChange={setOfferingsState}
            user={user}
            initialStaff={initialStaff}
            initialKnowledge={initialKnowledge}
            initialAiLimits={initialAiLimits}
          />
        </TabsContent>

        {/* Mobile Bottom Tab Bar */}
        <div
          className="relative z-10 flex shrink-0 items-stretch lg:hidden bg-white"
          style={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {(
            [
              { idx: 0, label: "Today", Icon: TodayIcon },
              { idx: 1, label: "Orders", Icon: OrdersIcon },
              { idx: 2, label: "Guests", Icon: GuestsIcon },
              { idx: 3, label: "Hub", Icon: HubIcon },
            ] as const
          ).map(({ idx, label, Icon }) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 font-sans text-[10px] font-medium transition ${
                  isActive ? "text-[#F97316]" : "text-gray-400"
                }`}
              >
                <Icon active={isActive} />
                {label}
              </button>
            );
          })}
        </div>
      </Tabs>

      {/* ─── Floating AI Chat ─────────────────────────────────────── */}
      <OwnerChatFloat
        ref={chatFloatRef}
        messages={messages}
        loading={loading}
        input={input}
        onInputChange={setInput}
        onSendMessage={sendMessage}
        quickReplies={getQuickReplies()}
        onApproveBooking={handleApproveBooking}
        onDeclineBooking={handleDeclineBooking}
      />

      {/* ─── Order Detail Drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailDrawer
            order={selectedOrder}
            feeRate={feeRate}
            drawerSaving={drawerSaving}
            onStatusUpdate={handleOrderStatusUpdate}
            onRefundOrder={handleRefundOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>

      {/* ─── Guest Detail Drawer ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedGuest && (
          <GuestDetailDrawer
            guest={selectedGuest}
            ordersState={ordersState}
            xpActivity={xpActivity || []}
            onClose={() => setSelectedGuest(null)}
            onOrderTap={(order) => setSelectedOrder(order)}
            onAskAboutGuest={(name) => {
              setSelectedGuest(null);
              chatFloatRef.current?.open();
              setTimeout(() => {
                sendMessage(`Tell me more about guest ${name}`);
              }, 300);
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Offering Detail Drawer ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedOffering && (
          <OfferingDetailDrawer
            offering={selectedOffering}
            drawerSaving={drawerSaving}
            onSave={handleSaveOffering}
            onDelete={handleDeleteOffering}
            onClose={() => setSelectedOffering(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
