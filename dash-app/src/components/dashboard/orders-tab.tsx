"use client";

import { StripeConnect } from "@/components/dashboard/stripe-connect";
import { OrdersPanel } from "@/components/dashboard/orders-panel";
import type { Order, OrderItem, RevenueStats, VenueTransaction } from "@/components/dashboard/orders-panel";

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

// ─── Types ──────────────────────────────────────────────────────────

interface OrdersTabProps {
  ordersState: Order[];
  revenueStats: RevenueStats;
  transactions: VenueTransaction[];
  feeRate: number;
  topSellingItems: { name: string; count: number; revenue: number }[];
  recentPurchases: {
    id: string;
    guestName: string;
    items: string;
    total: number;
    time: string;
  }[];
  onOrderTap: (order: Order) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function OrdersTab({
  ordersState,
  revenueStats,
  transactions,
  feeRate,
  topSellingItems,
  recentPurchases,
  onOrderTap,
}: OrdersTabProps) {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stripe Connect */}
      <div
        className="rounded-2xl bg-white p-4"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <StripeConnect />
      </div>

      {/* Revenue stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Today", value: fmtCents(Math.round(revenueStats.todayRevenue * (1 - feeRate))), sub: `${fmtCents(revenueStats.todayRevenue)} gross`, color: "#16a34a" },
          { label: "This Week", value: fmtCents(Math.round(revenueStats.weekRevenue * (1 - feeRate))), sub: `${fmtCents(revenueStats.weekRevenue)} gross`, color: "#F97316" },
          { label: "All-time", value: fmtCents(revenueStats.totalEarnings || 0), sub: null, color: "#8B5CF6" },
          { label: "Total Orders", value: String(revenueStats.totalOrders), sub: `${Math.round(feeRate * 100)}% platform fee`, color: "rgba(0,0,0,0.7)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-4 py-3"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <p className="font-mono text-[24px] font-bold tracking-tight" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="font-sans text-[12px] text-gray-400">{stat.label}</p>
            {stat.sub && <p className="font-sans text-[10px] text-gray-300">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Top Selling Items */}
      {topSellingItems.length > 0 && (
        <div
          className="rounded-2xl bg-white p-4"
          style={{ border: "1px solid rgba(0,0,0,0.08)" }}
        >
          <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">Top Selling Items</h3>
          <div className="space-y-2">
            {topSellingItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 font-mono text-[11px] font-bold text-orange-600">{idx + 1}</span>
                  <span className="font-sans text-[13px] font-medium text-gray-700">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[13px] font-semibold text-gray-900">{item.count}x</span>
                  <span className="ml-2 font-mono text-[11px] text-gray-400">{fmtCents(item.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Purchases */}
      {recentPurchases.length > 0 && (
        <div
          className="rounded-2xl bg-white p-4"
          style={{ border: "1px solid rgba(0,0,0,0.08)" }}
        >
          <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">Recent Purchases</h3>
          <div className="space-y-2">
            {recentPurchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-medium text-gray-700 truncate">{purchase.guestName}</p>
                  <p className="font-sans text-[11px] text-gray-400 truncate">{purchase.items}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-mono text-[13px] font-semibold" style={{ color: "#16a34a" }}>{fmtCents(purchase.total)}</p>
                  <p className="font-sans text-[10px] text-gray-400">{relativeTime(purchase.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div
        className="rounded-2xl bg-white p-4"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <h3 className="mb-4 font-sans text-[15px] font-semibold text-gray-700">Orders</h3>
        <OrdersPanel
          orders={ordersState}
          revenue={revenueStats}
          transactions={transactions}
          onOrderTap={onOrderTap}
        />
      </div>
    </div>
  );
}
