"use client";

import { motion } from "framer-motion";
import type { GuestSession } from "@/lib/dashboard";
import type { Order, OrderItem } from "@/components/dashboard/orders-panel";

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

const tierColors: Record<string, string> = {
  explorer: "#94a3b8",
  regular: "#4ade80",
  member: "#f97316",
  vip: "#a78bfa",
};

// ─── Types ──────────────────────────────────────────────────────────

interface XpActivityEntry {
  amount: number;
  reason: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

interface GuestDetailDrawerProps {
  guest: GuestSession;
  ordersState: Order[];
  xpActivity: XpActivityEntry[];
  onClose: () => void;
  onOrderTap: (order: Order) => void;
  onAskAboutGuest: (name: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function GuestDetailDrawer({
  guest,
  ordersState,
  xpActivity,
  onClose,
  onOrderTap,
  onAskAboutGuest,
}: GuestDetailDrawerProps) {
  const guestName = guest.profiles?.display_name || "Guest";
  const guestEmail = guest.profiles?.email || null;
  const tier = guest.tier || "explorer";

  const guestOrders = ordersState
    .filter((o) => o.user_id === guest.user_id)
    .slice(0, 5);

  const guestXp = (xpActivity || [])
    .filter((e) => e.profiles?.display_name === guestName)
    .slice(0, 5);

  return (
    <>
      <motion.div
        key="guest-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30"
      />
      <motion.div
        key="guest-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <p className="font-sans text-[16px] font-bold text-gray-900">Guest Details</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Profile */}
          <div className="rounded-xl bg-gray-50 p-4" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full font-sans text-[18px] font-bold text-white"
                style={{ backgroundColor: tierColors[tier] || tierColors.explorer }}
              >
                {guestName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-sans text-[16px] font-semibold text-gray-900">{guestName}</p>
                {guestEmail && <p className="font-sans text-[12px] text-gray-400">{guestEmail}</p>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold capitalize"
                style={{ backgroundColor: `${tierColors[tier] || tierColors.explorer}20`, color: tierColors[tier] || tierColors.explorer }}
              >
                {tier}
              </span>
              {guest.is_member && (
                <span className="rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold" style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#F97316" }}>
                  Member
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 px-4 py-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="font-mono text-[22px] font-bold" style={{ color: "#F97316" }}>{guest.venue_xp ?? 0}</p>
              <p className="font-sans text-[11px] text-gray-400">Venue XP</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="font-mono text-[22px] font-bold" style={{ color: "#8B5CF6" }}>{guest.venue_visits ?? 0}</p>
              <p className="font-sans text-[11px] text-gray-400">Visits</p>
            </div>
          </div>

          {/* Recent XP at this venue */}
          {guestXp.length > 0 && (
            <div>
              <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent XP</p>
              <div className="space-y-2">
                {guestXp.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <span className="font-sans text-[12px] text-gray-600 capitalize">{entry.reason.replace(/_/g, " ")}</span>
                    <span className="font-sans text-[12px] font-semibold text-green-600">+{entry.amount} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent orders at this venue */}
          {guestOrders.length > 0 && (
            <div>
              <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent Orders</p>
              <div className="space-y-2">
                {guestOrders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => { onClose(); setTimeout(() => onOrderTap(o), 200); }}
                    className="flex cursor-pointer items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 transition hover:bg-gray-100"
                    style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    <div>
                      <p className="font-sans text-[12px] font-medium text-gray-700">
                        {((o.order_items || []) as OrderItem[]).map((i) => i.name).join(", ") || "Order"}
                      </p>
                      <p className="font-sans text-[10px] text-gray-400">{relativeTime(o.created_at)}</p>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-gray-900">{fmtCents(o.total_cents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => onAskAboutGuest(guestName)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[14px] font-bold text-white transition active:scale-[0.98]"
            style={{ backgroundColor: "#F97316" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Send Message
          </button>
        </div>
      </motion.div>
    </>
  );
}
