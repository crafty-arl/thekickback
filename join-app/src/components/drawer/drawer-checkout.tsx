"use client";

import { motion } from "framer-motion";
import { type Message, type CartItem, ACCENT } from "./the-drawer";
import { type CheckoutAddOn } from "../map/checkout-card";

interface DrawerCheckoutProps {
  venue: { name: string; id: string };
  message: Message;
  vibeColor: string;
  walletStatus: { active: boolean; balanceCents: number } | null;
  passkey: { hasPasskey: boolean; verifying: boolean };
  paymentMode: "choose" | "processing" | null;
  onConfirm: (msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card") => void;
  onDismiss: () => void;
}

export function DrawerCheckout({
  venue, message, vibeColor, walletStatus, passkey, paymentMode,
  onConfirm, onDismiss,
}: DrawerCheckoutProps) {
  if (!message.checkout) return null;

  const subtotal = message.checkout.items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
  const hasWallet = walletStatus?.active && walletStatus.balanceCents > 0;
  const canUseWallet = hasWallet && walletStatus.balanceCents >= subtotal;
  const stripeFee = Math.round(subtotal * 0.029 + 30);
  const platformFee = Math.round(subtotal * 0.05);
  const cardTotal = subtotal + stripeFee + platformFee;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Order summary */}
      <div className="w-full  overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}15` }}>
        <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="font-sans text-[15px] font-bold text-white/80">Order at {venue.name}</span>
          </div>
          {message.checkout.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="font-sans text-[15px] text-white/60">
                {item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}
              </span>
              <span className="font-mono text-[15px] text-white/50">
                ${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="font-sans text-[15px] font-semibold text-white/70">Subtotal</span>
            <span className="font-mono text-[18px] font-bold text-white/80">${(subtotal / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment buttons side by side */}
      <div className="flex gap-3 w-full">
        {/* AI Credit */}
        <button
          onClick={() => onConfirm(message, [], 0, "wallet")}
          disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
          className="flex-1 flex flex-col items-center gap-1.5  py-4 px-3 transition active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: canUseWallet ? "rgba(99,91,255,0.12)" : "rgba(99,91,255,0.05)",
            border: `1px solid ${canUseWallet ? "rgba(99,91,255,0.3)" : "rgba(99,91,255,0.1)"}`,
            minHeight: 48,
          }}
        >
          <span className="font-mono text-[18px] font-bold" style={{ color: "#a78bfa" }}>
            ${(subtotal / 100).toFixed(2)}
          </span>
          <span className="font-sans text-[15px] font-semibold" style={{ color: "#a78bfa" }}>
            {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "AI Credit"}
          </span>
          <span className="font-sans text-[12px]" style={{ color: "#4ade80" }}>No fees</span>
        </button>

        {/* Card */}
        <button
          onClick={() => onConfirm(message, [], 0, "card")}
          disabled={paymentMode === "processing" || passkey.verifying}
          className="flex-1 flex flex-col items-center gap-1.5  py-4 px-3 transition active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            minHeight: 48,
          }}
        >
          <span className="font-mono text-[18px] font-bold text-white/80">
            ${(cardTotal / 100).toFixed(2)}
          </span>
          <span className="font-sans text-[15px] font-semibold text-white/50">
            {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "Card"}
          </span>
          <span className="font-mono text-[12px] text-white/20">
            +${((stripeFee + platformFee) / 100).toFixed(2)} fees
          </span>
        </button>
      </div>

      {/* Cancel */}
      <button
        onClick={onDismiss}
        className="w-full  py-3 font-sans text-[15px] font-medium text-white/30 transition hover:bg-white/[0.04]"
        style={{ border: "1px solid rgba(255,255,255,0.05)", minHeight: 48 }}
      >
        Cancel
      </button>
    </div>
  );
}
