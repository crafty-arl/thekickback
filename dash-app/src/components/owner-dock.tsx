"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { PlacePreviewEditable } from "@/components/place-preview-editable";
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
    vibe: string;
    type?: string;
    address?: string;
    pos_provider?: string | null;
    pos_connected_at?: string | null;
    max_occupancy?: number | null;
    rules?: string[] | null;
    check_in_radius_meters?: number | null;
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
  menuItems?: { id: string; category: string; name: string; description: string | null; price_cents: number; in_stock: boolean; inventory_count: number | null }[];
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

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  );
}

function PreviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#F97316" : "rgba(0,0,0,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

// ─── Analytics sub-tab type ─────────────────────────────────────────
type AnalyticsView = "today" | "orders" | "guests";

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
  menuItems: initialMenuItems,
}: OwnerDockProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>("today");

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
      capacity: 0,
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

  // Local orders state
  const [ordersState, setOrdersState] = useState(initialData.orders);

  // Review status
  const [currentReviewStatus, setCurrentReviewStatus] = useState(reviewStatus);

  const isApproved = !currentReviewStatus || currentReviewStatus === "approved";
  const checklistCompleted = Object.values(checklistState).filter(Boolean).length;
  const checklistTotal = Object.keys(checklistState).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  const feeRate = initialData.revenueStats?.platformFeeRate || 0.1;

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

  const topics = useMemo(() => {
    return extractTopics(initialData.messages as ChatMessage[]);
  }, [initialData.messages]);

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
      items.push({ kind: "checkin", id: s.id, name: s.profiles?.display_name || "Guest", desc: s.check_in_method === 'gps' ? `GPS check-in${s.distance_meters ? ` (${Math.round(s.distance_meters)}m)` : ''}` : s.check_in_method === 'qr' ? 'QR check-in' : "Checked in", time: s.started_at, guest: s });
    }
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
  }, [ordersState, initialData.sessions]);

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

  const handlePublishToggle = useCallback(async () => {
    const newStatus = isApproved ? "draft" : "approved";
    try {
      const res = await fetch("/api/venue/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, status: newStatus }),
      });
      if (res.ok) {
        setCurrentReviewStatus(newStatus);
      }
    } catch { /* ignore */ }
  }, [isApproved, venue.id]);

  const handleResetHub = useCallback(async () => {
    try {
      const res = await fetch("/api/venue/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id }),
      });
      if (res.ok) {
        setHubData((prev) => ({ ...prev, tagline: "", description: "", hours: "", themeColor: "#F97316" }));
        setOfferingsState([]);
        setGalleryImages([]);
        setChecklistState(DEFAULT_CHECKLIST);
        setCurrentReviewStatus("draft");
      }
    } catch { /* ignore */ }
  }, [venue.id]);

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

  // ─── Status badge helper ──────────────────────────────────────

  const statusText = isApproved
    ? venue.state === "active"
      ? "Live"
      : "Closed"
    : currentReviewStatus === "pending"
      ? "In Review"
      : currentReviewStatus === "rejected"
        ? "Needs Updates"
        : "Draft";

  const statusColor = isApproved
    ? "#4ade80"
    : currentReviewStatus === "pending"
      ? "#F97316"
      : currentReviewStatus === "rejected"
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
              <AnalyticsIcon active={activeTab === 0} />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value={1}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <PreviewIcon active={activeTab === 1} />
              Preview
            </TabsTrigger>
            <TabsTrigger
              value={2}
              className="h-10 gap-2 rounded-none border-0 px-4 text-[13px] font-medium text-gray-400 data-active:text-[#F97316] data-active:after:bg-[#F97316]"
            >
              <SettingsIcon active={activeTab === 2} />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Analytics */}
        <TabsContent value={0} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {/* Sub-navigation pills */}
          <div className="sticky top-0 z-[5] bg-gray-50 px-4 pt-3 pb-1">
            <div className="flex gap-2">
              {(["today", "orders", "guests"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setAnalyticsView(view)}
                  className={`rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium transition ${
                    analyticsView === view
                      ? "bg-orange-500 text-white"
                      : "bg-white border border-black/[0.06] text-gray-500 hover:bg-black/[0.02]"
                  }`}
                >
                  {view === "today" ? "Today" : view === "orders" ? "Orders" : "Guests"}
                </button>
              ))}
            </div>
          </div>

          {analyticsView === "today" && (
            <TodayTab
              revenueToday={initialData.revenueStats?.todayRevenue || 0}
              ordersToday={ordersToday.length}
              activeGuests={initialData.sessions.length}
              members={initialData.stats.members}
              feeRate={feeRate}
              pendingRequests={pendingRequests}
              upcomingBookings={upcomingBookings}
              recentActivity={recentActivity}
              onRequestsTap={() => setAnalyticsView("guests")}
              onOrderTap={(order) => setSelectedOrder(order)}
              onGuestTap={(guest) => setSelectedGuest(guest)}
            />
          )}

          {analyticsView === "orders" && (
            <OrdersTab
              ordersState={ordersState}
              revenueStats={initialData.revenueStats}
              transactions={initialData.transactions}
              feeRate={feeRate}
              topSellingItems={topSellingItems}
              recentPurchases={recentPurchases}
              onOrderTap={(order) => setSelectedOrder(order)}
            />
          )}

          {analyticsView === "guests" && (
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
          )}
        </TabsContent>

        {/* Tab 2: Preview — live editable venue page */}
        <TabsContent value={1} className="flex-1 min-h-0">
          <PlacePreviewEditable
            data={hubData}
            venueId={venue.id}
            offerings={offeringsState}
            galleryImages={galleryImages}
            xpActions={initialXpActions}
            xpMilestones={initialXpMilestones}
            onFieldSave={handleFieldSave}
            onPhotoUpload={handlePhotoUpload}
            onSectionEdited={handleSectionEdited}
            onOfferingTap={handleOpenOfferingDrawer}
          />
        </TabsContent>

        {/* Tab 3: Settings */}
        <TabsContent value={2} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <HubTab
            hubData={hubData}
            venueId={venue.id}
            offeringsState={offeringsState}
            galleryImages={galleryImages}
            initialXpActions={initialXpActions}
            initialXpMilestones={initialXpMilestones}
            checklistPercent={checklistPercent}
            checklist={checklistState}
            reviewStatus={currentReviewStatus}
            onFieldSave={handleFieldSave}
            onPhotoUpload={handlePhotoUpload}
            onSectionEdited={handleSectionEdited}
            onOfferingTap={handleOpenOfferingDrawer}
            onOfferingsChange={setOfferingsState}
            onPublish={handlePublishToggle}
            onReset={handleResetHub}
            user={user}
            initialStaff={initialStaff}
            initialKnowledge={initialKnowledge}
            initialAiLimits={initialAiLimits}
            posProvider={venue.pos_provider}
            posConnectedAt={venue.pos_connected_at}
            initialMenuItems={initialMenuItems}
            initialHours={pageData?.hours ?? null}
            initialVenueData={{
              address: venue.address,
              type: venue.type,
              vibe: venue.vibe,
              max_occupancy: venue.max_occupancy ?? undefined,
              rules: venue.rules ?? undefined,
              check_in_radius_meters: venue.check_in_radius_meters ?? undefined,
            }}
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
              { idx: 0, label: "Analytics", Icon: AnalyticsIcon },
              { idx: 1, label: "Preview", Icon: PreviewIcon },
              { idx: 2, label: "Settings", Icon: SettingsIcon },
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
            onAskAboutGuest={() => {
              setSelectedGuest(null);
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
