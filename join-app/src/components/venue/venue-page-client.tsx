"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import Image from "next/image";
import { VenueOfferings } from "./venue-offerings";
import { VenueGallery } from "./venue-gallery";
import { VenueStaff } from "./venue-staff";
import type { StaffMember } from "./venue-staff";
import { WalletSheet, useWalletStatus } from "../map/wallet-sheet";
import { type CheckoutCardData, type CheckoutAddOn } from "../map/checkout-card";
import { usePasskey } from "@/lib/use-passkey";
import { isSandboxClient } from "@/lib/sandbox";

/* ── Types ── */

interface Venue {
  id: string;
  name: string;
  state: string;
  occupancy: number;
  max_occupancy: number;
  vibe: string;
  rules: string[];
  address?: string;
  neighborhood?: string;
}

interface VenuePage {
  slug: string;
  hero_image: string | null;
  logo: string | null;
  tagline: string | null;
  description: string | null;
  theme_color: string;
  menu_sections: { name: string; items: string[] }[];
  hours: { day: string; open: string; close: string }[];
}

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

interface OfferingData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  price_cents: number;
  recurring: boolean;
  interval: string | null;
  perks: string[];
  active: boolean;
  duration_minutes?: number | null;
}

interface Props {
  page: VenuePage;
  venue: Venue;
  table?: string;
  ref?: string;
  user?: { id: string; email: string } | null;
  offerings: OfferingData[];
  gallery?: GalleryImage[];
  staff?: StaffMember[];
  staffByOffering?: Record<string, { id: string; name: string; avatar_url: string | null }[]>;
}

type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "subscribe" | "join";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
  checkout?: CheckoutCardData;
}

interface OfferingMeta {
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  type: string;
  recurring?: boolean;
  interval?: string | null;
  duration_minutes?: number | null;
  add_ons?: { name: string; price_cents: number }[] | null;
}

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
  metadata?: { date?: string; time?: string; staffId?: string; staffName?: string };
}

/* ── Helpers ── */

function vc(vibe: string): string {
  switch (vibe) {
    case "quiet": return "#4ADE80";
    case "moderate": return "#FACC15";
    case "busy": return "#F97316";
    case "packed": return "#EF4444";
    default: return "#4ADE80";
  }
}

function vl(vibe: string): string {
  switch (vibe) {
    case "quiet": return "Quiet";
    case "moderate": return "Moderate";
    case "busy": return "Busy";
    case "packed": return "Packed";
    default: return vibe;
  }
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "vibe", label: "Vibe", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { id: "menu", label: "Menu", icon: "M3 6h18M3 12h18M3 18h18" },
  { id: "events", label: "Events", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { id: "reserve", label: "Reserve", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { id: "shop", label: "Shop", icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2" },
  { id: "subscribe", label: "Subscribe", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { id: "join", label: "Join", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

const TAB_COMMANDS: Record<Tab, string> = {
  chat: "",
  vibe: "what's the vibe right now?",
  menu: "show me the menu",
  events: "any events tonight?",
  reserve: "I'd like to reserve a spot",
  shop: "what can I buy or order here?",
  subscribe: "how can I stay updated on what's happening here?",
  join: "tell me about this venue and how to join",
};

const QUICK_REPLIES = [
  { label: "What's the vibe?", cmd: "what's the vibe right now?" },
  { label: "See the menu", cmd: "show me the menu" },
  { label: "Any events?", cmd: "any events tonight?" },
  { label: "Reserve a spot", cmd: "I'd like to reserve a spot" },
  { label: "What can I buy?", cmd: "what can I buy or order here?" },
  { label: "How to join", cmd: "tell me about this venue and how to join" },
];

function toCardVenue(venue: Venue) {
  return {
    id: venue.id, name: venue.name, category: "lounge" as const,
    neighborhood: venue.neighborhood || "", vibe: (venue.vibe || "quiet") as "quiet" | "moderate" | "busy" | "lit",
    occupancy: venue.occupancy, capacity: venue.max_occupancy, description: "",
    tags: [] as string[], hours: "", memberOnly: false, textNumber: "", latitude: 0, longitude: 0,
  };
}

/* ── Type icons ── */
const TYPE_EMOJI: Record<string, string> = {
  membership: "👑", reservation: "🪑", service: "✂️", product: "☕",
  event: "🎟️", package: "📦", custom: "✦",
};

/* ── AI message body — tappable offering chips that open product drawer ── */

function AiMessageBody({ body, theme, onTapOffer, onAddToCart, offeringsMap }: {
  body: string; theme: string;
  onTapOffer: (id: string) => void;
  onAddToCart: (id: string, name: string, price: number) => void;
  offeringsMap: Record<string, OfferingMeta>;
}) {
  const parts = body.split(/(\[\[OFFER:[^\]]+\]\])/g);

  if (parts.length === 1) {
    return <p className="font-sans text-[14px] leading-[1.6]">{body}</p>;
  }

  const textParts: string[] = [];
  const offerParts: { id: string; name: string; price: number }[] = [];

  for (const part of parts) {
    const match = part.match(/\[\[OFFER:([^:]+):([^:]+):(\d+)\]\]/);
    if (match) {
      offerParts.push({ id: match[1], name: match[2], price: parseInt(match[3]) / 100 });
    } else if (part.trim()) {
      textParts.push(part);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {textParts.length > 0 && (
        <p className="font-sans text-[14px] leading-[1.6]">{textParts.join("")}</p>
      )}
      <div className="flex flex-col gap-1.5 mt-1">
        {offerParts.map((offer) => {
          const meta = offeringsMap[offer.id];
          const emoji = TYPE_EMOJI[meta?.type || "custom"] || "✦";

          return (
            <div key={offer.id} className="flex items-center gap-0 rounded-xl overflow-hidden" style={{ backgroundColor: `${theme}08`, border: `1px solid ${theme}20` }}>
              {/* Tap to open detail drawer */}
              <button
                onClick={() => onTapOffer(offer.id)}
                className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left active:opacity-70"
              >
                {meta?.image_url ? (
                  <img src={meta.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px]" style={{ backgroundColor: `${theme}15` }}>{emoji}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-medium text-white/85 truncate">{offer.name}</p>
                  <p className="font-sans text-[11px] text-white/30">{meta?.type || "item"}{meta?.duration_minutes ? ` · ${meta.duration_minutes} min` : ""}</p>
                </div>
                <span className="shrink-0 font-mono text-[14px] font-bold" style={{ color: theme }}>
                  ${offer.price % 1 === 0 ? offer.price : offer.price.toFixed(2)}
                  {meta?.recurring && <span className="text-[10px] font-normal text-white/30">/{meta.interval || "mo"}</span>}
                </span>
              </button>
              {/* Add / Book button — bookable items open drawer, non-bookable add to cart */}
              {meta?.duration_minutes && ["service", "reservation", "event"].includes(meta?.type || "") ? (
                <button
                  onClick={() => onTapOffer(offer.id)}
                  className="flex h-full shrink-0 items-center px-3 font-sans text-[11px] font-bold active:scale-90"
                  style={{ color: theme }}
                >
                  Book
                </button>
              ) : (
                <button
                  onClick={() => onAddToCart(offer.id, offer.name, offer.price * 100)}
                  className="flex h-full shrink-0 items-center px-3 font-sans text-[11px] font-bold active:scale-90"
                  style={{ color: theme }}
                >
                  + Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Date helpers for booking picker ── */

function getBookingDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayNames[d.getDay()]} ${d.getDate()}`;
    dates.push({ label, value });
  }
  return dates;
}

/* ── Product Detail Drawer — slides in from left ── */

function ProductDrawer({ offer, meta, theme, onClose, onAdd, onAddWithMeta, linkedStaff, venueId, user }: {
  offer: { id: string; name: string; price: number } | null;
  meta: OfferingMeta | null;
  theme: string;
  onClose: () => void;
  onAdd: () => void;
  onAddWithMeta: (metadata: { date: string; time: string; staffId?: string; staffName?: string }) => void;
  linkedStaff?: { id: string; name: string; avatar_url: string | null }[];
  venueId: string;
  user?: { id: string; email: string } | null;
}) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null); // null = "Anyone"
  const [selectedDate, setSelectedDate] = useState<string>(getBookingDates()[0]?.value || "");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ staff: { id: string; name: string; avatar_url: string | null; slots: string[] }[]; anyone_slots: string[] } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Bookable = has duration, regardless of whether staff are linked
  const isBookable = meta && ["service", "reservation", "event"].includes(meta.type) && meta.duration_minutes;
  const hasStaff = linkedStaff && linkedStaff.length > 0;
  const dates = getBookingDates();

  // Fetch availability when offering/date/staff changes
  useEffect(() => {
    if (!isBookable || !offer) return;
    setSlotsLoading(true);
    setSelectedTime(null);
    setSlots(null);
    const params = new URLSearchParams({ offeringId: offer.id, date: selectedDate });
    if (selectedStaff) params.set("staffId", selectedStaff);
    fetch(`/api/availability?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSlots(data); })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [offer?.id, selectedDate, selectedStaff, isBookable]);

  if (!offer) return null;
  const price = offer.price / 100;
  const emoji = TYPE_EMOJI[meta?.type || "custom"] || "✦";

  // Get displayable time slots
  const displaySlots: string[] = (() => {
    if (!slots) return [];
    if (selectedStaff && hasStaff) {
      const staffSlots = slots.staff.find((s) => s.id === selectedStaff);
      return staffSlots?.slots || [];
    }
    return slots.anyone_slots || [];
  })();

  // Get the selected date label for cart metadata
  const selectedDateLabel = dates.find((d) => d.value === selectedDate)?.label || selectedDate;
  const selectedStaffName = hasStaff && selectedStaff
    ? linkedStaff!.find((s) => s.id === selectedStaff)?.name || null
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80]"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-y-0 left-0 z-[85] w-[85vw] max-w-sm flex flex-col overflow-y-auto"
        style={{
          backgroundColor: "rgba(12,12,15,0.97)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Image or gradient hero */}
        <div className="relative shrink-0" style={{ height: meta?.image_url ? 220 : 140 }}>
          {meta?.image_url ? (
            <img src={meta.image_url} alt={offer.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme}30 0%, ${theme}08 100%)` }}>
              <span className="text-[48px]">{emoji}</span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(12,12,15,0.97) 100%)" }} />
          <button onClick={onClose} className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          {/* Type badge */}
          <div className="absolute bottom-4 left-4">
            <span className="rounded-full px-2.5 py-1 font-sans text-[10px] font-bold tracking-wider" style={{ backgroundColor: `${theme}20`, color: theme, border: `1px solid ${theme}30` }}>
              {(meta?.type || "item").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-5 pt-4 pb-6">
          <h2 className="font-sans text-[22px] font-bold text-white">{offer.name}</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-bold" style={{ color: theme }}>
              ${price % 1 === 0 ? price : price.toFixed(2)}
            </span>
            {meta?.recurring && (
              <span className="font-sans text-[14px] text-white/30">/{meta.interval || "month"}</span>
            )}
          </div>

          {meta?.duration_minutes && (
            <div className="mt-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <span className="font-sans text-[13px] text-white/40">{meta.duration_minutes} minutes</span>
            </div>
          )}

          {meta?.description && (
            <p className="mt-4 font-sans text-[14px] leading-[1.7] text-white/50">{meta.description}</p>
          )}

          {/* ── Booking UI: always shown for bookable offerings ── */}
          {isBookable && (
            <>
              {/* Section header */}
              <div className="mt-5 flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="font-sans text-[13px] font-semibold" style={{ color: theme }}>Pick a date & time</span>
              </div>

              {/* Staff picker — only when staff linked */}
              {hasStaff && <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">CHOOSE STAFF</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {/* Anyone option */}
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    style={{ width: 56 }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        border: `2px solid ${selectedStaff === null ? theme : "rgba(255,255,255,0.1)"}`,
                        backgroundColor: selectedStaff === null ? `${theme}20` : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={selectedStaff === null ? theme : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span className="font-sans text-[10px] font-medium" style={{ color: selectedStaff === null ? theme : "rgba(255,255,255,0.5)" }}>Anyone</span>
                  </button>
                  {linkedStaff!.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaff(s.id)}
                      className="flex shrink-0 flex-col items-center gap-1.5"
                      style={{ width: 56 }}
                    >
                      <div
                        className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                        style={{
                          border: `2px solid ${selectedStaff === s.id ? theme : "rgba(255,255,255,0.1)"}`,
                          backgroundColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[14px] font-bold" style={{ color: selectedStaff === s.id ? theme : "rgba(255,255,255,0.4)" }}>
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="truncate w-full text-center font-sans text-[10px] font-medium" style={{ color: selectedStaff === s.id ? theme : "rgba(255,255,255,0.5)" }}>
                        {s.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>}

              {/* Date picker */}
              <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">DATE</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {dates.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDate(d.value)}
                      className="shrink-0 rounded-xl px-3 py-2 font-sans text-[12px] font-medium active:scale-95"
                      style={{
                        backgroundColor: selectedDate === d.value ? `${theme}20` : "rgba(255,255,255,0.04)",
                        color: selectedDate === d.value ? theme : "rgba(255,255,255,0.5)",
                        border: `1px solid ${selectedDate === d.value ? `${theme}40` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slot picker */}
              <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">TIME</p>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: theme }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="font-sans text-[12px] text-white/30">Loading availability...</span>
                  </div>
                ) : displaySlots.length === 0 ? (
                  <div className="rounded-xl py-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="font-sans text-[12px] text-white/30">No slots available for this date</p>
                    <p className="mt-1 font-sans text-[10px] text-white/15">Try another day or staff member</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {displaySlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className="rounded-lg px-2.5 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                        style={{
                          backgroundColor: selectedTime === slot ? `${theme}25` : "rgba(255,255,255,0.04)",
                          color: selectedTime === slot ? theme : "rgba(255,255,255,0.5)",
                          border: `1px solid ${selectedTime === slot ? `${theme}40` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Add-ons */}
          {meta?.add_ons && meta.add_ons.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">ADD-ONS</p>
              <div className="flex flex-col gap-1.5">
                {meta.add_ons.map((addon) => (
                  <div key={addon.name} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="font-sans text-[13px] text-white/60">{addon.name}</span>
                    <span className="font-mono text-[13px] font-semibold" style={{ color: theme }}>+${(addon.price_cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action button */}
          {isBookable ? (
            // ── Bookable offering: must pick date+time, must be logged in ──
            !user ? (
              <a
                href="/login"
                className="mt-6 flex w-full items-center justify-center rounded-2xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
                style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
              >
                Log in to book
              </a>
            ) : selectedTime ? (
              <button
                onClick={() => {
                  onAddWithMeta({
                    date: selectedDateLabel,
                    time: selectedTime!,
                    staffId: selectedStaff || undefined,
                    staffName: selectedStaffName || undefined,
                  });
                }}
                className="mt-6 w-full rounded-2xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
                style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
              >
                Add to cart — {selectedDateLabel} {selectedTime}
              </button>
            ) : (
              <div
                className="mt-6 w-full rounded-2xl py-3.5 text-center font-sans text-[14px] font-bold"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}
              >
                Pick a date & time to continue
              </div>
            )
          ) : (
            // ── Non-bookable offering: add to cart directly ──
            <button
              onClick={onAdd}
              className="mt-6 w-full rounded-2xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
              style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
            >
              Add to cart — ${price % 1 === 0 ? price : price.toFixed(2)}
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   VENUE PAGE — Profile + Chat Dock
   ═══════════════════════════════════════════════════ */

export function VenuePageClient({ page, venue, table, user, offerings, gallery = [], staff = [], staffByOffering = {} }: Props) {
  const color = vc(venue.vibe);
  const theme = page.theme_color;
  const pct = Math.round((venue.occupancy / venue.max_occupancy) * 100);
  /* ── Chat state ── */
  const [chatOpen, setChatOpen] = useState(false);
  const activeTab: Tab = "chat";
  const controls = useAnimationControls();
  const welcomeMsg: Message = { id: "welcome", sender: "ai", body: `Hey! ${vl(venue.vibe)} vibes right now, ${venue.occupancy} people in. Ask me anything about ${venue.name}.`, timestamp: Date.now() };
  const [messages, setMessages] = useState<Message[]>([welcomeMsg]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [offeringsMap, setOfferingsMap] = useState<Record<string, OfferingMeta>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOfferId, setDrawerOfferId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);
  const walletStatus = useWalletStatus();
  const passkey = usePasskey();
  const [paymentMode, setPaymentMode] = useState<"choose" | "processing" | null>(null);
  const [pointsData, setPointsData] = useState<{
    balance: number; total_earned: number; tier: string; kickback_score: number;
    current_streak: number; venues_visited: number;
  } | null>(null);
  const [txHistory, setTxHistory] = useState<{
    id: string; amount: number; reason: string; venues?: { name: string }; created_at: string;
  }[]>([]);
  const [myBookings, setMyBookings] = useState<{
    id: string; offeringName: string; startsAt: string; endsAt: string | null;
    durationMinutes: number | null; status: string;
  }[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const _hasSentTabCommand = useRef<Set<Tab>>(new Set(["chat"]));

  // Fetch balance + history
  useEffect(() => {
    if (!user) return;
    fetch(`/api/points?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.balance) setPointsData(data.balance);
        if (data?.history) setTxHistory(data.history);
      })
      .catch(() => {});
    // Fetch bookings
    fetch(`/api/bookings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.bookings) setMyBookings(data.bookings);
      })
      .catch(() => {});
  }, [user, venue.id]);

  // Fresh chat each visit — history is saved server-side for AI context
  // but the UI always starts with a clean welcome message

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const h = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    window.visualViewport?.addEventListener("resize", h);
    return () => window.visualViewport?.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    controls.start({
      height: chatOpen ? "70dvh" : "56px",
      borderRadius: chatOpen ? "24px 24px 0 0" : "28px",
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [chatOpen, controls]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!chatOpen) setChatOpen(true);

    // ── Cart special actions ──
    if (msg === "__CHECKOUT__") {
      setInput("");
      if (cart.length === 0) return;
      const checkoutData: CheckoutCardData = {
        venue_name: venue.name,
        venue_id: venue.id,
        items: cart.map((item) => ({
          offering_id: item.id,
          slot_id: null,
          name: item.name,
          quantity: item.quantity,
          unit_price_cents: item.price_cents,
          metadata: item.metadata ? { ...item.metadata, type: offeringsMap[item.id]?.type } : { type: offeringsMap[item.id]?.type },
        })),
      };
      const checkoutMsg: Message = {
        id: `checkout-${Date.now()}`, sender: "ai",
        body: "Here's your order — review and confirm when ready.",
        timestamp: Date.now(), checkout: checkoutData,
      };
      setMessages((prev) => [...prev, checkoutMsg]);
      setCartExpanded(false);
      return;
    }
    if (msg === "__CLEAR_CART__") {
      setInput("");
      setCart([]);
      setCartExpanded(false);
      setMessages((prev) => [...prev, { id: `clear-${Date.now()}`, sender: "ai", body: "Cart cleared. What else can I help with?", timestamp: Date.now() }]);
      return;
    }

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, venueId: venue.id, venueName: venue.name, vibe: venue.vibe, occupancy: venue.occupancy, table }),
      });
      const data = await res.json();
      if (data.offerings) setOfferingsMap((prev) => ({ ...prev, ...data.offerings }));
      let replyBody: string = data.reply || "Couldn't reach the venue right now.";
      // Enrich booking confirmations with details
      if (data.booking?.booking) {
        const bk = data.booking.booking;
        const bkStart = bk.start ? new Date(bk.start) : null;
        const bkEnd = bk.end ? new Date(bk.end) : null;
        const dateStr = bkStart ? bkStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
        const timeStr = bkStart ? bkStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
        const endTimeStr = bkEnd ? bkEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
        replyBody += `\n\nBooking confirmed: ${data.booking.message || ""}${dateStr ? `\nDate: ${dateStr}` : ""}${timeStr ? `\nTime: ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}` : ""}`;
        // Refresh bookings list
        fetch(`/api/bookings?venueId=${venue.id}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.bookings) setMyBookings(d.bookings); }).catch(() => {});
      }
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: "ai", body: replyBody, timestamp: Date.now(), tab: activeTab }]);
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, venue, table, chatOpen, activeTab]);

  function addToCart(id: string, name: string, priceCents: number, metadata?: CartItem["metadata"]) {
    // Bookable offerings without metadata must go through the scheduler first
    const meta = offeringsMap[id];
    if (meta?.duration_minutes && ["service", "reservation", "event"].includes(meta.type) && !metadata?.date) {
      setDrawerOfferId(id);
      return;
    }
    setCart((prev) => {
      // Bookable items with different times are separate line items
      if (metadata?.date) {
        return [...prev, { id, name, price_cents: priceCents, quantity: 1, metadata }];
      }
      const existing = prev.find((item) => item.id === id);
      if (existing) return prev.map((item) => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { id, name, price_cents: priceCents, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const updated = prev
        .map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0);
      return updated;
    });
    if (cart.length <= 1) setCartExpanded(false);
  }

  function clearCart() {
    setCart([]);
    setCartExpanded(false);
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Checkout handler ──
  const processPayment = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card"
  ) => {
    if (!msg.checkout) return;
    setPaymentMode("processing");

    const itemsTotal = msg.checkout.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price_cents, 0);
    const subtotal = itemsTotal + addOnsTotal - pointsToSpend;

    try {
      if (method === "wallet") {
        const spendRes = await fetch("/api/wallet/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: subtotal,
            venueId: venue.id,
            description: `Order at ${venue.name}`,
          }),
        });
        const spendResult = await spendRes.json();
        if (!spendRes.ok) throw new Error(spendResult.error || "Wallet spend failed");
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venue.id,
          items: msg.checkout.items,
          addOns,
          pointsToSpend,
          notes: msg.checkout.notes,
          paymentMethod: method,
        }),
      });
      const result = await res.json();
      const itemNames = msg.checkout.items.map((i) => i.quantity && i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name).join(", ");
      const bonusPts = Math.floor(subtotal / 10);
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed: ${itemNames}. Total: $${(subtotal / 100).toFixed(2)}.${method === "wallet" ? " Paid from AI Credit." : " Charged to card on file."}${pointsToSpend > 0 ? ` Used ${pointsToSpend} points.` : ""}${bonusPts > 0 ? ` +${bonusPts} XP earned!` : ""} Show this to the host when you arrive.`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      setMessages((prev) => [...prev, confirmMsg]);
      if (result.orderId) {
        setCart([]);
        walletStatus?.refresh?.();
        fetch(`/api/points?venueId=${venue.id}`).then((r) => r.ok ? r.json() : null).then((data) => {
          if (data?.balance) setPointsData(data.balance);
          if (data?.history) setTxHistory(data.history);
        }).catch(() => {});
      }
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: "Couldn't process the order. Try again.", timestamp: Date.now() }]);
    } finally {
      setPaymentMode(null);
    }
  }, [venue, walletStatus]);

  const handleCheckoutConfirm = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card" = "card"
  ) => {
    if (!msg.checkout) return;

    if (method === "wallet") {
      let verified = false;
      if (passkey.hasPasskey) {
        verified = await passkey.verify();
      }
      if (!verified) {
        setMessages((prev) => [...prev, {
          id: `bio-setup-${Date.now()}`, sender: "ai",
          body: "Setting up biometric on this device for wallet payments. Follow the prompt.",
          timestamp: Date.now(),
        }]);
        const registered = await passkey.register();
        if (!registered) {
          setMessages((prev) => [...prev, {
            id: `bio-${Date.now()}`, sender: "ai",
            body: "Biometric setup cancelled. Pay with card instead — no biometric needed.",
            timestamp: Date.now(),
          }]);
          return;
        }
        verified = await passkey.verify();
        if (!verified) {
          setMessages((prev) => [...prev, {
            id: `bio-err-${Date.now()}`, sender: "ai",
            body: "Verification failed. Try card payment instead.",
            timestamp: Date.now(),
          }]);
          return;
        }
      }
    }

    await processPayment(msg, addOns, pointsToSpend, method);
  }, [passkey, processPayment]);

  const handleCheckoutDismiss = useCallback(() => {
    setMessages((prev) => [...prev, { id: `cancel-${Date.now()}`, sender: "ai", body: "No worries — let me know if you change your mind.", timestamp: Date.now() }]);
  }, []);

  // Drawer data
  const drawerMeta = drawerOfferId ? offeringsMap[drawerOfferId] : null;
  const drawerOffer = drawerOfferId && drawerMeta ? { id: drawerOfferId, name: drawerMeta.name, price: drawerMeta.price_cents } : null;

  return (
    <main className="relative min-h-dvh w-full text-white" style={{ backgroundColor: "#000" }}>

      {/* ═══ SANDBOX BANNER ═══ */}
      {isSandboxClient() && (
        <div className="sticky top-0 z-50 bg-yellow-500 px-4 py-1.5 text-center font-sans text-[12px] font-bold tracking-wider text-black">
          SANDBOX MODE — Test data only
        </div>
      )}

      {/* ═══ PROFILE HEADER ═══ */}
      <div className="relative" style={{ height: 280 }}>
        {page.hero_image ? (
          <Image src={page.hero_image} alt={venue.name} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 30%, ${theme}40 0%, transparent 60%), linear-gradient(to bottom, ${theme}15 0%, #000 100%)` }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)" }} />

        {/* Nav */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
          <a href="/" className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </a>
          <div className="flex items-center gap-2">
            {/* Balance pill */}
            {pointsData && (
              <button
                onClick={() => setHistoryOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-full px-3.5 backdrop-blur-md font-sans text-[12px] font-bold"
                style={{ backgroundColor: "rgba(0,0,0,0.4)", color: theme }}
              >
                {pointsData.balance.toLocaleString()} pts
              </button>
            )}
            <button
              onClick={() => setWalletOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full px-3.5 backdrop-blur-md font-sans text-[12px] font-medium"
              style={{ backgroundColor: walletStatus?.active ? "rgba(99,91,255,0.3)" : "rgba(0,0,0,0.4)", color: walletStatus?.active ? "#c4b5fd" : "rgba(255,255,255,0.7)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              {walletStatus?.active ? `$${(walletStatus.balanceCents / 100).toFixed(0)}` : "Wallet"}
            </button>
          </div>
        </div>

        {/* Venue identity */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: theme }}>
              <div className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
              <span className="font-sans text-[10px] font-bold tracking-[1px] text-black">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-sans text-[11px] font-semibold" style={{ color }}>{vl(venue.vibe)}</span>
            </div>
            <div className="rounded-full px-2.5 py-1 font-sans text-[11px] text-white/60" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              {venue.occupancy}/{venue.max_occupancy} ({pct}%)
            </div>
          </div>
          <h1 className="font-sans text-[28px] font-bold leading-tight tracking-tight">{venue.name}</h1>
          {page.tagline && <p className="mt-1 font-sans text-[14px] text-white/50">{page.tagline}</p>}
          {venue.neighborhood && <p className="mt-1 font-sans text-[12px] text-white/30">{venue.neighborhood}{venue.address ? ` · ${venue.address}` : ""}</p>}
        </div>
      </div>

      {table && (
        <div className="flex justify-center py-2" style={{ backgroundColor: `${theme}15` }}>
          <span className="font-sans text-[12px] font-medium" style={{ color: theme }}>You're at Table {table}</span>
        </div>
      )}

      {/* ═══ SCROLLABLE BODY ═══ */}
      <div className="pb-[100px]">

        {/* Quick info row */}
        <div className="flex gap-2 overflow-x-auto px-4 py-4 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          {page.hours.length > 0 && (
            <div className="shrink-0 rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 140 }}>
              <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25 mb-1.5">HOURS</p>
              {page.hours.slice(0, 3).map((h) => (
                <div key={h.day} className="flex justify-between gap-4 py-0.5">
                  <span className="font-sans text-[11px] text-white/40">{h.day}</span>
                  <span className="font-sans text-[11px] text-white/60">{h.open}–{h.close}</span>
                </div>
              ))}
              {page.hours.length > 3 && <p className="font-sans text-[10px] text-white/20 mt-1">+{page.hours.length - 3} more</p>}
            </div>
          )}
          {venue.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-80" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 140 }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme}20` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              </div>
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">LOCATION</p>
                <p className="font-sans text-[12px] text-white/50 mt-0.5">{venue.address}</p>
              </div>
            </a>
          )}
          {offerings.filter((o) => o.type === "membership").length > 0 && (
            <button onClick={() => setChatOpen(true)} className="shrink-0 rounded-2xl px-4 py-3 text-left active:scale-[0.98]" style={{ backgroundColor: `${theme}10`, border: `1px solid ${theme}20`, minWidth: 140 }}>
              <p className="font-sans text-[10px] font-semibold tracking-[1px] mb-1.5" style={{ color: `${theme}80` }}>MEMBERSHIP</p>
              <p className="font-sans text-[13px] font-semibold" style={{ color: theme }}>
                {offerings.filter((o) => o.type === "membership")[0]?.name}
              </p>
              <p className="font-sans text-[11px] text-white/30 mt-0.5">Tap to learn more</p>
            </button>
          )}
        </div>

        {/* Description */}
        {page.description && (
          <div className="px-5 pb-4">
            <p className="font-sans text-[14px] leading-[1.7] text-white/50">{page.description}</p>
          </div>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="px-5 pb-5">
            <VenueGallery gallery={gallery} themeColor={theme} />
          </div>
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <div className="px-5 pb-5">
            <VenueStaff
              staff={staff}
              themeColor={theme}
              offeringsByStaff={(() => {
                const map: Record<string, string[]> = {};
                for (const [offeringId, staffMembers] of Object.entries(staffByOffering)) {
                  const offering = offerings.find((o) => o.id === offeringId);
                  if (!offering) continue;
                  for (const s of staffMembers) {
                    const sm = staff.find((st) => st.display_name === s.name);
                    if (sm) { if (!map[sm.id]) map[sm.id] = []; map[sm.id].push(offering.name); }
                  }
                }
                return map;
              })()}
            />
          </div>
        )}

        {/* Offerings */}
        {offerings.length > 0 && (
          <div className="px-5 pb-5">
            <VenueOfferings offerings={offerings} themeColor={theme} venueName={venue.name} staffByOffering={staffByOffering} onTapOffering={(id) => {
              // Populate offeringsMap for the drawer if not already present
              const o = offerings.find((off) => off.id === id);
              if (o && !offeringsMap[id]) {
                setOfferingsMap((prev) => ({ ...prev, [id]: { name: o.name, description: o.description, price_cents: o.price_cents, image_url: null, type: o.type, recurring: o.recurring, interval: o.interval, duration_minutes: o.duration_minutes } }));
              }
              setDrawerOfferId(id);
            }} />
          </div>
        )}

        {/* Menu */}
        {page.menu_sections.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MENU</p>
            <div className="flex flex-col gap-3">
              {page.menu_sections.map((section) => (
                <div key={section.name} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="mb-2.5 font-sans text-[13px] font-semibold text-white/60">{section.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {section.items.map((item) => (
                      <span key={item} className="rounded-lg px-2.5 py-1 font-sans text-[12px] text-white/45" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        {venue.rules?.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">HOUSE RULES</p>
            <div className="flex flex-col gap-2">
              {venue.rules.map((rule) => (
                <div key={rule} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme }} />
                  <span className="font-sans text-[13px] text-white/40">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ BALANCE & HISTORY DRAWER — slides from right ═══ */}
      <AnimatePresence>
        {historyOpen && pointsData && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-[80]"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-[85] w-[85vw] max-w-sm flex flex-col overflow-y-auto"
              style={{ backgroundColor: "rgba(12,12,15,0.97)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-4">
                <h2 className="font-sans text-[16px] font-bold text-white">Your Balance</h2>
                <button onClick={() => setHistoryOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Balance card */}
              <div className="mx-5 rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${theme}25 0%, ${theme}08 100%)`, border: `1px solid ${theme}30` }}>
                <p className="font-sans text-[11px] font-semibold tracking-[1px] text-white/30">POINTS BALANCE</p>
                <p className="mt-1 font-mono text-[36px] font-bold text-white">{pointsData.balance.toLocaleString()}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="rounded-full px-2.5 py-1 font-sans text-[10px] font-bold tracking-wider" style={{ backgroundColor: `${theme}25`, color: theme }}>{pointsData.tier.toUpperCase()}</span>
                  {pointsData.current_streak > 0 && (
                    <span className="font-sans text-[11px] text-white/35">{pointsData.current_streak}wk streak</span>
                  )}
                  {pointsData.venues_visited > 0 && (
                    <span className="font-sans text-[11px] text-white/35">{pointsData.venues_visited} venues</span>
                  )}
                </div>
                <div className="mt-3 flex justify-between font-sans text-[11px] text-white/25">
                  <span>{pointsData.total_earned.toLocaleString()} earned all time</span>
                  <span>KB Score: {pointsData.kickback_score?.toLocaleString() || 0}</span>
                </div>
              </div>

              {/* Add to Wallet pass */}
              {user && (
                <div className="mt-3 px-5">
                  <a
                    href={`https://thekickback.net/wallet/pass/${user.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[12px] font-bold active:scale-[0.98]"
                    style={{ backgroundColor: `${theme}15`, color: theme, border: `1px solid ${theme}25` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Add to Apple Wallet
                  </a>
                </div>
              )}

              {/* Transaction history */}
              <div className="mt-5 px-5">
                <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">RECENT ACTIVITY</p>
                {txHistory.length === 0 ? (
                  <div className="rounded-2xl py-8 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[24px]">📊</p>
                    <p className="mt-2 font-sans text-[13px] text-white/30">No transactions yet</p>
                    <p className="mt-1 font-sans text-[11px] text-white/15">Check in, order, or earn points to see activity here</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 pb-8">
                    {txHistory.map((tx) => {
                      const isPositive = tx.amount > 0;
                      const reason = tx.reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      const venueName = (tx.venues as { name?: string } | undefined)?.name;
                      const date = new Date(tx.created_at);
                      const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

                      return (
                        <div key={tx.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isPositive ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)" }}>
                            <span className="font-mono text-[11px] font-bold" style={{ color: isPositive ? "#4ade80" : "#ef4444" }}>
                              {isPositive ? "+" : "−"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-sans text-[13px] font-medium text-white/70">{reason}</p>
                            <p className="font-sans text-[10px] text-white/25">{venueName ? `${venueName} · ` : ""}{timeStr}</p>
                          </div>
                          <span className="shrink-0 font-mono text-[14px] font-bold" style={{ color: isPositive ? "#4ade80" : "#ef4444" }}>
                            {isPositive ? "+" : "−"}{Math.abs(tx.amount).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* My Bookings */}
              {myBookings.length > 0 && (
                <div className="mt-5 px-5 pb-8">
                  <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MY BOOKINGS</p>
                  <div className="flex flex-col gap-1.5">
                    {myBookings.map((b) => {
                      const start = b.startsAt ? new Date(b.startsAt) : null;
                      const isPast = start ? start.getTime() < Date.now() : false;
                      const isCancelled = b.status === "cancelled";
                      const dateStr = start ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                      const timeStr = start ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                      const muted = isPast || isCancelled;

                      return (
                        <div key={b.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", opacity: muted ? 0.5 : 1 }}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isCancelled ? "rgba(239,68,68,0.12)" : "rgba(139,92,246,0.12)" }}>
                            <span className="text-[14px]">{isCancelled ? "\u2715" : "\uD83D\uDCC5"}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-sans text-[13px] font-medium text-white/70">{b.offeringName}</p>
                            <p className="font-sans text-[10px] text-white/25">
                              {dateStr}{timeStr ? ` at ${timeStr}` : ""}{b.durationMinutes ? ` \u00B7 ${b.durationMinutes} min` : ""}
                              {isCancelled ? " \u00B7 Cancelled" : isPast ? " \u00B7 Past" : ""}
                            </p>
                          </div>
                          {!isPast && !isCancelled && (
                            <button
                              onClick={async () => {
                                if (cancellingId) return;
                                setCancellingId(b.id);
                                try {
                                  const res = await fetch("/api/book/cancel", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ bookingId: b.id }),
                                  });
                                  if (res.ok) {
                                    setMyBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, status: "cancelled" } : bk));
                                  }
                                } catch { /* ignore */ }
                                finally { setCancellingId(null); }
                              }}
                              disabled={cancellingId === b.id}
                              className="shrink-0 rounded-lg px-2.5 py-1.5 font-sans text-[10px] font-semibold active:scale-95 disabled:opacity-50"
                              style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                            >
                              {cancellingId === b.id ? "..." : "Cancel"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ AI WALLET DRAWER — slides from right ═══ */}
      <AnimatePresence>
        {walletOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWalletOpen(false)}
              className="fixed inset-0 z-[80]"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-[85] w-[85vw] max-w-sm flex flex-col overflow-y-auto"
              style={{ backgroundColor: "rgba(12,12,15,0.97)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
                <h2 className="font-sans text-[16px] font-bold text-white">AI Wallet</h2>
                <button onClick={() => setWalletOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <WalletSheet />
              {/* Add to Wallet pass */}
              {user && (
                <div className="px-4 pb-4">
                  <a
                    href={`https://thekickback.net/wallet/pass/${user.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-sans text-[13px] font-bold text-white active:scale-[0.98]"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Add to Apple Wallet
                  </a>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ PRODUCT DRAWER — slides from left ═══ */}
      <AnimatePresence>
        {drawerOfferId && (
          <ProductDrawer
            offer={drawerOffer}
            meta={drawerMeta || null}
            theme={theme}
            onClose={() => setDrawerOfferId(null)}
            onAdd={() => {
              if (drawerOffer) addToCart(drawerOffer.id, drawerOffer.name, drawerOffer.price);
              setDrawerOfferId(null);
            }}
            onAddWithMeta={(metadata) => {
              if (drawerOffer) {
                addToCart(drawerOffer.id, drawerOffer.name, drawerOffer.price, metadata);
                setDrawerOfferId(null);
              }
            }}
            linkedStaff={drawerOfferId ? staffByOffering[drawerOfferId] : undefined}
            venueId={venue.id}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* ═══ UNIFIED DOCK — matches main app dock ═══ */}
      <div className="fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}>
        <motion.div
          animate={controls}
          className="relative mx-3 flex flex-col overflow-hidden"
          style={{
            height: 56,
            borderRadius: 28,
            background: "rgba(12, 12, 14, 0.92)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 -4px 30px rgba(0,0,0,0.3)",
          }}
        >
          {/* Collapsed: input bar (shown when not expanded) */}
          {!chatOpen && (
            <div className="flex h-[56px] items-center gap-2 px-3">
              <button onClick={() => setChatOpen(true)} className="flex items-center gap-2 pl-1 shrink-0">
                <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">{venue.name}</span>
              </button>
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setChatOpen(true); send(); } }}
                onFocus={() => setChatOpen(true)}
                placeholder="Ask anything..." enterKeyHint="send" autoComplete="off" autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
              />
              <motion.button
                onClick={() => { setChatOpen(true); send(); }}
                disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{ backgroundColor: theme, boxShadow: `0 2px 10px ${theme}40` }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            </div>
          )}

          {/* Expanded: chat panel */}
          {chatOpen && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
                  <span className="font-sans text-[11px] text-white/30">{vl(venue.vibe)} · {pct}%</span>
                </div>
                <motion.button onClick={() => setChatOpen(false)} whileTap={{ scale: 0.85 }} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50"><polyline points="18 15 12 9 6 15" /></svg>
                </motion.button>
              </div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                <div className="flex flex-col gap-2.5">
                  {messages.map((msg) => {
                    if (msg.sender === "guest") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5" style={{ backgroundColor: theme, color: "#000", boxShadow: `0 2px 12px ${theme}33` }}>
                            <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
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
                                <AiMessageBody body={msg.body} theme={theme} offeringsMap={offeringsMap} onTapOffer={(id) => setDrawerOfferId(id)} onAddToCart={(id, name, price) => addToCart(id, name, price)} />
                              </div>
                            </div>
                          )}

                          {/* Order summary */}
                          <div className="w-full rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${theme}15` }}>
                            <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="flex items-center gap-2 mb-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                <span className="font-sans text-[13px] font-bold text-white/80">Order at {venue.name}</span>
                              </div>
                              {msg.checkout.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-0.5">
                                  <span className="font-sans text-[12px] text-white/60">
                                    {item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}
                                  </span>
                                  <span className="font-mono text-[12px] text-white/50">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between mt-1 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <span className="font-sans text-[12px] font-semibold text-white/70">Subtotal</span>
                                <span className="font-mono text-[13px] font-bold text-white/80">${(subtotal / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Compact payment buttons */}
                          <div className="flex gap-2 w-full">
                            {/* AI Credit */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "wallet")}
                              disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: canUseWallet ? "rgba(99,91,255,0.12)" : "rgba(99,91,255,0.05)", border: `1px solid ${canUseWallet ? "rgba(99,91,255,0.3)" : "rgba(99,91,255,0.1)"}` }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold" style={{ color: "#a78bfa" }}>${(subtotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold" style={{ color: "#a78bfa" }}>
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "AI Credit"}
                              </span>
                              {walletStatus?.active && <span className="font-mono text-[9px] text-white/25">Bal: ${(walletStatus.balanceCents / 100).toFixed(2)}</span>}
                              <span className="font-sans text-[8px]" style={{ color: "#4ade80" }}>No fees</span>
                            </button>
                            {/* Card */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "card")}
                              disabled={paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold text-white/80">${(cardTotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold text-white/50">
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "Card"}
                              </span>
                              <span className="font-mono text-[8px] text-white/20">+${((stripeFee + platformFee) / 100).toFixed(2)} fees</span>
                            </button>
                          </div>

                          {/* Cancel */}
                          <button
                            onClick={handleCheckoutDismiss}
                            className="w-full rounded-xl py-2.5 font-sans text-[12px] font-medium text-white/30 transition hover:bg-white/[0.04]"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            Cancel
                          </button>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <AiMessageBody body={msg.body} theme={theme} offeringsMap={offeringsMap} onTapOffer={(id) => setDrawerOfferId(id)} onAddToCart={(id, name, price) => addToCart(id, name, price)} />
                        </div>
                      </motion.div>
                    );
                  })}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex gap-1.5">
                          {[0, 0.15, 0.3].map((d, i) => <motion.div key={i} className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Cart pill */}
              {cartCount > 0 && (
                <div className="px-3 pb-1">
                  <AnimatePresence>
                    {cartExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-1.5 overflow-hidden rounded-xl"
                        style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${theme}20` }}
                      >
                        <div className="flex flex-col gap-1 px-3 py-2">
                          {cart.map((item, i) => (
                            <div key={`${item.id}-${i}`} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate font-sans text-[12px] text-white/70">
                                {item.name}
                                {item.metadata?.date && <span className="text-white/30"> · {item.metadata.date} {item.metadata.time}</span>}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                  <span className="font-mono text-[11px] font-bold text-white/50">-</span>
                                </button>
                                <span className="w-4 text-center font-mono text-[11px] font-bold text-white/60">{item.quantity}</span>
                                <button
                                  onClick={() => addToCart(item.id, item.name, item.price_cents)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: `${theme}20` }}
                                >
                                  <span className="font-mono text-[11px] font-bold" style={{ color: theme }}>+</span>
                                </button>
                                <span className="w-12 text-right font-mono text-[11px] font-semibold text-white/50">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: `${theme}15` }}>
                          <button
                            onClick={() => clearCart()}
                            className="rounded-full px-2.5 py-1 font-sans text-[10px] font-medium text-white/30 active:scale-95"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            Clear
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => { setCartExpanded(false); send("__CHECKOUT__"); }}
                            className="rounded-full px-4 py-1.5 font-sans text-[11px] font-bold text-black active:scale-95"
                            style={{ backgroundColor: theme }}
                          >
                            Checkout ${(cartTotal / 100).toFixed(2)}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setCartExpanded(!cartExpanded)}
                    className="flex w-full items-center justify-between rounded-full px-3 py-1.5 active:scale-[0.98]"
                    style={{ backgroundColor: `${theme}12`, border: `1px solid ${theme}25` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      <span className="font-sans text-[11px] font-semibold" style={{ color: theme }}>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: theme }}>${(cartTotal / 100).toFixed(2)}</span>
                  </button>
                </div>
              )}

              {/* Quick replies */}
              {messages.length <= 2 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr.label} onClick={() => send(qr.cmd)} disabled={loading}
                      className="shrink-0 rounded-full px-3.5 py-2 font-sans text-[12px] font-medium text-white/50 active:scale-95 disabled:opacity-30"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >{qr.label}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything..." enterKeyHint="send" autoComplete="off" autoCorrect="off"
                  className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <motion.button onClick={() => send()} disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ backgroundColor: theme, boxShadow: `0 2px 10px ${theme}40` }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Powered by */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: "max(2px, calc(env(safe-area-inset-bottom, 2px) + 62px))" }}>
        <span className="font-sans text-[9px] text-white/10">powered by theKickBack</span>
      </div>
    </main>
  );
}
