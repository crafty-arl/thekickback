"use client";

import { motion } from "framer-motion";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Shared                                                            */
/* ------------------------------------------------------------------ */

const cardStyle = "bg-white border border-gray-200 p-4";

const enter = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const tierColors: Record<string, string> = {
  explorer: "#94a3b8",
  regular: "#4ade80",
  member: "#f97316",
  vip: "#a78bfa",
};

/* ------------------------------------------------------------------ */
/*  1. StatsCard                                                      */
/* ------------------------------------------------------------------ */

export function StatsCard({
  occupancy,
  capacity,
  visitorsToday,
  revenue,
  members,
}: {
  occupancy: number;
  capacity: number;
  visitorsToday: number;
  revenue: number;
  members: number;
}) {
  const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;

  return (
    <motion.div {...enter} className={`${cardStyle} space-y-3`}>
      {/* Occupancy bar */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Occupancy</p>
        <div className="h-2 bg-gray-100 overflow-hidden">
          <motion.div
            className="h-full bg-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <p className="font-mono text-2xl font-bold text-gray-900 mt-1">
          {occupancy}
          <span className="text-xs text-gray-400 font-normal"> / {capacity}</span>
        </p>
      </div>

      {/* 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Visitors Today" value={String(visitorsToday)} />
        <StatBox label="Revenue" value={fmt$(revenue)} />
        <StatBox label="Members" value={String(members)} />
        <StatBox label="Occupancy %" value={`${pct}%`} />
      </div>
    </motion.div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="font-mono text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. BookingsCard                                                   */
/* ------------------------------------------------------------------ */

export function BookingsCard({
  bookings,
  onApprove,
  onDecline,
}: {
  bookings: Array<{
    id: string;
    guest_name: string;
    offering_name: string;
    starts_at: string;
    cal_status: string;
  }>;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  return (
    <motion.div {...enter} className={`${cardStyle} space-y-2`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Bookings</p>

      {bookings.length === 0 && (
        <p className="text-gray-500 text-sm">No bookings</p>
      )}

      {bookings.map((b) => (
        <div
          key={b.id}
          className="bg-gray-50 border border-gray-200 p-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{b.guest_name}</p>
            <p className="text-xs text-gray-400 truncate">
              {b.offering_name} &middot; {formatTime(b.starts_at)}
            </p>
          </div>

          <StatusBadge status={b.cal_status} />

          {onApprove && onDecline && b.cal_status === "pending" && (
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => onApprove(b.id)}
                className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onDecline(b.id)}
                className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    confirmed: "bg-green-50 text-green-700 border border-green-200",
    declined: "bg-red-50 text-red-600 border border-red-200",
    cancelled: "bg-gray-100 text-gray-400 border border-gray-200",
  };
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-sm text-xs font-medium ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  3. GuestsCard                                                     */
/* ------------------------------------------------------------------ */

export function GuestsCard({
  guests,
}: {
  guests: Array<{
    id: string;
    display_name: string | null;
    tier: string;
    venue_xp: number;
    started_at: string;
  }>;
}) {
  return (
    <motion.div {...enter} className={`${cardStyle} space-y-2`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        Active Guests ({guests.length})
      </p>

      {guests.length === 0 && (
        <p className="text-gray-500 text-sm">No active guests</p>
      )}

      {guests.map((g) => (
        <div
          key={g.id}
          className="bg-gray-50 border border-gray-200 p-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-800 truncate">
                {g.display_name ?? "Guest"}
              </p>
              <span
                className="shrink-0 px-2 py-0.5 rounded-sm text-xs font-medium"
                style={{
                  backgroundColor: `${tierColors[g.tier] ?? tierColors.explorer}20`,
                  color: tierColors[g.tier] ?? tierColors.explorer,
                }}
              >
                {g.tier}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {g.venue_xp} XP &middot; checked in {relativeTime(g.started_at)}
            </p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. RevenueCard                                                    */
/* ------------------------------------------------------------------ */

export function RevenueCard({
  today,
  thisWeek,
  pendingPayouts,
}: {
  today: number;
  thisWeek: number;
  pendingPayouts: number;
}) {
  return (
    <motion.div {...enter} className={cardStyle}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Revenue</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-400">Today</p>
          <p className="font-mono text-xl font-bold text-orange-500">
            {fmt$(today)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">This Week</p>
          <p className="font-mono text-xl font-bold text-gray-900">{fmt$(thisWeek)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Pending</p>
          <p className="font-mono text-xl font-bold text-gray-900">
            {fmt$(pendingPayouts)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. ActionConfirmCard                                              */
/* ------------------------------------------------------------------ */

export function ActionConfirmCard({
  success,
  message,
}: {
  success: boolean;
  message: string;
}) {
  return (
    <motion.div
      {...enter}
      className={`p-4 flex items-center gap-3 bg-white border ${success ? "border-green-200" : "border-red-200"}`}
    >
      {/* Icon */}
      <div
        className={`shrink-0 w-8 h-8 flex items-center justify-center ${success ? "bg-green-50" : "bg-red-50"}`}
      >
        {success ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 8.5L6.5 12L13 4"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <p className="text-sm text-gray-700">{message}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. SettingsLinkCard                                               */
/* ------------------------------------------------------------------ */

export function SettingsLinkCard({
  section,
  label,
}: {
  section: string;
  label: string;
}) {
  return (
    <motion.div {...enter}>
      <Link
        href={`/settings#${section}`}
        className="bg-white border border-gray-200 p-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors block"
      >
        <span className="text-sm font-medium text-gray-800">{label}</span>

        <svg
          className="shrink-0 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </motion.div>
  );
}
