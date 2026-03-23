"use client";

import { useState } from "react";

export interface Booking {
  id: string;
  venue_id: string;
  offering_id: string;
  cal_booking_id: number | null;
  cal_booking_uid: string | null;
  cal_status: string;
  offering_name: string;
  guest_name: string;
  guest_email: string;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(start: string, end: string | null, durationMin: number | null): string {
  const s = formatTime(start);
  if (end) return `${s} - ${formatTime(end)}`;
  if (durationMin) {
    const endDate = new Date(new Date(start).getTime() + durationMin * 60000);
    return `${s} - ${formatTime(endDate.toISOString())}`;
  }
  return s;
}

function isUpcoming(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

function isPast(iso: string): boolean {
  const end = new Date(iso);
  return end.getTime() < Date.now();
}

type Filter = "upcoming" | "today" | "past" | "all";

// ─── Component ───────────────────────────────────────────────────

export function BookingsPanel({ bookings }: { bookings: Booking[] }) {
  const [filter, setFilter] = useState<Filter>("upcoming");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = bookings.filter((b) => {
    const d = new Date(b.starts_at);
    return d >= today && d <= todayEnd;
  });
  const upcomingBookings = bookings.filter((b) => isUpcoming(b.starts_at));
  const pastBookings = bookings.filter((b) => isPast(b.starts_at));

  const filtered = (() => {
    switch (filter) {
      case "today": return todayBookings;
      case "upcoming": return upcomingBookings;
      case "past": return pastBookings;
      case "all": return bookings;
    }
  })();

  // Group by date
  const grouped = new Map<string, Booking[]>();
  for (const b of filtered) {
    const key = formatDate(b.starts_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    confirmed: { label: "Confirmed", color: "#16a34a", bg: "#16a34a12", icon: "✓" },
    accepted: { label: "Confirmed", color: "#16a34a", bg: "#16a34a12", icon: "✓" },
    pending: { label: "Pending", color: "#F97316", bg: "#F9731612", icon: "●" },
    cancelled: { label: "Cancelled", color: "#ef4444", bg: "#ef444412", icon: "✕" },
    rescheduled: { label: "Rescheduled", color: "#60a5fa", bg: "#60a5fa12", icon: "↻" },
  };

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "upcoming", label: "Upcoming", count: upcomingBookings.length },
    { id: "today", label: "Today", count: todayBookings.length },
    { id: "past", label: "Past", count: pastBookings.length },
    { id: "all", label: "All", count: bookings.length },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{todayBookings.length}</p>
          <p className="font-sans text-[13px] text-black/40">Booked today</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{upcomingBookings.length}</p>
          <p className="font-sans text-[13px] text-black/40">Upcoming</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-green-600">
            {bookings.filter((b) => b.cal_booking_uid).length}
          </p>
          <p className="font-sans text-[13px] text-black/40">On Cal.com</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{bookings.length}</p>
          <p className="font-sans text-[13px] text-black/40">Total bookings</p>
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
              className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-bold leading-none ${filter === f.id ? "bg-white/20" : "bg-black/[0.06]"}`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Booking cards grouped by date ── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white px-6 py-12 text-center">
          <p className="text-[32px]">📅</p>
          <p className="mt-2 font-sans text-[15px] font-medium text-black/40">
            {filter === "upcoming" ? "No upcoming bookings" : filter === "today" ? "Nothing booked for today" : "No bookings yet"}
          </p>
          <p className="mt-1 font-sans text-[13px] text-black/25">
            When guests book services or reserve spots, they show up here
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([dateLabel, dateBookings]) => (
        <div key={dateLabel} className="flex flex-col gap-3">
          {/* Date header */}
          <div className="flex items-center gap-3">
            <span className="font-sans text-[14px] font-bold text-black">{dateLabel}</span>
            <div className="h-px flex-1 bg-black/5" />
            <span className="font-sans text-[12px] text-black/30">{dateBookings.length} {dateBookings.length === 1 ? "booking" : "bookings"}</span>
          </div>

          {dateBookings.map((booking) => {
            const status = STATUS_CONFIG[booking.cal_status] || STATUS_CONFIG.pending;
            const past = isPast(booking.starts_at);

            return (
              <div
                key={booking.id}
                className="overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-black/10"
                style={{ opacity: past ? 0.6 : 1 }}
              >
                {/* Main content */}
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Time block */}
                  <div className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2" style={{ backgroundColor: past ? "rgba(0,0,0,0.03)" : "#F9731610" }}>
                    <span className="font-mono text-[18px] font-bold" style={{ color: past ? "rgba(0,0,0,0.3)" : "#F97316" }}>
                      {formatTime(booking.starts_at)}
                    </span>
                    {booking.duration_minutes && (
                      <span className="font-sans text-xs text-black/30">{booking.duration_minutes} min</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[16px] font-bold text-black">{booking.offering_name}</p>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <span className="font-sans text-[14px] text-black/60">{booking.guest_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span className="font-sans text-[13px] text-black/40">{booking.guest_email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span className="font-sans text-[13px] text-black/40">
                          {formatTimeRange(booking.starts_at, booking.ends_at, booking.duration_minutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <span className="text-[11px]">{status.icon}</span>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Cal.com verification bar */}
                <div className={`flex items-center justify-between border-t border-black/[0.04] px-5 py-2.5 ${booking.cal_booking_uid ? "bg-green-600/[0.03]" : "bg-orange-500/[0.03]"}`}>
                  <div className="flex items-center gap-2">
                    {booking.cal_booking_uid ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span className="font-sans text-[12px] font-medium text-green-600">
                          Verified on Cal.com
                        </span>
                        <span className="font-mono text-[11px] text-black/20">
                          #{booking.cal_booking_uid.slice(0, 8)}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="font-sans text-[12px] font-medium text-orange-500">
                          Not synced to calendar
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-sans text-xs text-black/20">
                    Booked {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
