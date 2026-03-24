"use client";

import { useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { PlaceData } from "./place-preview";
import { updateVenue, updateVenuePage, updateOffering, deleteOffering } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";

import { TodayTab, type ActivityItem } from "@/components/dashboard/today-tab";
import { OrdersTab } from "@/components/dashboard/orders-tab";
import { GuestsTab } from "@/components/dashboard/guests-tab";
import { PlacePreviewEditable } from "@/components/place-preview-editable";
import { SettingsClient, type SettingsClientProps } from "@/app/settings/settings-client";
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
    neighborhood?: string;
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
  settingsData?: Omit<SettingsClientProps, "embedded">;
}

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

// ─── Tab type ───────────────────────────────────────────────────────
type Tab = "analytics" | "preview" | "settings";
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
  settingsData,
}: OwnerDockProps) {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>("today");

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
    id: string; name: string; type: string; price_cents: number; description?: string;
  } | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [ordersState, setOrdersState] = useState(initialData.orders);
  const [currentReviewStatus, setCurrentReviewStatus] = useState(reviewStatus);

  const isApproved = !currentReviewStatus || currentReviewStatus === "approved";
  const feeRate = initialData.revenueStats?.platformFeeRate || 0.1;

  // ─── Computed analytics data ──────────────────────────────────

  const topSellingItems = useMemo(() => {
    const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of ordersState) {
      if (order.status === "cancelled" || order.status === "refunded") continue;
      for (const item of (order.order_items || []) as OrderItem[]) {
        const key = item.name || "Unknown";
        const existing = itemMap.get(key);
        const qty = item.quantity || 1;
        const price = item.unit_price_cents || 0;
        if (existing) { existing.count += qty; existing.revenue += price * qty; }
        else { itemMap.set(key, { name: key, count: qty, revenue: price * qty }); }
      }
    }
    return Array.from(itemMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
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
      if (existing) { existing.count += 1; existing.totalXp += entry.amount; }
      else { reasonMap.set(reason, { reason, count: 1, totalXp: entry.amount }); }
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

  const topics = useMemo(() => extractTopics(initialData.messages as ChatMessage[]), [initialData.messages]);

  const ordersToday = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return ordersState.filter(o => new Date(o.created_at) >= todayStart && o.status !== "cancelled" && o.status !== "refunded");
  }, [ordersState]);

  const pendingRequests = useMemo(() => initialData.requests.filter(r => r.status === "pending"), [initialData.requests]);

  const upcomingBookings = useMemo(() => {
    return initialData.bookings.filter(b => new Date(b.starts_at) > new Date()).slice(0, 3);
  }, [initialData.bookings]);

  const recentActivity = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];
    for (const o of ordersState.slice(0, 5)) {
      const guestName = (o.profiles as Record<string, unknown> | null)?.display_name as string || "Guest";
      const itemNames = ((o.order_items || []) as { name?: string }[]).map(i => i.name || "Item").join(", ");
      items.push({ kind: "order", id: o.id, name: guestName, desc: itemNames, time: o.created_at, order: o });
    }
    for (const s of initialData.sessions.slice(0, 5)) {
      items.push({ kind: "checkin", id: s.id, name: s.profiles?.display_name || "Guest", desc: s.check_in_method === 'gps' ? `GPS (${Math.round(s.distance_meters || 0)}m)` : s.check_in_method === 'qr' ? 'QR' : "Check-in", time: s.started_at, guest: s });
    }
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
  }, [ordersState, initialData.sessions]);

  // ─── Handlers ─────────────────────────────────────────────────

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

  const handleSectionEdited = useCallback(() => {}, []);

  const handleOrderStatusUpdate = useCallback(async (orderId: string, status: string) => {
    setDrawerSaving(true);
    try {
      const res = await fetch("/api/orders/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status }) });
      if (res.ok) {
        setOrdersState((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: status as Order["status"] } : o)));
        setSelectedOrder((prev) => prev && prev.id === orderId ? { ...prev, status: status as Order["status"] } : prev);
      }
    } finally { setDrawerSaving(false); }
  }, []);

  const handleRefundOrder = useCallback(async (orderId: string) => {
    setDrawerSaving(true);
    try {
      const res = await fetch("/api/orders/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      if (res.ok) {
        setOrdersState((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "refunded" as Order["status"] } : o)));
        setSelectedOrder((prev) => prev && prev.id === orderId ? { ...prev, status: "refunded" as Order["status"] } : prev);
      }
    } finally { setDrawerSaving(false); }
  }, []);

  const handleSaveOffering = useCallback(async (form: { name: string; description: string; price_cents: number; type: string }) => {
    if (!selectedOffering) return;
    setDrawerSaving(true);
    try {
      await updateOffering(selectedOffering.id, { name: form.name, description: form.description || undefined, price_cents: form.price_cents });
      setOfferingsState((prev) => prev.map((o) => o.id === selectedOffering.id ? { ...o, name: form.name, description: form.description, price_cents: form.price_cents } : o));
      setSelectedOffering(null);
    } finally { setDrawerSaving(false); }
  }, [selectedOffering]);

  const handleDeleteOffering = useCallback(async () => {
    if (!selectedOffering) return;
    setDrawerSaving(true);
    try {
      await deleteOffering(selectedOffering.id);
      setOfferingsState((prev) => prev.filter((o) => o.id !== selectedOffering.id));
      setSelectedOffering(null);
    } finally { setDrawerSaving(false); }
  }, [selectedOffering]);

  // ─── Status ───────────────────────────────────────────────────

  const statusText = isApproved ? (venue.state === "active" ? "Live" : "Closed") : currentReviewStatus === "pending" ? "In Review" : currentReviewStatus === "rejected" ? "Needs Updates" : "Draft";
  const statusColor = isApproved ? "#4ade80" : currentReviewStatus === "pending" ? "#F97316" : currentReviewStatus === "rejected" ? "#EF4444" : "rgba(255,255,255,0.4)";

  const tabs: { id: Tab; label: string }[] = [
    { id: "analytics", label: "Analytics" },
    { id: "preview", label: "Preview" },
    { id: "settings", label: "Settings" },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="flex h-dvh flex-col" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <span className="font-sans text-[14px] font-bold tracking-tight text-white">
            <span style={{ color: "#F97316" }}>the</span>KickBack
          </span>
          <div className="h-4 w-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="font-sans text-[13px] font-medium text-white/60">{venue.name}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <Link href="/scan" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-black transition active:scale-95" style={{ backgroundColor: "#F97316" }}>
              Scan
            </Link>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div className="relative z-10 flex shrink-0 items-center gap-0 px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative h-10 px-4 font-sans text-[13px] font-medium transition"
              style={{ color: active ? "#F97316" : "rgba(255,255,255,0.35)" }}
            >
              {tab.label}
              {active && <div className="absolute inset-x-4 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: "#F97316" }} />}
            </button>
          );
        })}

        {/* Analytics sub-tabs */}
        {activeTab === "analytics" && (
          <div className="ml-auto flex items-center gap-1">
            {(["today", "orders", "guests"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setAnalyticsView(view)}
                className="rounded-full px-3 py-1 font-sans text-[11px] font-medium transition"
                style={{
                  backgroundColor: analyticsView === view ? "rgba(249,115,22,0.15)" : "transparent",
                  color: analyticsView === view ? "#F97316" : "rgba(255,255,255,0.3)",
                }}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* Analytics */}
        {activeTab === "analytics" && (
          <div className="analytics-light-wrap">
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
          </div>
        )}

        {/* Preview */}
        {activeTab === "preview" && (
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
            onOfferingTap={(o) => setSelectedOffering(o)}
          />
        )}

        {/* Settings */}
        {activeTab === "settings" && settingsData && (
          <SettingsClient {...settingsData} embedded />
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="relative z-10 flex shrink-0 items-stretch lg:hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 font-sans text-[10px] font-medium transition"
              style={{ color: active ? "#F97316" : "rgba(255,255,255,0.3)" }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Drawers ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailDrawer order={selectedOrder} feeRate={feeRate} drawerSaving={drawerSaving} onStatusUpdate={handleOrderStatusUpdate} onRefundOrder={handleRefundOrder} onClose={() => setSelectedOrder(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedGuest && (
          <GuestDetailDrawer guest={selectedGuest} ordersState={ordersState} xpActivity={xpActivity || []} onClose={() => setSelectedGuest(null)} onOrderTap={(order) => setSelectedOrder(order)} onAskAboutGuest={() => setSelectedGuest(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedOffering && (
          <OfferingDetailDrawer offering={selectedOffering} drawerSaving={drawerSaving} onSave={handleSaveOffering} onDelete={handleDeleteOffering} onClose={() => setSelectedOffering(null)} />
        )}
      </AnimatePresence>

      {/* Analytics tabs render light-themed components — wrap them in a light container */}
      <style>{`
        .analytics-light-wrap {
          background: #f9fafb;
          min-height: 100%;
        }
      `}</style>
    </main>
  );
}
