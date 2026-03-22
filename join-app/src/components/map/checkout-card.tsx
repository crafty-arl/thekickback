"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export interface CheckoutItem {
  offering_id: string | null;
  slot_id: string | null;
  name: string;
  description?: string;
  quantity: number;
  unit_price_cents: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutAddOn {
  name: string;
  price_cents: number;
  offering_id?: string;
}

export interface CheckoutCardData {
  venue_name: string;
  venue_id: string;
  items: CheckoutItem[];
  add_ons?: CheckoutAddOn[];
  date?: string;
  time?: string;
  guests?: number;
  points_available?: number;
  multiplier?: number;
  notes?: string;
}

interface CheckoutCardProps {
  data: CheckoutCardData;
  vibeColor: string;
  onConfirm: (selectedAddOns: CheckoutAddOn[], pointsToSpend: number) => void;
  onDismiss: () => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CheckoutCard({ data, vibeColor, onConfirm, onDismiss }: CheckoutCardProps) {
  const [selectedAddOns, setSelectedAddOns] = useState<Set<number>>(new Set());
  const [usePoints, setUsePoints] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const itemsTotal = data.items.reduce(
    (sum, item) => sum + item.unit_price_cents * item.quantity,
    0
  );
  const addOnsTotal = (data.add_ons || [])
    .filter((_, i) => selectedAddOns.has(i))
    .reduce((sum, a) => sum + a.price_cents, 0);
  const subtotal = itemsTotal + addOnsTotal;

  // 100 points = $1 = 100 cents
  const maxPointsDiscount = Math.min(
    data.points_available || 0,
    subtotal
  );
  const pointsDiscount = usePoints ? maxPointsDiscount : 0;
  const total = subtotal - pointsDiscount;

  const handleConfirm = () => {
    setConfirming(true);
    const addOns = (data.add_ons || []).filter((_, i) => selectedAddOns.has(i));
    onConfirm(addOns, usePoints ? maxPointsDiscount : 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden "
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        border: `1px solid ${vibeColor}30`,
        boxShadow: `0 4px 24px ${vibeColor}10`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: `${vibeColor}10`, borderBottom: `1px solid ${vibeColor}20` }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Checkout</span>
        </div>
        <span className="font-sans text-[11px] text-white/30">{data.venue_name}</span>
      </div>

      {/* Date/time/guests context */}
      {(data.date || data.time || data.guests) && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {data.date && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-sans text-[12px] text-white/50">{data.date}</span>
            </div>
          )}
          {data.time && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="font-sans text-[12px] text-white/50">{data.time}</span>
            </div>
          )}
          {data.guests && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              </svg>
              <span className="font-sans text-[12px] text-white/50">{data.guests} guests</span>
            </div>
          )}
        </div>
      )}

      {/* Line items */}
      <div className="flex flex-col gap-1 px-4 py-3">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <span className="font-sans text-[13px] font-semibold text-white/80">{item.name}</span>
              {item.description && (
                <p className="font-sans text-[11px] text-white/30">{item.description}</p>
              )}
              {item.quantity > 1 && (
                <span className="font-sans text-[11px] text-white/25">× {item.quantity}</span>
              )}
            </div>
            <span className="font-mono text-[13px] font-semibold text-white/70">
              {formatPrice(item.unit_price_cents * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Add-ons */}
      {data.add_ons && data.add_ons.length > 0 && (
        <div className="px-4 pb-3">
          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">ADD-ONS</span>
          <div className="mt-2 flex flex-col gap-1.5">
            {data.add_ons.map((addOn, i) => {
              const isSelected = selectedAddOns.has(i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = new Set(selectedAddOns);
                    if (isSelected) next.delete(i);
                    else next.add(i);
                    setSelectedAddOns(next);
                  }}
                  className="flex items-center gap-3  px-3 py-2 transition-all"
                  style={{
                    backgroundColor: isSelected ? `${vibeColor}12` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div
                    className="flex h-5 w-5 items-center justify-center "
                    style={{
                      backgroundColor: isSelected ? vibeColor : "rgba(255,255,255,0.06)",
                      border: `1.5px solid ${isSelected ? vibeColor : "rgba(255,255,255,0.15)"}`,
                    }}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 text-left font-sans text-[12px] font-medium text-white/60">
                    {addOn.name}
                  </span>
                  <span className="font-mono text-[12px] text-white/40">
                    +{formatPrice(addOn.price_cents)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

      {/* Points discount toggle */}
      {(data.points_available || 0) > 0 && (
        <div className="px-4 py-2.5">
          <button
            onClick={() => setUsePoints(!usePoints)}
            className="flex w-full items-center gap-3  px-3 py-2 transition-all"
            style={{
              backgroundColor: usePoints ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${usePoints ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)"}`,
            }}
          >
            <div
              className="flex h-5 w-5 items-center justify-center "
              style={{
                backgroundColor: usePoints ? "#F97316" : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${usePoints ? "#F97316" : "rgba(255,255,255,0.15)"}`,
              }}
            >
              {usePoints && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className="flex-1 text-left font-sans text-[12px] font-medium text-white/50">
              Use {maxPointsDiscount.toLocaleString()} points
            </span>
            <span className="font-mono text-[12px] font-semibold" style={{ color: "#F97316" }}>
              −{formatPrice(maxPointsDiscount)}
            </span>
          </button>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="font-sans text-[13px] font-semibold text-white/50">Total</span>
        <div className="flex items-center gap-2">
          {pointsDiscount > 0 && (
            <span className="font-mono text-[12px] text-white/25 line-through">
              {formatPrice(subtotal)}
            </span>
          )}
          <span className="font-mono text-[18px] font-bold text-white">
            {formatPrice(total)}
          </span>
        </div>
      </div>

      {/* Multiplier bonus hint */}
      {data.multiplier && data.multiplier > 1 && (
        <div className="mx-4 mb-3 flex items-center gap-2  px-3 py-1.5" style={{ backgroundColor: "rgba(249,115,22,0.06)" }}>
          <span className="font-sans text-[11px]" style={{ color: "#F97316" }}>
            🔥 {data.multiplier}x points tonight — earn {Math.round((total / 100) * 10 * data.multiplier)} pts on this purchase
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={onDismiss}
          className="flex-1  py-3 font-sans text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04]"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex flex-[2] items-center justify-center gap-2  py-3 font-sans text-[13px] font-bold text-black transition active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: vibeColor }}
        >
          {confirming ? (
            "Processing..."
          ) : total === 0 ? (
            "Confirm (Free)"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Pay {formatPrice(total)}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
