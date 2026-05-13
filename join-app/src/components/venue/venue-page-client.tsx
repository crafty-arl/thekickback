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
import { ProductDrawer, getBookingDates, TYPE_EMOJI, type OfferingMeta } from "@/components/shared/product-drawer";

/* ── Types ── */

interface Venue {
  id: string;
  name: string;
  state: string;
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
  location_name?: string | null;
  location_address?: string | null;
  rsvp_count?: number | null;
  max_attendees?: number | null;
  image_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  category?: string | null;
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

/* OfferingMeta imported from @/components/shared/product-drawer */

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
  metadata?: { date?: string; time?: string; staffId?: string; staffName?: string };
}

/* ── Helpers ── */

function stripTags(text: string): string {
  return text
    .replace(/\[\[OFFER:[^\]]*\]\]/g, "")
    .replace(/\[\[CHECKOUT:[\s\S]*?\]\]/g, "")
    .replace(/\[\[BOOKING:[\s\S]*?\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
  { label: "Tell me more", cmd: "tell me more about this place" },
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
    description: "",
    tags: [] as string[], hours: "", memberOnly: false, textNumber: "", latitude: 0, longitude: 0,
  };
}

/* TYPE_EMOJI imported from @/components/shared/product-drawer */

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
      <div className="flex flex-col gap-2 mt-1.5">
        {offerParts.map((offer) => {
          const meta = offeringsMap[offer.id];
          const emoji = TYPE_EMOJI[meta?.type || "custom"] || "✦";

          return (
            <div key={offer.id} className="flex items-center gap-0 overflow-hidden" style={{ backgroundColor: `${theme}06`, border: `1px solid ${theme}12` }}>
              {/* Tap to open detail drawer */}
              <button
                onClick={() => onTapOffer(offer.id)}
                className="flex flex-1 items-center gap-2.5 px-3.5 py-3 text-left transition-colors duration-150 active:opacity-70"
              >
                {meta?.image_url ? (
                  <img src={meta.image_url} alt="" className="h-10 w-10 shrink-0 object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[16px]" style={{ backgroundColor: `${theme}15` }}>{emoji}</div>
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

/* getBookingDates imported from @/components/shared/product-drawer */

/* ProductDrawer imported from @/components/shared/product-drawer */

/* ═══════════════════════════════════════════════════
   VENUE PAGE — Profile + Chat Dock
   ═══════════════════════════════════════════════════ */

export function VenuePageClient({ page, venue, table, user, offerings, gallery = [], staff = [], staffByOffering = {} }: Props) {
  const color = page.theme_color || "#F97316";
  const theme = page.theme_color;
  /* ── Chat state — Phase 4: starts collapsed. Auto-expanding the chat on
     every page hit silently accrued LLM cost on accidental opens. Users tap
     to expand (the FAB-style header row), or typing in the input auto-expands. */
  const [chatOpen, setChatOpen] = useState(false);
  const [showGestureHint, setShowGestureHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("kb-gesture-seen");
  });
  const activeTab: Tab = "chat";
  const controls = useAnimationControls();
  const welcomeMsg: Message = { id: "welcome", sender: "ai", body: `Hey! Welcome to ${venue.name}. Ask me anything.`, timestamp: Date.now() };
  const [messages, setMessages] = useState<Message[]>([welcomeMsg]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [offeringsMap, setOfferingsMap] = useState<Record<string, OfferingMeta>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOfferId, setDrawerOfferId] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);
  const walletStatus = useWalletStatus();
  const passkey = usePasskey();
  const [paymentMode, setPaymentMode] = useState<"choose" | "processing" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch balance + history
  // Points/bookings fetches removed — handled by main app profile

  // Auto-dismiss gesture hint after 3s
  useEffect(() => {
    if (!showGestureHint) return;
    const t = setTimeout(() => { setShowGestureHint(false); localStorage.setItem("kb-gesture-seen", "1"); }, 3000);
    return () => clearTimeout(t);
  }, [showGestureHint]);

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
      backgroundColor: chatOpen ? "rgba(12, 12, 14, 0.88)" : "rgba(12, 12, 14, 0.55)",
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [chatOpen, controls]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    // Allow cart actions even while loading
    if (msg === "__CHECKOUT__" || msg === "__CLEAR_CART__") {
      // bypass loading check for cart actions
    } else if (loading) return;
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
      // Remove any existing checkout messages (only one active at a time)
      setMessages((prev) => [...prev.filter((m) => !m.checkout), checkoutMsg]);
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
        body: JSON.stringify({ message: msg, venueId: venue.id, venueName: venue.name, vibe: venue.vibe, table }),
      });

      const aiMsgId = `ai-${Date.now()}`;
      // Add empty AI message immediately for streaming
      setMessages((prev) => [...prev, { id: aiMsgId, sender: "ai" as const, body: "", timestamp: Date.now() }]);
      setLoading(false);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullReply = "";
      let metadata: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(chunk.slice(6));
            if (event.type === "delta") {
              fullReply += event.text;
              const displayText = stripTags(fullReply);
              setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, body: displayText } : m));
            } else if (event.type === "done") {
              metadata = event;
            }
          } catch { /* skip */ }
        }
      }

      // Process metadata after stream completes
      if (metadata) {
        const data = metadata as Record<string, unknown>;
        if (data.offerings) setOfferingsMap((prev) => ({ ...prev, ...(data.offerings as Record<string, OfferingMeta>) }));
        let replyBody: string = (data.reply as string) || fullReply || "Couldn't reach the venue right now.";

        // Build checkout
        let checkoutData: CheckoutCardData | undefined;
        if (data.checkout) {
          checkoutData = { ...(data.checkout as CheckoutCardData), venue_name: venue.name, venue_id: venue.id };
        }

        // Enrich booking confirmations with details
        const bookingData = data.booking as { booking?: { start?: string; end?: string; message?: string } } | null;
        if (bookingData?.booking) {
          const bk = bookingData.booking;
          const bkStart = bk.start ? new Date(bk.start) : null;
          const bkEnd = bk.end ? new Date(bk.end) : null;
          const dateStr = bkStart ? bkStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
          const timeStr = bkStart ? bkStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          const endTimeStr = bkEnd ? bkEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
          replyBody += `\n\nBooking confirmed: ${bookingData.booking.message || ""}${dateStr ? `\nDate: ${dateStr}` : ""}${timeStr ? `\nTime: ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}` : ""}`;
        }

        // Update the AI message with cleaned reply and metadata
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, body: replyBody, tab: activeTab, checkout: checkoutData } : m));
      }
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
      if (!res.ok) {
        setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: `Order failed: ${result.error || `HTTP ${res.status}`}`, timestamp: Date.now() }]);
        return;
      }
      const itemNames = msg.checkout.items.map((i) => i.quantity && i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name).join(", ");
      const bonusPts = Math.floor(subtotal / 10);
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed: ${itemNames}. Total: $${(subtotal / 100).toFixed(2)}.${method === "wallet" ? " Paid from AI Credit." : " Charged to card on file."}${pointsToSpend > 0 ? ` Used ${pointsToSpend} points.` : ""}${bonusPts > 0 ? ` +${bonusPts} XP earned!` : ""} Show this to the host when you arrive.`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      // Remove checkout messages (prevent double-pay) then add confirmation
      setMessages((prev) => [...prev.filter((m) => !m.checkout), confirmMsg]);
      if (result.orderId) {
        setCart([]);
        setCartExpanded(false);
        walletStatus?.refresh?.();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("Payment error:", errMsg);
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "ai", body: `Order failed: ${errMsg}`, timestamp: Date.now() }]);
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
          {user && (
            <a href="/" className="flex h-9 w-9 items-center justify-center backdrop-blur-md" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </a>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWalletOpen(true)}
              className="flex h-9 items-center gap-1.5 px-3.5 backdrop-blur-md font-sans text-[12px] font-medium"
              style={{ backgroundColor: walletStatus?.active ? "rgba(99,91,255,0.3)" : "rgba(0,0,0,0.4)", color: walletStatus?.active ? "#c4b5fd" : "rgba(255,255,255,0.7)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              {walletStatus?.active ? `$${(walletStatus.balanceCents / 100).toFixed(0)}` : "Wallet"}
            </button>
          </div>
        </div>

        {/* Venue identity */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
          <div className="flex items-center gap-2 mb-2">
          </div>
          <h1 className="font-sans text-[28px] font-bold leading-tight tracking-tight">{venue.name}</h1>
          {page.tagline && <p className="mt-1.5 font-sans text-[14px] leading-relaxed text-white/50">{page.tagline}</p>}
          {venue.neighborhood && <p className="mt-1.5 font-sans text-[12px] text-white/30">{venue.neighborhood}{venue.address ? ` · ${venue.address}` : ""}</p>}
        </div>
      </div>

      {table && (
        <div className="flex justify-center py-2" style={{ backgroundColor: `${theme}15` }}>
          <span className="font-sans text-[12px] font-medium" style={{ color: theme }}>You're at Table {table}</span>
        </div>
      )}

      {/* ═══ SCROLLABLE BODY ═══ */}
      <div className="pb-[100px]">

        {/* Spacer between hero and content */}
        <div className="h-2" />

        {/* Quick info row */}
        <div className="flex gap-2.5 overflow-x-auto px-5 py-4 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          {page.hours.length > 0 && (
            <div className="shrink-0 px-5 py-3.5" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)", minWidth: 140 }}>
              <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25 mb-2">HOURS</p>
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
              className="shrink-0 flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-150 active:opacity-80" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)", minWidth: 140 }}>
              <div className="flex h-9 w-9 items-center justify-center" style={{ backgroundColor: `${theme}20` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              </div>
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">LOCATION</p>
                <p className="font-sans text-[12px] text-white/50 mt-0.5">{venue.address}</p>
              </div>
            </a>
          )}
        </div>

        {/* Description */}
        {page.description && (
          <div className="px-5 pb-5">
            <p className="font-sans text-[14px] leading-[1.7] text-white/50">{page.description}</p>
          </div>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="px-5 pb-6">
            <VenueGallery gallery={gallery} themeColor={theme} />
          </div>
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <div className="px-5 pb-6">
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

        {/* Events — shown separately with location + RSVP */}
        {offerings.filter((o) => o.type === "event").length > 0 && (
          <div className="px-5 pb-6">
            <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">UPCOMING EVENTS</p>
            <div className="flex flex-col gap-3.5">
              {offerings.filter((o) => o.type === "event").map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    if (!offeringsMap[event.id]) {
                      setOfferingsMap((prev) => ({ ...prev, [event.id]: { name: event.name, description: event.description, price_cents: event.price_cents, image_url: event.image_url || null, type: event.type, recurring: false, interval: null, duration_minutes: event.duration_minutes, starts_at: event.starts_at, ends_at: event.ends_at, location_name: event.location_name, location_address: event.location_address, rsvp_count: event.rsvp_count, max_attendees: event.max_attendees } }));
                    }
                    setDrawerOfferId(event.id);
                  }}
                  className="w-full overflow-hidden text-left transition-colors duration-150 active:scale-[0.98]"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: `1px solid ${theme}10` }}
                >
                  {event.image_url && (
                    <div className="relative h-32 w-full">
                      <img src={event.image_url} alt={event.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
                    </div>
                  )}
                  <div className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-[14px]">🎟️</span>
                      <h3 className="font-sans text-[15px] font-bold text-white/90">{event.name}</h3>
                    </div>
                    {event.description && (
                      <p className="font-sans text-[12px] leading-relaxed text-white/40 line-clamp-2">{event.description}</p>
                    )}
                    {event.starts_at && (
                      <p className="font-sans text-[11px] text-white/50 mt-0.5 mb-1">
                        {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {event.ends_at && ` – ${new Date(event.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {event.location_name && (
                        <div className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          <span className="font-sans text-[11px] text-white/35">{event.location_name}{event.location_address ? ` · ${event.location_address}` : ""}</span>
                        </div>
                      )}
                      {event.price_cents > 0 && (
                        <span className="font-mono text-[12px] font-bold" style={{ color: theme }}>${(event.price_cents / 100).toFixed(event.price_cents % 100 === 0 ? 0 : 2)}</span>
                      )}
                      {event.price_cents === 0 && (
                        <span className="font-sans text-[11px] font-semibold" style={{ color: "#4ade80" }}>Free</span>
                      )}
                      {(event.rsvp_count ?? 0) > 0 && (
                        <span className="font-sans text-[10px] text-white/25">{event.rsvp_count} going{event.max_attendees ? ` / ${event.max_attendees}` : ""}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Offerings */}
        {offerings.length > 0 && (
          <div className="px-5 pb-6">
            <VenueOfferings offerings={offerings} themeColor={theme} venueName={venue.name} staffByOffering={staffByOffering} onTapOffering={(id) => {
              // Populate offeringsMap for the drawer if not already present
              const o = offerings.find((off) => off.id === id);
              if (o && !offeringsMap[id]) {
                setOfferingsMap((prev) => ({ ...prev, [id]: { name: o.name, description: o.description, price_cents: o.price_cents, image_url: o.image_url || null, type: o.type, recurring: o.recurring, interval: o.interval, duration_minutes: o.duration_minutes, starts_at: o.starts_at, ends_at: o.ends_at, location_name: o.location_name, location_address: o.location_address, rsvp_count: o.rsvp_count, max_attendees: o.max_attendees } }));
              }
              setDrawerOfferId(id);
            }} />
          </div>
        )}

        {/* Menu */}
        {page.menu_sections.length > 0 && (
          <div className="px-5 pb-6">
            <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MENU</p>
            <div className="flex flex-col gap-3.5">
              {page.menu_sections.map((section) => (
                <div key={section.name} className="px-5 py-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="mb-3 font-sans text-[13px] font-semibold text-white/60">{section.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {section.items.map((item) => (
                      <span key={item} className="px-3 py-1 font-sans text-[12px] text-white/45" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        {venue.rules?.length > 0 && (
          <div className="px-5 pb-6">
            <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">HOUSE RULES</p>
            <div className="flex flex-col gap-2.5">
              {venue.rules.map((rule) => (
                <div key={rule} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme }} />
                  <span className="font-sans text-[13px] leading-relaxed text-white/40">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Balance/XP/bookings drawer removed — lives in user profile on main app */}

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
              style={{ background: "linear-gradient(to bottom, rgba(12,12,15,0.95) 0%, rgba(12,12,15,0.85) 100%)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
                <h2 className="font-sans text-[16px] font-bold text-white">AI Wallet</h2>
                <button onClick={() => setWalletOpen(false)} className="flex h-8 w-8 items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
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
                    className="flex w-full items-center justify-center gap-2 py-3.5 font-sans text-[13px] font-bold text-white active:scale-[0.98]"
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
            borderRadius: 0,
            backgroundColor: "rgba(12, 12, 14, 0.55)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {/* Collapsed: input bar (shown when not expanded) */}
          {!chatOpen && (
            <div className="flex h-[56px] items-center gap-2.5 px-4">
              <button onClick={() => setChatOpen(true)} className="flex items-center gap-2 pl-1 shrink-0">
                <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">{venue.name}</span>
              </button>
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setChatOpen(true); send(); } }}
                onFocus={() => setChatOpen(true)}
                placeholder={user ? "Ask anything..." : "Swipe up for more info"} enterKeyHint="send" autoComplete="off" autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
              />
              <motion.button
                onClick={() => { setChatOpen(true); send(); }}
                disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center disabled:opacity-30"
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
              {/* Gesture hint — auto-dismiss */}
              <AnimatePresence>
                {showGestureHint && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { setShowGestureHint(false); setChatOpen(false); }}
                    className="flex w-full items-center justify-center gap-2 py-2"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                    <span className="font-sans text-[11px] text-white/25">Swipe down to minimize</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
                <div className="flex items-center gap-2">
                  <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span className="font-sans text-[15px] font-semibold text-white/90">{venue.name}</span>
                  <span className="font-sans text-[11px] text-white/30">{venue.neighborhood || ""}</span>
                </div>
                <motion.button onClick={() => { setChatOpen(false); setShowGestureHint(false); }} whileTap={{ scale: 0.85 }} className="flex h-7 w-7 items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50"><polyline points="18 15 12 9 6 15" /></svg>
                </motion.button>
              </div>

              <div className="mx-5 h-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3.5" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                <div className="flex flex-col gap-3.5">
                  {messages.map((msg) => {
                    if (msg.sender === "guest") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                          <div className="max-w-[80%] px-4 py-3" style={{ backgroundColor: theme, color: "#000", boxShadow: `0 2px 12px ${theme}33` }}>
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
                              <div className="max-w-[85%] px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                <AiMessageBody body={msg.body} theme={theme} offeringsMap={offeringsMap} onTapOffer={(id) => setDrawerOfferId(id)} onAddToCart={(id, name, price) => addToCart(id, name, price)} />
                              </div>
                            </div>
                          )}

                          {/* Order summary */}
                          <div className="w-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${theme}15` }}>
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

                          {/* Login gate */}
                          {!user && (
                            <a
                              href="/login"
                              className="flex w-full items-center justify-center gap-2 py-3.5 font-sans text-[14px] font-bold text-black active:scale-[0.97]"
                              style={{ backgroundColor: theme }}
                            >
                              Log in to checkout
                            </a>
                          )}

                          {/* Compact payment buttons */}
                          {user && <div className="flex gap-2 w-full">
                            {/* AI Credit */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "wallet")}
                              disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1 py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
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
                              className="flex-1 flex flex-col items-center gap-1 py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold text-white/80">${(cardTotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold text-white/50">
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "Card"}
                              </span>
                              <span className="font-mono text-[8px] text-white/20">+${((stripeFee + platformFee) / 100).toFixed(2)} fees</span>
                            </button>
                          </div>}

                          {/* Cancel */}
                          <button
                            onClick={handleCheckoutDismiss}
                            className="w-full py-2.5 font-sans text-[12px] font-medium text-white/30 transition hover:bg-white/[0.04]"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            Cancel
                          </button>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        <div className="max-w-[85%] px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <AiMessageBody body={msg.body} theme={theme} offeringsMap={offeringsMap} onTapOffer={(id) => setDrawerOfferId(id)} onAddToCart={(id, name, price) => addToCart(id, name, price)} />
                        </div>
                      </motion.div>
                    );
                  })}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.04)" }}>
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
                        className="mb-1.5 overflow-hidden"
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
                                  className="flex h-5 w-5 items-center justify-center active:scale-90"
                                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                  <span className="font-mono text-[11px] font-bold text-white/50">-</span>
                                </button>
                                <span className="w-4 text-center font-mono text-[11px] font-bold text-white/60">{item.quantity}</span>
                                <button
                                  onClick={() => addToCart(item.id, item.name, item.price_cents)}
                                  className="flex h-5 w-5 items-center justify-center active:scale-90"
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
                            className="px-2.5 py-1 font-sans text-[10px] font-medium text-white/30 active:scale-95"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            Clear
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => { setCartExpanded(false); send("__CHECKOUT__"); }}
                            className="px-4 py-1.5 font-sans text-[11px] font-bold text-black active:scale-95"
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
                    className="flex w-full items-center justify-between px-3 py-1.5 active:scale-[0.98]"
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
                <div className="flex gap-2.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr.label} onClick={() => send(qr.cmd)} disabled={loading}
                      className="shrink-0 px-4 py-2 font-sans text-[12px] font-medium text-white/50 transition-colors duration-150 active:scale-95 disabled:opacity-30"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >{qr.label}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-1.5">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={user ? "Ask anything..." : "Swipe up for more info"} enterKeyHint="send" autoComplete="off" autoCorrect="off"
                  className="min-w-0 flex-1 px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 40, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
                />
                <motion.button onClick={() => send()} disabled={!input.trim() || loading} whileTap={{ scale: 0.9 }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center disabled:opacity-30"
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

    </main>
  );
}
