"use client";

import type { VenueRequest, GuestSession } from "@/lib/dashboard";
import type { Booking } from "@/components/dashboard/bookings-panel";
import type { Order } from "@/components/dashboard/orders-panel";

// ─── Helpers ──────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBookingTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

// ─── Types ──────────────────────────────────────────────────────────

export type ActivityItem =
  | { kind: "order"; id: string; name: string; desc: string; time: string; order: Order }
  | { kind: "checkin"; id: string; name: string; desc: string; time: string; guest: GuestSession };

interface TodayTabProps {
  revenueToday: number;
  ordersToday: number;
  activeGuests: number;
  members: number;
  feeRate: number;
  pendingRequests: VenueRequest[];
  upcomingBookings: Booking[];
  recentActivity: ActivityItem[];
  onRequestsTap: () => void;
  onOrderTap: (order: Order) => void;
  onGuestTap: (guest: GuestSession) => void;
}

// ─── Status helpers ─────────────────────────────────────────────────

const BOOKING_STATUS: Record<string, { color: string; bg: string }> = {
  confirmed: { color: "#16a34a", bg: "rgba(74,222,128,0.12)" },
  accepted: { color: "#16a34a", bg: "rgba(74,222,128,0.12)" },
  pending: { color: "#CA8A04", bg: "rgba(250,204,21,0.12)" },
  cancelled: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

// ─── Component ──────────────────────────────────────────────────────

export function TodayTab({
  revenueToday,
  ordersToday,
  activeGuests,
  members,
  feeRate,
  pendingRequests,
  upcomingBookings,
  recentActivity,
  onRequestsTap,
  onOrderTap,
  onGuestTap,
}: TodayTabProps) {
  const netRevenue = Math.round(revenueToday * (1 - feeRate));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Revenue Today",
            value: fmtCents(netRevenue),
            sub: `${fmtCents(revenueToday)} gross`,
            color: "#16a34a",
          },
          {
            label: "Orders Today",
            value: String(ordersToday),
            sub: null,
            color: "#F97316",
          },
          {
            label: "Active Guests",
            value: String(activeGuests),
            sub: null,
            color: "#4ade80",
            pulse: true,
          },
          {
            label: "Members",
            value: String(members),
            sub: null,
            color: "#8B5CF6",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-4 py-3 border border-black/5"
          >
            <div className="flex items-center gap-2">
              {"pulse" in stat && stat.pulse && activeGuests > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
              )}
              <p
                className="font-mono text-[28px] font-bold tracking-tight"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
            </div>
            <p className="font-sans text-[12px] text-gray-400">{stat.label}</p>
            {stat.sub && (
              <p className="font-sans text-[10px] text-gray-300">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Needs Attention ── */}
      {(pendingRequests.length > 0 || upcomingBookings.length > 0) && (
        <div>
          <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">
            Needs Attention
          </h3>
          <div className="space-y-2">
            {/* Pending requests card */}
            {pendingRequests.length > 0 && (
              <button
                onClick={onRequestsTap}
                className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left border border-black/5 border-l-4 border-l-orange-500 transition hover:border-black/10"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-medium text-gray-700">
                    {pendingRequests.length} pending{" "}
                    {pendingRequests.length === 1 ? "request" : "requests"}
                  </p>
                  <p className="font-sans text-[11px] text-gray-400">
                    Tap to review
                  </p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {/* Upcoming bookings (next 3) */}
            {upcomingBookings
              .filter((b) => new Date(b.starts_at) > new Date())
              .sort(
                (a, b) =>
                  new Date(a.starts_at).getTime() -
                  new Date(b.starts_at).getTime(),
              )
              .slice(0, 3)
              .map((booking) => {
                const status =
                  BOOKING_STATUS[booking.cal_status] ?? BOOKING_STATUS.pending;
                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 border border-black/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[14px] font-medium text-gray-700 truncate">
                        {booking.guest_name}
                      </p>
                      <p className="font-sans text-[11px] text-gray-400 truncate">
                        {booking.offering_name} &middot;{" "}
                        {formatBookingTime(booking.starts_at)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold capitalize"
                      style={{
                        backgroundColor: status.bg,
                        color: status.color,
                      }}
                    >
                      {booking.cal_status}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      {recentActivity.length > 0 && (
        <div>
          <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  item.kind === "order"
                    ? onOrderTap(item.order)
                    : onGuestTap(item.guest)
                }
                className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left border border-black/5 transition hover:border-black/10"
              >
                {/* Icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  {item.kind === "order" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-medium text-gray-700 truncate">
                    {item.name}
                  </p>
                  <p className="font-sans text-[11px] text-gray-400 truncate">
                    {item.desc}
                  </p>
                </div>

                {/* Time */}
                <span className="shrink-0 font-sans text-[11px] text-gray-300">
                  {relativeTime(item.time)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {recentActivity.length === 0 &&
        pendingRequests.length === 0 &&
        upcomingBookings.length === 0 &&
        ordersToday === 0 && (
          <div className="rounded-2xl border border-black/5 bg-white px-6 py-12 text-center">
            <p className="font-sans text-[15px] font-medium text-gray-400">
              Nothing happening yet today
            </p>
            <p className="mt-1 font-sans text-[13px] text-gray-300">
              Orders, check-ins, and requests will appear here
            </p>
          </div>
        )}
    </div>
  );
}
