"use client";

import { useState } from "react";
import type {
  GuestSession,
  ChatMessage,
  VenueRequest,
  VenuePerk,
  PerkRedemption,
  VenueMultiplier,
  PointLeaderboardEntry,
} from "@/lib/dashboard";
import type { Booking } from "@/components/dashboard/bookings-panel";
import { BookingsPanel } from "@/components/dashboard/bookings-panel";
import { RequestFeed } from "@/components/dashboard/request-feed";
import { PointsPanel } from "@/components/dashboard/points-panel";
import { GuestTable } from "@/components/dashboard/guest-table";

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

const tierColors: Record<string, string> = {
  explorer: "#94a3b8",
  regular: "#4ade80",
  member: "#f97316",
  vip: "#a78bfa",
};

// ─── Types ──────────────────────────────────────────────────────────

type GuestFilter = "all" | "booked" | "active" | "members";

interface GuestsTabProps {
  sessions: GuestSession[];
  stats: { totalToday: number; members: number };
  bookings: Booking[];
  xpBreakdown: { reason: string; count: number; totalXp: number }[];
  maxXpCount: number;
  recentXp: { name: string; reason: string; amount: number; time: string }[];
  topics: { topic: string; count: number }[];
  onGuestTap: (guest: GuestSession) => void;
  requests: VenueRequest[];
  perks: VenuePerk[];
  redemptions: PerkRedemption[];
  multipliers: VenueMultiplier[];
  leaderboard: PointLeaderboardEntry[];
  pointsIssuedToday: number;
  perksRedeemedToday: number;
}

const GUEST_FILTERS: { id: GuestFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "booked", label: "Booked" },
  { id: "active", label: "Active" },
  { id: "members", label: "Members" },
];

// ─── Component ──────────────────────────────────────────────────────

export function GuestsTab({
  sessions,
  stats,
  bookings,
  xpBreakdown,
  maxXpCount,
  recentXp,
  topics,
  onGuestTap,
  requests,
  perks,
  redemptions,
  multipliers,
  leaderboard,
  pointsIssuedToday,
  perksRedeemedToday,
}: GuestsTabProps) {
  const [filter, setFilter] = useState<GuestFilter>("all");

  const memberSessions = sessions.filter((s) => s.is_member);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stat row — visible on all filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Now", value: String(sessions.length), color: "#4ade80" },
          { label: "Today", value: String(stats.totalToday), color: "#F97316" },
          { label: "Members", value: String(stats.members), color: "#8B5CF6" },
          { label: "Bookings", value: String(bookings.length), color: "rgba(0,0,0,0.7)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-4 py-3"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <p className="font-mono text-[28px] font-bold tracking-tight" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="font-sans text-[12px] text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-filter bar */}
      <div className="flex gap-2">
        {GUEST_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
              filter === f.id
                ? "bg-black text-white"
                : "text-black/40 hover:bg-black/[0.04]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Filter: ALL ── */}
      {filter === "all" && (
        <>
          {/* XP Breakdown */}
          {xpBreakdown.length > 0 && (
            <div
              className="rounded-2xl bg-white p-4"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">XP Breakdown</h3>
              <div className="space-y-2">
                {xpBreakdown.map((item) => (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[12px] font-medium text-gray-600 capitalize">{item.reason.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[11px] text-gray-400">{item.count}x &middot; {item.totalXp} XP</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((item.count / maxXpCount) * 100)}%`,
                          backgroundColor: "#F97316",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent XP */}
          {recentXp.length > 0 && (
            <div
              className="rounded-2xl bg-white p-4"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">Recent XP</h3>
              <div className="space-y-2">
                {recentXp.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[13px] font-medium text-gray-700 truncate">{entry.name}</p>
                      <p className="font-sans text-[11px] text-gray-400 capitalize">{entry.reason.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-sans text-[13px] font-semibold text-green-600">+{entry.amount} XP</p>
                      <p className="font-sans text-[10px] text-gray-400">{relativeTime(entry.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bot Conversation Topics */}
          {topics.length > 0 && (
            <div
              className="rounded-2xl bg-white p-4"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">Popular Topics</h3>
              <p className="mb-2 font-sans text-[11px] text-gray-400">What guests are asking the bot about</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <span
                    key={t.topic}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-sans text-[12px] font-medium text-blue-600"
                  >
                    {t.topic}
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {requests.length > 0 && (
            <div>
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">
                Pending Requests
              </h3>
              <RequestFeed requests={requests} />
            </div>
          )}

          {/* Active sessions */}
          <div>
            <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">
              Active Sessions
            </h3>
            {sessions.length === 0 ? (
              <div
                className="rounded-2xl bg-white px-6 py-12 text-center"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="font-sans text-[15px] font-medium text-gray-400">No active guests</p>
                <p className="mt-1 font-sans text-[13px] text-gray-300">
                  When guests check in, they show up here
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onGuestTap(session)}
                    className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left transition hover:border-gray-300"
                    style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-sans text-[14px] font-medium text-gray-700 truncate">
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
                          <span className="shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-medium" style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#F97316" }}>
                            Member
                          </span>
                        )}
                        {session.check_in_method && (
                          <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                            session.check_in_method === 'gps' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'
                          }`}>
                            {session.check_in_method === 'gps'
                              ? `GPS ${session.distance_meters ? Math.round(session.distance_meters) + 'm' : ''}`
                              : 'QR'}
                          </span>
                        )}
                      </div>
                      <p className="font-sans text-[11px] text-gray-400">
                        {session.venue_xp ?? 0} XP &middot; {session.venue_visits ?? 0} visits
                        {session.started_at && <> &middot; checked in {relativeTime(session.started_at)}</>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming bookings */}
          {bookings.length > 0 && (
            <div>
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-gray-700">
                Upcoming Bookings
              </h3>
              <div className="flex flex-col gap-2">
                {bookings
                  .filter((b) => new Date(b.starts_at) > new Date())
                  .slice(0, 10)
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
                      style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[14px] font-medium text-gray-700">{booking.guest_name}</p>
                        <p className="font-sans text-[11px] text-gray-400">
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
                                : "rgba(0,0,0,0.04)",
                          color:
                            booking.cal_status === "pending"
                              ? "#CA8A04"
                              : booking.cal_status === "accepted"
                                ? "#16a34a"
                                : "rgba(0,0,0,0.4)",
                        }}
                      >
                        {booking.cal_status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Filter: BOOKED ── */}
      {filter === "booked" && (
        <BookingsPanel bookings={bookings} />
      )}

      {/* ── Filter: ACTIVE ── */}
      {filter === "active" && (
        <GuestTable sessions={sessions} />
      )}

      {/* ── Filter: MEMBERS ── */}
      {filter === "members" && (
        <>
          {memberSessions.length === 0 ? (
            <div
              className="rounded-2xl bg-white px-6 py-12 text-center"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <p className="font-sans text-[15px] font-medium text-gray-400">No members checked in</p>
              <p className="mt-1 font-sans text-[13px] text-gray-300">
                Members will appear here when they check in
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {memberSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onGuestTap(session)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left transition hover:border-gray-300"
                  style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-sans text-[14px] font-medium text-gray-700 truncate">
                        {session.profiles?.display_name ?? "Guest"}
                      </p>
                      <span className="shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-medium" style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#F97316" }}>
                        Member
                      </span>
                    </div>
                    <p className="font-sans text-[11px] text-gray-400">
                      {session.venue_xp ?? 0} XP &middot; {session.venue_visits ?? 0} visits
                      {session.started_at && <> &middot; checked in {relativeTime(session.started_at)}</>}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <PointsPanel
            perks={perks}
            redemptions={redemptions}
            multipliers={multipliers}
            leaderboard={leaderboard}
            pointsIssuedToday={pointsIssuedToday}
            perksRedeemedToday={perksRedeemedToday}
          />
        </>
      )}
    </div>
  );
}
