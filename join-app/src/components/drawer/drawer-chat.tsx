"use client";

import { type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue, getVibeLabel } from "@/lib/venues";
import {
  type Message, type Tab, type OfferingMeta, type CartItem, type UserProfile,
  TABS, VIBE_COLORS, ACCENT,
  AiMessageBody, LoadingDots, parseVenueChips,
} from "./the-drawer";
import { type CheckoutAddOn } from "../map/checkout-card";
import { PointsBadge } from "../map/points-badge";

interface DrawerChatProps {
  venue: Venue;
  user: UserProfile;
  messages: Message[];
  conciergeMessages: Message[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  send: (text?: string) => void;
  onBack: () => void;
  vibeColor: string;
  offeringsMap: Record<string, OfferingMeta>;
  addToCart: (offeringId: string, name: string, priceCents: number) => void;
  currentCart: CartItem[];
  cartTotal: number;
  cartCount: number;
  cartExpanded: boolean;
  setCartExpanded: (v: boolean) => void;
  removeFromCart: (offeringId: string) => void;
  clearCart: () => void;
  getVenueReplies: () => { label: string; action: string }[];
  handleTabTap: (tab: Tab) => void;
  handleCheckoutConfirm: (msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card") => void;
  handleCheckoutDismiss: () => void;
  walletStatus: { active: boolean; balanceCents: number; refresh?: () => void } | null;
  passkey: { hasPasskey: boolean; verifying: boolean; register: () => Promise<boolean>; verify: () => Promise<boolean> };
  paymentMode: "choose" | "processing" | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  venues: Venue[];
  apiVenues: Record<string, { id: string; name: string; vibe: string; occupancy: number; capacity: number; latitude: number | null; longitude: number | null; neighborhood: string | null }>;
  richVenues: Record<string, { id: string; name: string; vibe: string; occupancy: number; capacity: number; neighborhood?: string | null; type?: string | null; tagline?: string | null; themeColor?: string; hours?: string }>;
  onVenueSelect: (venue: Venue | null) => void;
}

function TabIcon({ path, size = 16 }: { path: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>;
}

export function DrawerChat({
  venue, user, messages, loading, input, setInput, send, onBack, vibeColor,
  offeringsMap, addToCart, currentCart, cartTotal, cartCount, cartExpanded, setCartExpanded,
  removeFromCart, clearCart, getVenueReplies, handleTabTap,
  handleCheckoutConfirm, handleCheckoutDismiss, walletStatus, passkey, paymentMode,
  scrollRef, inputRef, venues, apiVenues, richVenues, onVenueSelect,
}: DrawerChatProps) {
  return (
    <>
      {/* Header */}
      <div className="shrink-0 px-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} className="flex h-[48px] w-[48px] items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><polyline points="15 18 9 12 15 6" /></svg>
            </motion.button>
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full" style={{ border: `2px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
              {venue.heroImage ? <img src={venue.heroImage} alt="" className="h-full w-full object-cover" /> : venue.logo ? <img src={venue.logo} alt="" className="h-full w-full object-cover" /> : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-sans text-[14px] font-bold" style={{ color: vibeColor }}>{venue.name.charAt(0)}</span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0A0A0E]" style={{ backgroundColor: vibeColor }} />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[16px] font-bold text-white/90 leading-tight">{venue.name}</span>
              <span className="font-sans text-[12px] text-white/35">{venue.neighborhood || getVibeLabel(venue.vibe)}</span>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: `${vibeColor}15`, border: `1px solid ${vibeColor}20` }}>
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: vibeColor }} />
            <span className="font-sans text-[12px] font-semibold" style={{ color: vibeColor }}>{getVibeLabel(venue.vibe)}</span>
          </div>
          {venue.occupancy > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="font-mono text-[12px] font-semibold text-white/40">{venue.occupancy} in</span>
            </div>
          )}
          {walletStatus?.active && (
            <div className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(99,91,255,0.1)", border: "1px solid rgba(99,91,255,0.2)" }}>
              <span className="font-mono text-[12px] font-semibold" style={{ color: "#635bff" }}>${((walletStatus?.balanceCents || 0) / 100).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

      <PointsBadge venueId={venue.id} vibeColor={vibeColor} expanded={true} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
        <div className="flex flex-col gap-2.5">
          {messages.map((msg) => {
            if (msg.sender === "guest") {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5" style={{ backgroundColor: vibeColor, color: "#000", boxShadow: `0 2px 12px ${vibeColor}33` }}>
                    <p className="font-sans text-[15px] leading-[1.5]">{msg.body}</p>
                  </div>
                </motion.div>
              );
            }

            if (msg.tab && msg.tab !== "chat") {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                  {msg.body && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <AiMessageBody body={msg.body} theme={vibeColor} offeringsMap={offeringsMap} onAddToCart={addToCart} />
                      </div>
                    </div>
                  )}
                  <div className="ml-1">
                    <button onClick={() => handleTabTap(msg.tab!)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-medium active:scale-95" style={{ backgroundColor: `${vibeColor}12`, color: vibeColor, border: `1px solid ${vibeColor}25` }}>
                      <TabIcon path={TABS.find((t) => t.id === msg.tab)?.icon || ""} size={12} />
                      View full {msg.tab} details
                    </button>
                  </div>
                </motion.div>
              );
            }

            if (msg.checkout) {
              const subtotal = msg.checkout.items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
              const hasWallet = walletStatus?.active && walletStatus.balanceCents > 0;
              const canUseWallet = hasWallet && walletStatus.balanceCents >= subtotal;
              const stripeFee = Math.round(subtotal * 0.029 + 30);
              const platformFee = Math.round(subtotal * 0.05);
              const cardTotal = subtotal + stripeFee + platformFee;

              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                  {msg.body && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <AiMessageBody body={msg.body} theme={vibeColor} offeringsMap={offeringsMap} onAddToCart={addToCart} />
                      </div>
                    </div>
                  )}
                  {/* Order summary */}
                  <div className="w-full rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}15` }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                        <span className="font-sans text-[15px] font-bold text-white/80">Order at {venue.name}</span>
                      </div>
                      {msg.checkout.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <span className="font-sans text-[15px] text-white/60">{item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}</span>
                          <span className="font-mono text-[15px] text-white/50">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="font-sans text-[15px] font-semibold text-white/70">Subtotal</span>
                        <span className="font-mono text-[18px] font-bold text-white/80">${(subtotal / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Payment buttons */}
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleCheckoutConfirm(msg, [], 0, "wallet")}
                      disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
                      className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                      style={{ backgroundColor: canUseWallet ? "rgba(99,91,255,0.12)" : "rgba(99,91,255,0.05)", border: `1px solid ${canUseWallet ? "rgba(99,91,255,0.3)" : "rgba(99,91,255,0.1)"}` }}
                    >
                      <span className="font-mono text-[18px] font-bold" style={{ color: "#a78bfa" }}>${(subtotal / 100).toFixed(2)}</span>
                      <span className="font-sans text-[12px] font-semibold" style={{ color: "#a78bfa" }}>{passkey.verifying || paymentMode === "processing" ? "Verifying..." : "AI Credit"}</span>
                      <span className="font-sans text-[10px]" style={{ color: "#4ade80" }}>No fees</span>
                    </button>
                    <button
                      onClick={() => handleCheckoutConfirm(msg, [], 0, "card")}
                      disabled={paymentMode === "processing" || passkey.verifying}
                      className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <span className="font-mono text-[18px] font-bold text-white/80">${(cardTotal / 100).toFixed(2)}</span>
                      <span className="font-sans text-[12px] font-semibold text-white/50">{passkey.verifying || paymentMode === "processing" ? "Verifying..." : "Card"}</span>
                      <span className="font-mono text-[10px] text-white/20">+${((stripeFee + platformFee) / 100).toFixed(2)} fees</span>
                    </button>
                  </div>
                  <button onClick={handleCheckoutDismiss} className="w-full rounded-xl py-2.5 font-sans text-[15px] font-medium text-white/30 transition hover:bg-white/[0.04]" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>Cancel</button>
                </motion.div>
              );
            }

            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <AiMessageBody body={msg.body} theme={vibeColor} offeringsMap={offeringsMap} onAddToCart={addToCart} />
                </div>
              </motion.div>
            );
          })}
          {loading && <LoadingDots />}
        </div>
      </div>

      {/* Cart pill */}
      {cartCount > 0 && (
        <div className="px-3 pb-1">
          <AnimatePresence>
            {cartExpanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-1.5 overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}20` }}>
                <div className="flex flex-col gap-1 px-4 py-3">
                  {currentCart.map((item) => (
                    <div key={item.offeringId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate font-sans text-[15px] text-white/70">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(item.offeringId)} className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                          <span className="font-mono text-[15px] font-bold text-white/50">-</span>
                        </button>
                        <span className="w-5 text-center font-mono text-[15px] font-bold text-white/60">{item.quantity}</span>
                        <button onClick={() => addToCart(item.offeringId, item.name, item.priceCents)} className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90" style={{ backgroundColor: `${vibeColor}20` }}>
                          <span className="font-mono text-[15px] font-bold" style={{ color: vibeColor }}>+</span>
                        </button>
                        <span className="w-14 text-right font-mono text-[14px] font-semibold text-white/50">${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: `${vibeColor}15` }}>
                  <button onClick={clearCart} className="rounded-full px-3 py-1.5 font-sans text-[12px] font-medium text-white/30 active:scale-95" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>Clear</button>
                  <div className="flex-1" />
                  <button onClick={() => { setCartExpanded(false); send("__CHECKOUT__"); }} className="rounded-full px-4 py-1.5 font-sans text-[15px] font-bold text-black active:scale-95" style={{ backgroundColor: vibeColor }}>
                    Checkout ${(cartTotal / 100).toFixed(2)}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setCartExpanded(!cartExpanded)} className="flex w-full items-center justify-between rounded-full px-4 py-2 active:scale-[0.98]" style={{ backgroundColor: `${vibeColor}12`, border: `1px solid ${vibeColor}25`, minHeight: 44 }}>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              <span className="font-sans text-[15px] font-semibold" style={{ color: vibeColor }}>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
            </div>
            <span className="font-mono text-[15px] font-bold" style={{ color: vibeColor }}>${(cartTotal / 100).toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Quick replies */}
      {!loading && (() => {
        const replies = getVenueReplies();
        if (replies.length === 0) return null;
        return (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            {replies.slice(0, 2).map((r) => (
              <button key={r.label} onClick={() => send(r.action)} className="shrink-0 rounded-full px-3 py-2 font-sans text-[15px] font-medium active:scale-95" style={{ backgroundColor: `${vibeColor}08`, color: `${vibeColor}cc`, border: `1px solid ${vibeColor}20`, minHeight: 44 }}>
                {r.label}
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );
}
