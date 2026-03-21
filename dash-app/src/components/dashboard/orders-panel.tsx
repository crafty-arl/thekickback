"use client";

import { useState } from "react";

export interface OrderItem {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
}

export interface Order {
  id: string;
  venue_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: "pending" | "confirmed" | "fulfilled" | "cancelled";
  total_cents: number;
  created_at: string;
  order_items: OrderItem[];
  profiles?: { display_name: string | null; email: string | null; phone: string | null };
}

export interface RevenueStats {
  todayRevenue: number;
  weekRevenue: number;
  totalOrders: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type Filter = "all" | "pending" | "confirmed" | "fulfilled";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Pending", color: "#FACC15", bg: "#FACC1512", icon: "●" },
  confirmed: { label: "Confirmed", color: "#16a34a", bg: "#16a34a12", icon: "✓" },
  fulfilled: { label: "Fulfilled", color: "#94a3b8", bg: "#94a3b812", icon: "✓" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#ef444412", icon: "✕" },
};

// ─── Component ───────────────────────────────────────────────────

export function OrdersPanel({ orders, revenue }: { orders: Order[]; revenue: RevenueStats }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const fulfilledOrders = orders.filter((o) => o.status === "fulfilled");

  const filtered = (() => {
    switch (filter) {
      case "pending": return pendingOrders;
      case "confirmed": return confirmedOrders;
      case "fulfilled": return fulfilledOrders;
      case "all": return orders;
    }
  })();

  // Group by date
  const grouped = new Map<string, Order[]>();
  for (const o of filtered) {
    const key = formatDate(o.created_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(o);
  }

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: orders.length },
    { id: "pending", label: "Pending", count: pendingOrders.length },
    { id: "confirmed", label: "Confirmed", count: confirmedOrders.length },
    { id: "fulfilled", label: "Fulfilled", count: fulfilledOrders.length },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Revenue summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight" style={{ color: "#16a34a" }}>
            {formatCents(revenue.todayRevenue)}
          </p>
          <p className="font-sans text-[13px] text-black/40">Today&apos;s revenue</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight" style={{ color: "#F97316" }}>
            {formatCents(revenue.weekRevenue)}
          </p>
          <p className="font-sans text-[13px] text-black/40">This week</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{revenue.totalOrders}</p>
          <p className="font-sans text-[13px] text-black/40">Total orders</p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-2 rounded-full px-4 py-2 font-sans text-[13px] font-medium transition active:scale-95"
            style={{
              backgroundColor: filter === f.id ? "#000" : "rgba(0,0,0,0.04)",
              color: filter === f.id ? "#fff" : "rgba(0,0,0,0.4)",
            }}
          >
            {f.label}
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none"
              style={{
                backgroundColor: filter === f.id ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)",
              }}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Order cards grouped by date ── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white px-6 py-12 text-center">
          <p className="text-[32px]">🧾</p>
          <p className="mt-2 font-sans text-[15px] font-medium text-black/40">
            {filter === "pending" ? "No pending orders" : filter === "confirmed" ? "No confirmed orders" : filter === "fulfilled" ? "No fulfilled orders" : "No orders yet"}
          </p>
          <p className="mt-1 font-sans text-[13px] text-black/25">
            When guests place orders, they show up here
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([dateLabel, dateOrders]) => (
        <div key={dateLabel} className="flex flex-col gap-3">
          {/* Date header */}
          <div className="flex items-center gap-3">
            <span className="font-sans text-[14px] font-bold text-black">{dateLabel}</span>
            <div className="h-px flex-1 bg-black/5" />
            <span className="font-sans text-[12px] text-black/30">{dateOrders.length} {dateOrders.length === 1 ? "order" : "orders"}</span>
          </div>

          {dateOrders.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedId === order.id;
            const guestName = order.profiles?.display_name || order.guest_name || order.profiles?.email || order.profiles?.phone || "Guest";

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-black/10"
              >
                {/* Main content — clickable to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left"
                >
                  {/* Order number block */}
                  <div className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2" style={{ backgroundColor: status.bg }}>
                    <span className="font-mono text-[11px] font-bold" style={{ color: status.color }}>
                      #{order.id.slice(0, 6)}
                    </span>
                    <span className="font-sans text-[10px] text-black/30">
                      {formatTime(order.created_at)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[15px] font-bold text-black">{guestName}</p>
                    <p className="mt-0.5 font-sans text-[13px] text-black/40">
                      {order.order_items.length} {order.order_items.length === 1 ? "item" : "items"}
                    </p>
                  </div>

                  {/* Total + status */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-mono text-[16px] font-bold text-black">
                      {formatCents(order.total_cents)}
                    </span>
                    <span
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-[11px] font-semibold"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <span className="text-[9px]">{status.icon}</span>
                      {status.label}
                    </span>
                  </div>

                  {/* Expand chevron */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-2 shrink-0 transition-transform"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded line items */}
                {isExpanded && order.order_items.length > 0 && (
                  <div className="border-t border-black/[0.04] px-5 py-3" style={{ backgroundColor: "rgba(0,0,0,0.01)" }}>
                    <div className="flex flex-col gap-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
                              {item.quantity}
                            </span>
                            <span className="font-sans text-[13px] text-black/70">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-sans text-[11px] text-black/30">
                              @ {formatCents(item.unit_price_cents)}
                            </span>
                            <span className="font-mono text-[13px] font-medium text-black/60">
                              {formatCents(item.subtotal_cents)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-black/[0.04] pt-2">
                      <span className="font-sans text-[12px] font-medium text-black/40">Total</span>
                      <span className="font-mono text-[14px] font-bold text-black">{formatCents(order.total_cents)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
