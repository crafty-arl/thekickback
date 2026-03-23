"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Order, OrderItem } from "@/components/dashboard/orders-panel";

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Types ──────────────────────────────────────────────────────────

interface OrderDetailDrawerProps {
  order: Order;
  feeRate: number;
  drawerSaving: boolean;
  onStatusUpdate: (orderId: string, status: string) => Promise<void>;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function OrderDetailDrawer({
  order,
  feeRate,
  drawerSaving,
  onStatusUpdate,
  onClose,
}: OrderDetailDrawerProps) {
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Pending", color: "#FACC15", bg: "#FACC1512" },
    confirmed: { label: "Confirmed", color: "#16a34a", bg: "#16a34a12" },
    fulfilled: { label: "Fulfilled", color: "#94a3b8", bg: "#94a3b812" },
    cancelled: { label: "Cancelled", color: "#ef4444", bg: "#ef444412" },
  };
  const sc = statusConfig[order.status] || statusConfig.pending;
  const guestName = order.profiles?.display_name || order.guest_name || "Guest";
  const guestEmail = order.profiles?.email || order.guest_email || null;
  const items = (order.order_items || []) as OrderItem[];
  const subtotal = items.reduce((s, i) => s + (i.subtotal_cents || i.unit_price_cents * i.quantity), 0);
  const fee = Math.round(subtotal * feeRate);
  const net = subtotal - fee;

  return (
    <>
      <motion.div
        key="order-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { onClose(); setCancelConfirm(false); }}
        className="fixed inset-0 z-50 bg-black/30"
      />
      <motion.div
        key="order-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="font-sans text-[16px] font-bold text-gray-900">Order #{order.id.slice(0, 8)}</p>
            <p className="font-sans text-[11px] text-gray-400">
              {new Date(order.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
              {new Date(order.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 font-sans text-[11px] font-semibold"
              style={{ backgroundColor: sc.bg, color: sc.color }}
            >
              {sc.label}
            </span>
            <button
              onClick={() => { onClose(); setCancelConfirm(false); }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Guest */}
          <div className="rounded-xl bg-gray-50 p-4" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-400">Guest</p>
            <p className="mt-1 font-sans text-[15px] font-semibold text-gray-900">{guestName}</p>
            {guestEmail && <p className="font-sans text-[12px] text-gray-400">{guestEmail}</p>}
          </div>

          {/* Line items */}
          <div>
            <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-400">Items</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between rounded-xl bg-gray-50 px-4 py-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div>
                    <p className="font-sans text-[13px] font-medium text-gray-700">{item.name}</p>
                    <p className="font-sans text-[11px] text-gray-400">Qty: {item.quantity} @ {fmtCents(item.unit_price_cents)}</p>
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-gray-900">{fmtCents(item.subtotal_cents || item.unit_price_cents * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-gray-50 p-4 space-y-2" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] text-gray-400">Subtotal</span>
              <span className="font-mono text-[13px] text-gray-600">{fmtCents(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] text-gray-400">Platform fee ({Math.round(feeRate * 100)}%)</span>
              <span className="font-mono text-[13px] text-red-400">-{fmtCents(fee)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
              <span className="font-sans text-[13px] font-semibold text-gray-700">Net Earnings</span>
              <span className="font-mono text-[15px] font-bold" style={{ color: "#16a34a" }}>{fmtCents(net)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4 space-y-2" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {order.status !== "fulfilled" && order.status !== "cancelled" && (
            <button
              onClick={() => onStatusUpdate(order.id, "fulfilled")}
              disabled={drawerSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#16a34a" }}
            >
              {drawerSaving ? "Updating..." : "Mark Fulfilled"}
            </button>
          )}
          {order.status !== "cancelled" && (
            cancelConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => onStatusUpdate(order.id, "cancelled")}
                  disabled={drawerSaving}
                  className="flex flex-1 items-center justify-center rounded-xl py-3 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  {drawerSaving ? "Cancelling..." : "Confirm Cancel"}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 py-3 font-sans text-[13px] font-medium text-gray-500 transition active:scale-[0.98]"
                >
                  Go Back
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCancelConfirm(true)}
                className="flex w-full items-center justify-center rounded-xl border border-red-200 py-3 font-sans text-[13px] font-medium text-red-500 transition active:scale-[0.98]"
              >
                Cancel Order
              </button>
            )
          )}
        </div>
      </motion.div>
    </>
  );
}
