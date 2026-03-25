"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useAnimationControls } from "framer-motion";
import {
  type Venue,
  getVibeHexColor,
  getVibeLabel,
} from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { PreferencesSection } from "./preferences-section";
import { ThreadsList, useThreadCount } from "./threads-list";
import { VibeCard, MenuCard, EventsCard, ReserveCard, ShopCard, SubscribeCard, JoinCard } from "./tab-cards";
import { VenueProfileCards } from "./venue-profile-cards";
import { VenueContact } from "./venue-contact";
import { type CheckoutCardData, type CheckoutAddOn } from "./checkout-card";
import { WalletSheet, useWalletStatus } from "./wallet-sheet";
import { usePasskey } from "@/lib/use-passkey";
import { sendOtp, verifyOtp } from "@/app/login/actions";
import { getDeviceId } from "@/lib/device-id";
import { haversineMeters } from "@/lib/geo";
import { APP_VERSION, BUILD_NUMBER, BUILD_DATE } from "@/lib/version";
import Image from "next/image";
import { ProductDrawer, type OfferingMeta as SharedOfferingMeta } from "@/components/shared/product-drawer";

// ─── Types ───────────────────────────────────────────────────────

export interface Tag {
  id: string;
  label: string;
  type: "venue" | "category" | "vibe" | "offering" | "neighborhood";
  color: string;
  venueIds: string[];
}

type DockMode = "idle" | "explore" | "concierge" | "venueChat" | "profile" | "threads";
type SnapPoint = "peek" | "half" | "full";
type Tab = "chat" | "vibe" | "menu" | "events" | "reserve" | "shop" | "subscribe" | "join";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
  tab?: Tab;
  checkout?: CheckoutCardData;
}

interface RouteData {
  geometry: GeoJSON.LineString;
  color: string;
}

interface NavStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
}

interface NavInfo {
  steps: NavStep[];
  distance: number; // total meters
  duration: number; // total seconds
  profile: "walking" | "driving";
}

interface TheDockProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onVenueSelect: (venue: Venue | null) => void;
  userLocation: { latitude: number; longitude: number } | null;
  onRecenter: () => void;
  hasLocation: boolean;
  activeTag: Tag | null;
  onTagSelect: (tag: Tag | null) => void;
  onNavigateVenue: (dir: -1 | 1) => void;
  onRouteChange?: (route: RouteData | null) => void;
  mapRef?: React.RefObject<import("react-map-gl").MapRef | null>;
}

interface OfferingMeta {
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  type: string;
  duration_minutes?: number | null;
}

interface CartItem {
  offeringId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface Perk {
  id: string;
  venue_id: string;
  name: string;
  point_cost: number;
  category: string;
  description: string | null;
}

interface VenueXpProfile {
  venue_id: string;
  xp: number;
  visits: number;
  venues?: { id: string; name: string; vibe: string };
  venue_xp_milestones?: { name: string; color: string; threshold: number } | null;
}

interface UserProfile {
  authId: string;
  email: string;
  kickbackScore: number;
  totalEarned: number;
  tier: string;
  streak: number;
  venueProfiles: VenueXpProfile[];
}

interface ApiVenue {
  id: string;
  name: string;
  vibe: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
}

interface RichVenue {
  id: string;
  name: string;
  vibe: string;
  neighborhood?: string | null;
  type?: string | null;
  tagline?: string | null;
  themeColor?: string;
  hours?: string;
  isCard?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────

const ACCENT = "#a78bfa";

const IDLE_SUGGESTIONS = [
  "What's happening nearby?",
  "Find a quiet spot to work",
  "Any happy hours tonight?",
  "Best coffee around here",
  "Where's the vibe right now?",
  "Book a haircut",
  "Events this weekend",
  "Somewhere good for a date",
];

const TIER_CONFIG: Record<string, { color: string; label: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", label: "Explorer", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", label: "Regular", next: "Member", threshold: 1500 },
  member: { color: "#f97316", label: "Member", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", label: "VIP", next: "", threshold: Infinity },
};

// ─── Tutorial overlay ────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: "This is your dock",
    desc: "The bar at the bottom is your control center. Swipe up to explore, tap a pin to start chatting, or tap your avatar to open your profile.",
    icon: "M4 15h16M4 19h16",
    hint: "Try swiping the dock up now",
  },
  {
    title: "Pins are places",
    desc: "Every dot on the map is a place — a cafe, barbershop, studio, league, or community. Colored dots are claimed places with AI agents. Gray dots are discovered from public data.",
    icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    hint: "Tap any pin to open it",
  },
  {
    title: "Swipe up to explore",
    desc: "Pull the dock up to browse what's nearby. You'll see places sorted by distance, offerings by category, and personalized picks based on your history.",
    icon: "M12 19V5M5 12l7-7 7 7",
    hint: "Swipe up from the dock bar",
  },
  {
    title: "Chat with any place",
    desc: "When you tap a pin, the AI concierge for that place opens. Ask anything — menu, hours, availability. It can take orders and book appointments right in the chat.",
    icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    hint: "Type a message or tap a quick reply",
  },
  {
    title: "Chat or Shop — your choice",
    desc: "Toggle between Chat and Shop at the top of any place. Chat lets you ask questions and order conversationally. Shop gives you a browsable list of everything available.",
    icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6",
    hint: "Tap 'Shop' to browse offerings",
  },
  {
    title: "The KB Concierge",
    desc: "When no place is selected, the dock becomes your personal concierge. Ask 'where's good coffee nearby?' or 'any events tonight?' and it'll recommend places across the whole map.",
    icon: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
    hint: "Tap the search bar without a pin selected",
  },
  {
    title: "KB Wallet",
    desc: "Load funds into your KB Wallet from your profile. When you order through the chat, pay instantly — no card fumbling. The AI handles checkout for you.",
    icon: "M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM1 10h22",
    hint: "Open your profile to set up your wallet",
  },
  {
    title: "Check in & earn XP",
    desc: "When you're near a place, a check-in button appears in the dock. Tap it to earn XP. Every visit, order, and referral earns points toward perks like free drinks and priority access.",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    hint: "Look for the green check-in button when nearby",
  },
  {
    title: "Your profile",
    desc: "Tap your avatar to see your KickBack Score, tier, wallet, memberships, perks, memory, and settings. You can edit your name, adjust discovery radius, and manage devices.",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    hint: "Tap your avatar in the dock",
  },
  {
    title: "Threads & memory",
    desc: "Every conversation is saved. Tap the thread icon to see all your chats. The AI remembers your preferences across every place — your usual orders, vibes, and favorites get better over time.",
    icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h6",
    hint: "Tap the purple thread badge in the dock",
  },
];

function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[90]"
        style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="fixed inset-x-4 bottom-24 z-[95] max-w-sm mx-auto overflow-hidden"
        style={{ backgroundColor: "rgba(12,12,15,0.95)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20 }}
      >
        <div className="px-5 pt-5 pb-4">
          {/* Step indicator */}
          <div className="flex gap-1.5 mb-4">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ backgroundColor: i <= step ? "#F97316" : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full mb-3" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={current.icon} />
            </svg>
          </div>

          {/* Content */}
          <h3 className="font-sans text-[17px] font-bold text-white mb-1.5">{current.title}</h3>
          <p className="font-sans text-[13px] leading-relaxed text-white/50">{current.desc}</p>
          {current.hint && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              <span className="font-sans text-[11px] font-medium" style={{ color: "#F97316" }}>{current.hint}</span>
            </div>
          )}
          <div className="mt-2 font-sans text-[10px] text-white/20">{step + 1} of {TUTORIAL_STEPS.length}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="font-sans text-[12px] text-white/30 transition hover:text-white/50">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-full px-4 py-2 font-sans text-[12px] font-medium text-white/50"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) {
                  try { localStorage.setItem("kb-tutorial-seen", "1"); } catch {}
                  onClose();
                } else {
                  setStep(step + 1);
                }
              }}
              className="rounded-full px-4 py-2 font-sans text-[12px] font-bold text-black"
              style={{ backgroundColor: "#F97316" }}
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Profile Identity (editable name + account) ─────────────────────

function ProfileIdentity({ user, tierColor }: { user: { authId: string; email: string; kickbackScore: number; tier: string; streak: number }; tierColor: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load display name on mount
  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.profile?.display_name) {
        setDisplayName(d.profile.display_name);
        setName(d.profile.display_name);
      }
    }).catch(() => {});
  }, []);

  const saveName = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (res.ok) {
        setDisplayName(name.trim() || null);
        setEditing(false);
      }
    } finally { setSaving(false); }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (res.ok) window.location.href = "/login";
    } finally { setDeleting(false); }
  };

  const initial = (displayName || user.email)[0].toUpperCase();

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`, border: `2px solid ${tierColor}40` }}>
          <span className="font-sans text-[22px] font-bold" style={{ color: tierColor }}>{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          {!editing ? (
            <button onClick={() => { setName(displayName || ""); setEditing(true); }} className="flex items-center gap-1.5 group">
              <p className="font-sans text-[14px] font-semibold text-white/80 truncate">{displayName || user.email}</p>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" className="shrink-0 group-hover:stroke-white/50 transition">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 font-sans text-[13px] text-white/90 placeholder:text-white/20 outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button onClick={saveName} disabled={saving} className="shrink-0 rounded-lg px-2.5 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50" style={{ backgroundColor: tierColor }}>
                {saving ? "..." : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="shrink-0 rounded-lg px-2 py-1.5 font-sans text-[11px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                Cancel
              </button>
            </div>
          )}
          {!editing && displayName && <p className="font-sans text-[11px] text-white/30 truncate">{user.email}</p>}
          <div className="mt-1 flex items-center gap-2">
            <span className="px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
              {TIER_CONFIG[user.tier]?.label || "Explorer"}
            </span>
            <span className="font-mono text-[12px] font-bold" style={{ color: tierColor }}>{user.kickbackScore.toLocaleString()} XP</span>
            {user.streak > 0 && <span className="font-sans text-[11px] font-semibold text-orange">🔥 {user.streak}</span>}
          </div>
          {TIER_CONFIG[user.tier]?.next && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100)}%`, backgroundColor: tierColor }} />
              </div>
              <span className="font-sans text-[9px] text-white/20">{TIER_CONFIG[user.tier].next}</span>
            </div>
          )}
        </div>
      </div>

      {/* Account management — below settings section, rendered in parent */}
      {/* Delete account is handled via confirmDelete state passed through */}
    </>
  );
}

function DeleteAccountButton() {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="flex w-full items-center justify-center gap-2 py-2.5 font-sans text-[12px] font-medium text-red-400/40 transition hover:text-red-400/60"
        style={{ border: "1px solid rgba(239,68,68,0.08)" }}
      >
        Delete Account
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
      <p className="font-sans text-[12px] text-red-400/80 mb-2">This will permanently delete your account, wallet, points, and all data. This cannot be undone.</p>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setDeleting(true);
            try {
              const res = await fetch("/api/profile", { method: "DELETE" });
              if (res.ok) window.location.href = "/login";
            } finally { setDeleting(false); }
          }}
          disabled={deleting}
          className="flex-1 rounded-lg py-2 font-sans text-[12px] font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "rgba(239,68,68,0.8)" }}
        >
          {deleting ? "Deleting..." : "Yes, Delete"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="flex-1 rounded-lg py-2 font-sans text-[12px] font-medium text-white/40"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Redeemable perk ────────────────────────────────────────────────

const PERK_ICONS: Record<string, string> = { drink: "☕", food: "🍔", access: "🔑", experience: "✨", merch: "🎁", other: "🎯" };

function RedeemablePerk({ perk, canRedeem, userScore }: { perk: { id: string; name: string; point_cost: number; category: string; description: string | null }; canRedeem: boolean; userScore: number }) {
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState("");

  const handleRedeem = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canRedeem || redeeming) return;
    setRedeeming(true);
    setError("");
    try {
      const res = await fetch("/api/perks/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId: perk.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Redemption failed");
      } else {
        setRedeemed(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setRedeeming(false);
    }
  };

  if (redeemed) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
        <span className="text-[14px]">✅</span>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[12px] font-semibold" style={{ color: "#4ADE80" }}>{perk.name} — Redeemed!</p>
          <p className="font-sans text-[10px] text-white/30">Check your email for the QR code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[14px]">{PERK_ICONS[perk.category] || "🎯"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[12px] font-semibold text-white/70">{perk.name}</p>
        {perk.description && <p className="font-sans text-[10px] text-white/25 truncate">{perk.description}</p>}
        {error && <p className="font-sans text-[10px] text-red-400">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] font-bold" style={{ color: canRedeem ? "#F97316" : "rgba(255,255,255,0.2)" }}>{perk.point_cost} pts</span>
        <button
          onClick={handleRedeem}
          disabled={!canRedeem || redeeming}
          className="rounded-full px-3 py-1 font-sans text-[10px] font-bold transition active:scale-95 disabled:opacity-30"
          style={{
            backgroundColor: canRedeem ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
            color: canRedeem ? "#F97316" : "rgba(255,255,255,0.2)",
            border: `1px solid ${canRedeem ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          {redeeming ? "..." : "Redeem"}
        </button>
      </div>
    </div>
  );
}

// ─── Feedback section ───────────────────────────────────────────────

function FeedbackSection() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });
      setSent(true);
      setText("");
      setTimeout(() => { setSent(false); setOpen(false); }, 2000);
    } finally { setSending(false); }
  };

  return (
    <div className="mt-4">
      <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">FEEDBACK</span>
      <div className="mt-2">
        {!open && !sent ? (
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-[12px] text-white/35 transition hover:text-white/50"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Share feedback or report a bug
          </button>
        ) : sent ? (
          <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
            <p className="font-sans text-[12px] font-semibold" style={{ color: "#4ADE80" }}>Thanks for your feedback!</p>
          </div>
        ) : (
          <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind? Bug reports, feature requests, anything..."
              rows={3}
              maxLength={500}
              autoFocus
              className="w-full resize-none rounded-lg px-3 py-2 font-sans text-[12px] text-white/80 placeholder:text-white/20 outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <div className="mt-2 flex gap-2">
              <button onClick={submit} disabled={sending || !text.trim()} className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                {sending ? "Sending..." : "Send"}
              </button>
              <button onClick={() => { setOpen(false); setText(""); }} className="rounded-lg px-3 py-1.5 font-sans text-[11px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Discovery radius setting ───────────────────────────────────────

const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
];

function DiscoveryRadiusSetting() {
  const [radius, setRadius] = useState(5000);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.profile?.discovery_radius_meters) setRadius(d.profile.discovery_radius_meters);
    }).catch(() => {});
  }, []);

  const update = async (val: number) => {
    setRadius(val);
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveryRadius: val }),
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-[11px] font-semibold text-white/40">Discovery Radius</span>
        {saving && <span className="font-sans text-[9px] text-white/20">Saving...</span>}
      </div>
      <div className="flex gap-1.5">
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update(opt.value)}
            className="flex-1 py-1.5 font-sans text-[10px] font-medium text-center transition"
            style={{
              backgroundColor: radius === opt.value ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
              color: radius === opt.value ? "#F97316" : "rgba(255,255,255,0.25)",
              border: `1px solid ${radius === opt.value ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shop view for venue dock ───────────────────────────────────────

const SHOP_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  membership: { icon: "👑", label: "Membership" },
  reservation: { icon: "📅", label: "Reservations" },
  service: { icon: "✂️", label: "Services" },
  product: { icon: "☕", label: "Products" },
  event: { icon: "🎟️", label: "Events" },
  package: { icon: "📦", label: "Packages" },
  custom: { icon: "✦", label: "Other" },
};

function DockShopView({ offerings, themeColor, onTap, onAddToCart }: {
  offerings: { id: string; type: string; name: string; description?: string | null; price_cents?: number; recurring?: boolean; interval?: string | null; duration_minutes?: number | null; category?: string | null; perks?: string[] }[];
  themeColor: string;
  onTap: (id: string) => void;
  onAddToCart: (id: string, name: string, price: number) => void;
}) {
  if (offerings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="font-sans text-[13px] text-white/30">No offerings yet</p>
      </div>
    );
  }

  // Group by category, then by type
  const categorized = new Map<string, typeof offerings>();
  const uncategorized: typeof offerings = [];
  for (const o of offerings) {
    if (o.category) {
      const arr = categorized.get(o.category) || [];
      arr.push(o);
      categorized.set(o.category, arr);
    } else {
      uncategorized.push(o);
    }
  }
  const byType = new Map<string, typeof offerings>();
  for (const o of uncategorized) {
    const arr = byType.get(o.type) || [];
    arr.push(o);
    byType.set(o.type, arr);
  }

  const sections: { label: string; items: typeof offerings }[] = [];
  for (const [cat, items] of categorized) sections.push({ label: cat, items });
  for (const [type, items] of byType) {
    const meta = SHOP_TYPE_LABELS[type] || { icon: "✦", label: type.charAt(0).toUpperCase() + type.slice(1) };
    sections.push({ label: `${meta.icon} ${meta.label}`, items });
  }

  const fmtPrice = (cents?: number, recurring?: boolean, interval?: string | null) => {
    if (!cents || cents === 0) return "Free";
    const d = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    return recurring ? `$${d}/${interval === "year" ? "yr" : "mo"}` : `$${d}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 font-sans text-[9px] font-semibold tracking-[1.5px] text-white/20 uppercase">{section.label}</p>
          <div className="flex flex-col">
            {section.items.map((o) => (
              <button
                key={o.id}
                onClick={() => onTap(o.id)}
                className="flex items-center gap-3 py-2.5 text-left active:bg-white/[0.03] transition"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}12` }}>
                  <span className="text-[14px]">{SHOP_TYPE_LABELS[o.type]?.icon || "✦"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-[13px] font-semibold text-white/85 truncate block">{o.name}</span>
                  {o.description && <span className="font-sans text-[11px] text-white/30 truncate block">{o.description}</span>}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold" style={{ color: (!o.price_cents || o.price_cents === 0) ? "#4ade80" : themeColor }}>
                    {fmtPrice(o.price_cents, o.recurring, o.interval)}
                  </span>
                  {o.type !== "membership" && o.price_cents && o.price_cents > 0 && !o.duration_minutes && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddToCart(o.id, o.name, o.price_cents!); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90"
                      style={{ backgroundColor: `${themeColor}20` }}
                    >
                      <span className="font-mono text-[14px] font-bold" style={{ color: themeColor }}>+</span>
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const PERK_EMOJI: Record<string, string> = { drink: "\u2615", food: "\ud83c\udf54", access: "\ud83d\udd11", experience: "\u2728", merch: "\ud83c\udf81", other: "\ud83c\udfaf" };
const VIBE_ORDER: Record<string, number> = { lit: 4, packed: 4, busy: 3, moderate: 2, quiet: 1 };

const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171", packed: "#f87171",
};

const CATEGORY_ICONS: Record<string, string> = {
  rooftop: "M3 21h18M5 21V7l7-4 7 4v14",
  cafe: "M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2",
  bar: "M8 22h8M12 2v20M17 8H7l1-6h8l1 6z",
  lounge: "M20 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16M2 21h20M12 7v6M8 10h8",
  restaurant: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3",
  club: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  coworking: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM12 11v4M8 11v4M16 11v4",
  barbershop: "M5 3v18M5 8h7a4 4 0 000-8H5M5 16h6a4 4 0 100-8H5",
  nail_salon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2M12 8v4l3 3",
  venue: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7v3M12 14h.01",
};

const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Cafes", bar: "Bars", restaurant: "Eats", lounge: "Lounges",
  cowork: "Cowork", coworking: "Cowork", rooftop: "Rooftops", club: "Clubs",
  barbershop: "Barbershops", nail_salon: "Nail Salons",
};

const VIBE_LABELS: Record<string, string> = {
  quiet: "Chill", moderate: "Lively", busy: "Poppin", lit: "Lit", packed: "Packed",
};

const SNAP_PEEK = 100;
const SNAP_HALF = 55;
const SNAP_FULL = 92;

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

// ─── Helpers ─────────────────────────────────────────────────────

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function snapToHeight(snap: SnapPoint): string {
  if (snap === "peek") return `${SNAP_PEEK}px`;
  if (snap === "half") return `${SNAP_HALF}vh`;
  return `${SNAP_FULL}vh`;
}

type VenueChatSnap = "collapsed" | "expanded" | "full";

function getDockHeight(mode: DockMode, exploreSnap: SnapPoint, venueChatSnap: VenueChatSnap): string {
  switch (mode) {
    case "idle": return "56px";
    case "explore": return snapToHeight(exploreSnap);
    case "concierge": return "70dvh";
    case "venueChat": return venueChatSnap === "full" ? "92dvh" : venueChatSnap === "expanded" ? "70dvh" : "56px";
    case "profile": return "70dvh";
    case "threads": return "70dvh";
  }
}

function getDockRadius(_mode: DockMode, _exploreSnap: SnapPoint, _venueChatSnap: VenueChatSnap): string {
  return "0px";
}

// Background opacity: transparent when collapsed, darker as it expands
function getDockBg(mode: DockMode, exploreSnap: SnapPoint, venueChatSnap: VenueChatSnap): string {
  if (mode === "idle") return "rgba(12, 12, 14, 0.55)";
  if (mode === "venueChat" && venueChatSnap === "collapsed") return "rgba(12, 12, 14, 0.55)";
  if (mode === "explore" && exploreSnap === "peek") return "rgba(12, 12, 14, 0.65)";
  if (mode === "explore" && exploreSnap === "half") return "rgba(12, 12, 14, 0.82)";
  if (mode === "explore" && exploreSnap === "full") return "rgba(12, 12, 14, 0.92)";
  if (mode === "venueChat" && venueChatSnap === "expanded") return "rgba(12, 12, 14, 0.85)";
  if (mode === "venueChat" && venueChatSnap === "full") return "rgba(12, 12, 14, 0.94)";
  return "rgba(12, 12, 14, 0.88)"; // concierge, profile
}

function buildVenueFromApi(av: ApiVenue): Venue {
  return {
    id: av.id,
    name: av.name,
    category: "lounge",
    neighborhood: av.neighborhood || "",
    vibe: (av.vibe || "quiet") as Venue["vibe"],
    description: "",
    tags: [],
    hours: "",
    memberOnly: false,
    textNumber: "",
    latitude: av.latitude || 0,
    longitude: av.longitude || 0,
    claimed: true,
  };
}

// Strip raw tags from streaming text so users don't see [[VENUE_CARD:...]] etc.
function stripTags(text: string): string {
  return text
    // All double-bracket tags: [[ANYTHING:...]] including multiline JSON
    .replace(/\[\[[A-Z_]+:[\s\S]*?\]\]/gi, "")
    // Partial tags that didn't close (streaming artifacts)
    .replace(/\[\[[A-Z_]+:[^\]]*$/gi, "")
    // Standalone [[venue:...]] chips
    .replace(/\[\[venue:[^\]]*\]\]/g, "")
    // Any remaining [[ that looks like a tag start
    .replace(/\[\[[A-Z_]{2,}[:\]]/gi, "")
    // Clean up leftover JSON fragments from partially stripped tags
    .replace(/\{"[a-z_]+":\s*"[^"]*"[\s\S]*?\}/g, (match) => {
      // Only strip if it looks like a tag payload (has offering_id, venue_id, etc.)
      if (/offering_id|venue_id|attendee|eventTypeId/.test(match)) return "";
      return match;
    })
    // Multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    // Leading/trailing whitespace per line
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

function parseVenueChips(
  venues: Venue[],
  apiVenues: Record<string, ApiVenue>,
  richVenues: Record<string, RichVenue>,
  text: string,
  onTap: (venue: Venue, prompt?: string) => void,
  offeringsMap?: Record<string, Record<string, OfferingMeta>>
): React.ReactNode[] {
  const parts = text.split(/(\[\[VENUE_CARD:[^\]]+\]\]|\[\[venue:[^\]]+\]\]|\[\[OFFER:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    // Offering chip: [[OFFER:id:name:price_cents]]
    const offerMatch = part.match(/^\[\[OFFER:([^:]+):([^:]+):(\d+)\]\]$/);
    if (offerMatch) {
      const offerId = offerMatch[1];
      const offerName = offerMatch[2];
      const price = parseInt(offerMatch[3]) / 100;

      return (
        <button
          key={i}
          onClick={() => {
            // Find which venue owns this offering via offeringsMap (venueId → offerId → meta)
            let ownerVenueId: string | undefined;
            if (offeringsMap) {
              for (const [vid, offers] of Object.entries(offeringsMap)) {
                if (offers[offerId]) { ownerVenueId = vid; break; }
              }
            }
            const ownerVenue = ownerVenueId
              ? (venues.find((v) => v.id === ownerVenueId) || (apiVenues[ownerVenueId] ? buildVenueFromApi(apiVenues[ownerVenueId]) : null))
              : null;

            if (ownerVenue) {
              onTap(ownerVenue, `Tell me about ${offerName}`);
            }
          }}
          className="mx-0.5 my-1 inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-[12px] font-semibold active:scale-95"
          style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316", border: "1px solid rgba(249,115,22,0.2)" }}
        >
          <span>{offerName}</span>
          <span className="font-mono text-[11px] opacity-70">${price % 1 === 0 ? price : price.toFixed(2)}</span>
        </button>
      );
    }

    const cardMatch = part.match(/^\[\[VENUE_CARD:([^\]]+)\]\]$/);
    if (cardMatch) {
      const venueId = cardMatch[1];
      const rv = richVenues[venueId];
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) venue = buildVenueFromApi(apiVenues[venueId]);
      if (!venue && !rv) return null;

      const name = rv?.name || venue?.name || "Venue";
      const cardTheme = rv?.themeColor || venue?.themeColor || "#F97316";
      const catIcon = CATEGORY_ICONS[rv?.type || ""] || CATEGORY_ICONS.cafe;

      return (
        <div key={i} className="my-2 w-full overflow-hidden " style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${cardTheme}20` }}>
          <div className="relative flex items-center justify-center" style={{ height: 80, background: `linear-gradient(135deg, ${cardTheme}18 0%, ${cardTheme}06 50%, rgba(0,0,0,0.2) 100%)` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${cardTheme}35`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
          </div>
          <div className="px-3 py-2.5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-[14px] font-bold text-white/90">{name}</p>
                {rv?.tagline && <p className="mt-0.5 line-clamp-1 font-sans text-[10px] italic text-white/30">&ldquo;{rv.tagline}&rdquo;</p>}
                <div className="mt-1 flex items-center gap-1.5">
                  {rv?.type && rv.type !== "venue" && (
                    <span className=" px-1.5 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{rv.type}</span>
                  )}
                  {(rv?.neighborhood || venue?.neighborhood) && <span className="font-sans text-[9px] text-white/20">{rv?.neighborhood || venue?.neighborhood}</span>}
                  {rv?.hours && <span className="font-sans text-[8px] text-white/15">{rv.hours.split(",")[0]}</span>}
                </div>
              </div>
              <button
                onClick={() => {
                  if (venue && confirm(`Chat with ${name}?`)) {
                    onTap(venue, `What's good at ${name} right now?`);
                  }
                }}
                className="ml-2 flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-sans text-[10px] font-bold text-black active:scale-95"
                style={{ backgroundColor: cardTheme }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    const chipMatch = part.match(/^\[\[venue:([^:\]]+)(?::([^\]]*))?\]\]$/);
    if (chipMatch) {
      const venueId = chipMatch[1];
      const venueName = chipMatch[2];
      let venue = venues.find((v) => v.id === venueId);
      if (!venue && apiVenues[venueId]) venue = buildVenueFromApi(apiVenues[venueId]);
      const displayName = venue?.name || venueName || "View venue";
      const rv = richVenues[venueId];
      const color = rv?.themeColor || ACCENT;

      return (
        <button
          key={i}
          onClick={() => { if (venue) onTap(venue); }}
          className="mx-0.5 inline-flex items-center gap-1 px-2.5 py-1 font-sans text-[12px] font-semibold active:scale-95"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {displayName}
        </button>
      );
    }
    // Strip any remaining tag-like patterns that didn't match
    const cleaned = part
      .replace(/\[\[[A-Z_]+:[\s\S]*?\]\]/gi, "")
      .replace(/\[\[venue:[^\]]*\]\]/g, "")
      .trim();
    if (!cleaned) return null;
    return <span key={i}>{cleaned}</span>;
  });
}

// ─── Sub-components ──────────────────────────────────────────────

function Shelf({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-5 pb-2.5">
        <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25">{title}</span>
        {count !== undefined && <span className="font-sans text-[10px] text-white/15">{count}</span>}
      </div>
      <div
        className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}
      >
        {children}
      </div>
    </div>
  );
}

function LandscapeVenueCard({
  venue, onClick, delay, distance, xp,
}: {
  venue: Venue; onClick: () => void; delay: number; distance?: number; xp?: number;
}) {
  const themeColor = venue.themeColor || "#F97316";
  const catIcon = CATEGORY_ICONS[venue.category] || CATEGORY_ICONS.venue;
  const catLabel = venue.category === "coworking" ? "Cowork" : venue.category;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex shrink-0 overflow-hidden  text-left"
      style={{
        width: 280, height: 140, scrollSnapAlign: "start",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="relative flex w-[40%] shrink-0 items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${themeColor}25 0%, ${themeColor}08 60%, rgba(0,0,0,0.4) 100%)` }}
      >
        {(venue.heroImage || venue.photoUrl) ? (
          <img src={venue.heroImage || venue.photoUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.7 }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${themeColor}50`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
        )}
      </div>
      <div className="flex w-[60%] flex-col justify-between p-3">
        {xp !== undefined && xp > 0 && (
          <div className="absolute right-2.5 top-2.5 px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <span className="font-mono text-[9px] font-bold" style={{ color: themeColor }}>&#9889; {xp}</span>
          </div>
        )}
        <div>
          <p className="truncate font-sans text-[14px] font-bold text-white/90">{venue.name}</p>
          {(venue.tagline || venue.description) && (
            <p className="mt-0.5 line-clamp-1 font-sans text-[10px] leading-[1.4] text-white/35">{venue.tagline || venue.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 font-sans text-[8px] font-semibold capitalize text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{catLabel}</span>
          {venue.rating && (
            <span className="flex items-center gap-0.5 font-sans text-[9px] font-medium" style={{ color: "#facc15" }}>
              ★ {venue.rating.toFixed(1)}
              {venue.reviewCount ? <span className="text-white/20">({venue.reviewCount})</span> : null}
            </span>
          )}
          {venue.neighborhood && <span className="truncate font-sans text-[9px] text-white/20">{venue.neighborhood}</span>}
          {distance !== undefined && <span className="ml-auto shrink-0 font-sans text-[9px] font-medium text-white/25">{distance.toFixed(1)} mi</span>}
        </div>
      </div>
    </motion.button>
  );
}

function PerkBadge({
  perk, venueName, canAfford, onClick, delay,
}: {
  perk: Perk; venueName: string; canAfford: boolean; onClick: () => void; delay: number;
}) {
  const emoji = PERK_EMOJI[perk.category] || "\ud83c\udfaf";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: canAfford ? 1 : 0.4, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex shrink-0 flex-col items-center"
      style={{ width: 80, scrollSnapAlign: "start" }}
    >
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
        style={{
          background: canAfford ? "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))" : "rgba(255,255,255,0.04)",
          border: `2px solid ${canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
          boxShadow: canAfford ? "0 0 16px rgba(249,115,22,0.15)" : "none",
        }}
      >
        <span className="text-[28px]">{emoji}</span>
      </div>
      <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueName}</p>
      <div
        className="mt-0.5 px-2 py-0.5"
        style={{
          backgroundColor: canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${canAfford ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        <span className={`font-mono text-[9px] font-bold ${canAfford ? "text-orange" : "text-white/25"}`}>{perk.point_cost} pts</span>
      </div>
    </motion.button>
  );
}

function IdleSuggestionRotator() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, []);
  return null;
}

function LoadingDots() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="  px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex gap-1.5">
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
          <motion.div className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── AI message body — parses [[OFFER:id:name:price]] into tappable cards ── */

function AiMessageBody({ body, theme, onAddToCart, onBookOffer, onTapOffer, offeringsMap }: {
  body: string; theme: string;
  onAddToCart: (offeringId: string, name: string, priceCents: number) => void;
  onBookOffer?: (offeringId: string) => void;
  onTapOffer?: (offeringId: string) => void;
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
          const hasImage = meta?.image_url;
          const hasDesc = meta?.description;

          return (
            <button
              key={offer.id}
              onClick={() => onTapOffer?.(offer.id)}
              className="w-full overflow-hidden text-left transition active:opacity-80"
              style={{ backgroundColor: `${theme}10`, border: `1px solid ${theme}25` }}
            >
              {hasImage && (
                <div className="relative" style={{ height: 80 }}>
                  <img src={meta.image_url!} alt={offer.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
                </div>
              )}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-[13px] font-medium text-white/85">{offer.name}</span>
                  {hasDesc && <p className="mt-0.5 font-sans text-[10px] leading-[1.3] text-white/30 line-clamp-1">{meta.description}</p>}
                  {meta?.duration_minutes && <span className="font-sans text-[9px] text-white/20">{meta.duration_minutes} min</span>}
                </div>
                <span className="shrink-0 font-mono text-[14px] font-bold" style={{ color: theme }}>
                  ${offer.price % 1 === 0 ? offer.price : offer.price.toFixed(2)}
                </span>
                <span className="shrink-0 px-2.5 py-1.5 font-sans text-[10px] font-bold" style={{ backgroundColor: theme, color: "#000" }}>
                  {meta.type === "reservation" || (meta?.duration_minutes && ["service", "event"].includes(meta.type)) ? "BOOK" : "VIEW"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
  );
}

// ─── Desktop Detection ───────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform?.toLowerCase().includes("mac") || navigator.userAgent?.toLowerCase().includes("mac"));
  }, []);
  return isMac;
}

// ─── Keyboard shortcut badge ─────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px] font-semibold text-white/50"
      style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {children}
    </span>
  );
}

// ─── Keyboard Shortcuts Overlay ──────────────────────────────────

function KeyboardShortcutsPanel({
  isMac,
  mode,
  onClose,
}: {
  isMac: boolean;
  mode: DockMode;
  onClose: () => void;
}) {
  const mod = isMac ? "\u2318" : "Ctrl";

  const sections = [
    {
      title: "NAVIGATION",
      shortcuts: [
        { keys: ["\u2190"], label: "Previous venue" },
        { keys: ["\u2192"], label: "Next venue" },
        { keys: ["Esc"], label: "Back / collapse" },
        { keys: [mod, "K"], label: "Focus input" },
        { keys: ["Enter"], label: "Open venue chat" },
      ],
    },
    {
      title: "DOCK MODES",
      shortcuts: [
        { keys: ["E"], label: "Explore" },
        { keys: ["C"], label: "Concierge" },
        { keys: ["P"], label: "Profile" },
        { keys: [mod, "\u2191"], label: "Snap dock up" },
        { keys: [mod, "\u2193"], label: "Snap dock down" },
      ],
    },
    {
      title: "VENUE TABS",
      shortcuts: TABS.map((tab, i) => ({
        keys: [`${i + 1}`],
        label: tab.label,
      })),
    },
    {
      title: "MAP",
      shortcuts: [
        { keys: ["L"], label: "Recenter location" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: "spring", damping: 25, stiffness: 400 }}
      className="fixed right-4 top-[max(80px,calc(env(safe-area-inset-top)+80px))] z-[60] w-[280px] overflow-hidden "
      style={{
        background: "rgba(12, 12, 14, 0.95)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
          </svg>
          <span className="font-sans text-[12px] font-semibold text-white/80">Keyboard Shortcuts</span>
        </div>
        <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/[0.08]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current mode indicator */}
      <div className="mx-4 mb-2 flex items-center gap-1.5 px-2.5 py-1" style={{ backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
        <div className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
        <span className="font-sans text-[9px] font-semibold text-[#a78bfa]">
          {mode === "idle" ? "Idle" : mode === "explore" ? "Explore" : mode === "concierge" ? "Concierge" : mode === "venueChat" ? "Venue Chat" : "Profile"}
        </span>
      </div>

      {/* Sections */}
      <div className="max-h-[50vh] overflow-y-auto px-4 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <span className="mb-1.5 block font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">
              {section.title}
            </span>
            <div className="flex flex-col gap-1">
              {section.shortcuts.map((sc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-sans text-[11px] text-white/45">{sc.label}</span>
                  <div className="flex items-center gap-0.5">
                    {sc.keys.map((k, j) => (
                      <span key={j}>
                        {j > 0 && <span className="mx-0.5 text-[9px] text-white/15">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.05] px-4 py-2">
        <span className="font-sans text-[9px] text-white/15">Press <Kbd>?</Kbd> to toggle</span>
      </div>
    </motion.div>
  );
}

// ─── Device Manager ─────────────────────────────────────────────

interface DeviceRecord {
  id: string;
  device_id: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

function DeviceManager() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [maxDevices, setMaxDevices] = useState(3);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState("");

  // Get current device fingerprint
  useEffect(() => {
    import("@/lib/device-id").then(({ getDeviceId }) => getDeviceId()).then(setCurrentDeviceId);
  }, []);

  const loadDevices = useCallback(() => {
    fetch("/api/devices")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.devices) setDevices(data.devices);
        if (data?.maxDevices) setMaxDevices(data.maxDevices);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRemove = useCallback(async (deviceDbId: string) => {
    setRemoving(deviceDbId);
    try {
      const res = await fetch("/api/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceDbId }),
      });
      const data = await res.json();
      if (data.ok) loadDevices();
    } catch { }
    setRemoving(null);
  }, [loadDevices]);

  const handleLogoutAll = useCallback(async () => {
    setLoggingOutAll(true);
    try {
      await fetch("/api/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      window.location.reload();
    } catch {
      setLoggingOutAll(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="h-20 animate-pulse " style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center " style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <div>
          <p className="font-sans text-[13px] font-semibold text-white/80">Devices</p>
          <p className="font-sans text-[10px] text-white/30">{devices.length} of {maxDevices} devices</p>
        </div>
      </div>

      {/* Device list */}
      <div className="flex flex-col gap-1.5">
        {devices.map((d) => {
          const isCurrent = d.device_id === currentDeviceId;
          const lastActive = new Date(d.last_active_at);
          const isToday = new Date().toDateString() === lastActive.toDateString();
          const timeLabel = isToday ? "Active today" : lastActive.toLocaleDateString(undefined, { month: "short", day: "numeric" });

          return (
            <div
              key={d.id}
              className="flex items-center justify-between  px-3 py-2.5"
              style={{
                backgroundColor: isCurrent ? "rgba(99,91,255,0.06)" : "rgba(255,255,255,0.02)",
                border: isCurrent ? "1px solid rgba(99,91,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center " style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isCurrent ? "#635bff" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-sans text-[11px] font-medium text-white/60">{d.device_name || "Unknown device"}</p>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 font-sans text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(99,91,255,0.15)", color: "#a78bfa" }}>
                        This device
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-[9px] text-white/25">{timeLabel}</p>
                </div>
              </div>
              {!isCurrent && (
                <motion.button
                  onClick={() => handleRemove(d.id)}
                  disabled={removing === d.id}
                  whileTap={{ scale: 0.9 }}
                  className=" px-2.5 py-1.5 font-sans text-[10px] font-medium text-red-400/60 transition hover:bg-red-500/10 disabled:opacity-40"
                >
                  {removing === d.id ? "..." : "Remove"}
                </motion.button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log out all devices */}
      {devices.length > 1 && (
        <motion.button
          onClick={handleLogoutAll}
          disabled={loggingOutAll}
          whileTap={{ scale: 0.97 }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5  py-2 font-sans text-[11px] font-medium text-red-400/50 transition hover:bg-red-500/5 disabled:opacity-40"
          style={{ border: "1px solid rgba(239,68,68,0.1)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {loggingOutAll ? "Logging out..." : "Log out all devices"}
        </motion.button>
      )}

      {devices.length === 0 && (
        <div className=" px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
          <p className="font-sans text-[11px] text-white/30">No devices registered yet. They appear after you sign in.</p>
        </div>
      )}
    </div>
  );
}

// ─── Inline Login ───────────────────────────────────────────────

function DockLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "waitlisted">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Capture referral key from URL on mount
  const refKey = useRef<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        refKey.current = ref;
        localStorage.setItem("kb-ref", ref);
      } else {
        refKey.current = localStorage.getItem("kb-ref") || null;
      }
    } catch {}
  }, []);

  const handleSend = async () => {
    if (!email || loading) return;
    setError("");
    setLoading(true);
    const r = await sendOtp(email);
    if (r.error) { setError(r.error); setLoading(false); return; }
    setStep("otp");
    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 6 || loading) return;
    setError("");
    setLoading(true);
    const did = await getDeviceId();
    const ua = navigator.userAgent;
    const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser";
    const os = /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : "Device";
    const r = await verifyOtp(email, otp, did, `${browser} on ${os}`, undefined, refKey.current || undefined);
    if ((r as { waitlisted?: boolean })?.waitlisted) {
      setStep("waitlisted");
      setLoading(false);
      // Clear referral key from localStorage on successful waitlist entry
      try { localStorage.removeItem("kb-ref"); } catch {}
      return;
    }
    if (r?.error) { setError(r.error); setLoading(false); return; }
    // Clear referral key on success
    try { localStorage.removeItem("kb-ref"); } catch {}
    onSuccess();
  };

  if (step === "waitlisted") {
    return (
      <div className="flex flex-col items-center px-6 py-8">
        <div className="mb-3 flex h-14 w-14 items-center justify-center " style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
          <span className="text-[28px]">{"\u23F3"}</span>
        </div>
        <h2 className="mb-1 font-sans text-[18px] font-bold text-white">You're on the waitlist</h2>
        <p className="mb-4 max-w-[280px] text-center font-sans text-[12px] leading-relaxed text-white/40">
          We're letting people in gradually. You'll get an email as soon as you're approved.
        </p>
        <div className="w-full max-w-xs  px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
          <p className="text-center font-sans text-[11px] text-white/30">
            Have a referral key from a friend? Use the invite link they shared to skip the line.
          </p>
        </div>
        <button
          onClick={() => { setStep("email"); setOtp(""); setError(""); }}
          className="mt-4 font-sans text-[12px] text-white/30"
        >
          Try a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="mb-1 font-sans text-[18px] font-bold text-white">Sign in to theKickBack</h2>
      <p className="mb-5 font-sans text-[12px] text-white/35">
        {step === "email" ? "Enter your email to get a code" : `Code sent to ${email}`}
      </p>
      {refKey.current && step === "email" && (
        <div className="mb-3 w-full max-w-xs  px-3 py-2" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <p className="text-center font-sans text-[11px] font-medium" style={{ color: "#4ADE80" }}>
            Referral key detected — you'll skip the waitlist
          </p>
        </div>
      )}
      {step === "email" ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="you@email.com"
            autoComplete="email"
            className="w-full  px-4 py-3 font-sans text-[14px] text-white outline-none placeholder:text-white/20"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !email}
            className="w-full  py-3 font-sans text-[14px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="000000"
            autoComplete="one-time-code"
            className="w-full  px-4 py-3 text-center font-mono text-[24px] tracking-[0.3em] text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleVerify}
            disabled={loading || otp.length < 6}
            className="w-full  py-3 font-sans text-[14px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            onClick={() => { setStep("email"); setOtp(""); setError(""); }}
            className="font-sans text-[12px] text-white/30"
          >
            Use a different email
          </button>
        </div>
      )}
      {error && <p className="mt-3 font-sans text-[12px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function TheDock({
  venues, selectedVenue, onVenueSelect, userLocation, onRecenter, hasLocation, activeTag, onTagSelect, onNavigateVenue, onRouteChange, mapRef: parentMapRef,
}: TheDockProps) {
  // ── Desktop / platform detection ──
  const isDesktop = useIsDesktop();
  const isMac = useIsMac();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Show onboarding toast once on desktop (after 2s delay)
  useEffect(() => {
    if (!isDesktop) return;
    try {
      if (localStorage.getItem("kb-shortcuts-seen")) return;
    } catch { return; }
    const timer = setTimeout(() => setShowOnboarding(true), 2000);
    return () => clearTimeout(timer);
  }, [isDesktop]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try { localStorage.setItem("kb-shortcuts-seen", "1"); } catch { }
  }, []);

  // Show tutorial for first-time users (3s delay, mobile + desktop)
  useEffect(() => {
    try { if (localStorage.getItem("kb-tutorial-seen")) return; } catch { return; }
    const timer = setTimeout(() => setShowTutorial(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ── Mode state ──
  const [mode, setMode] = useState<DockMode>("idle");
  const [previousMode, setPreviousMode] = useState<DockMode>("idle");
  const [exploreSnap, setExploreSnap] = useState<SnapPoint>("peek");
  const [venueChatSnap, setVenueChatSnap] = useState<VenueChatSnap>("collapsed");
  const [showVenueContact, setShowVenueContact] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // ── Chat state (persisted across mode switches) ──
  const [conciergeMessages, setConciergeMessages] = useState<Message[]>([
    { id: "welcome", sender: "ai", body: "Hey. I'm KickBack. Ask me anything \u2014 what's happening tonight, where to go, or vibe check a spot.", timestamp: Date.now() },
  ]);
  const [venueThreads, setVenueThreads] = useState<Map<string, Message[]>>(new Map());
  const [hasSentTabCommands, setHasSentTabCommands] = useState<Map<string, Set<Tab>>>(new Map());

  // ── Input / loading ──
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Venue chat state ──
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // ── User / profile state ──
  const [user, setUser] = useState<UserProfile | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [memberships, setMemberships] = useState<{ venue_id: string; venue_name: string; tier: string; expires_at: string; billing?: "stripe" | "wallet" }[]>([]);
  const [balance, setBalance] = useState(0);
  const [myCollectibles, setMyCollectibles] = useState<{ unlock_id: string; asset_id: string; name: string; asset_type: string; category: string; description: string | null; is_animated: boolean; hub_id: string | null; hub_name: string; payment_method: string; unlocked_at: string }[]>([]);
  const [referralKeys, setReferralKeys] = useState<{ id: string; key: string; used_by_email: string | null }[]>([]);

  // ── Offerings map (venueId → offeringId → meta) ──
  const [offeringsMap, setOfferingsMap] = useState<Record<string, Record<string, OfferingMeta>>>({});

  // ── GPS check-in state ──
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinResult, setCheckinResult] = useState<{ xp: number; distance: number; venueName: string } | null>(null);
  const [activeSessionMap, setActiveSessionMap] = useState<Map<string, string>>(new Map()); // venueId → sessionId
  const [endSessionLoading, setEndSessionLoading] = useState(false);
  const [endSessionResult, setEndSessionResult] = useState<{ duration: number; xp: number } | null>(null);

  // ── Cart (venueId → items) ──
  const [carts, setCarts] = useState<Map<string, CartItem[]>>(new Map());
  const [cartExpanded, setCartExpanded] = useState(false);
  const [drawerOfferId, setDrawerOfferId] = useState<string | null>(null);

  // ── Venue offerings for quick replies + shop view ──
  const [venueOfferings, setVenueOfferings] = useState<Record<string, { id: string; type: string; name: string; description?: string | null; price_cents?: number; recurring?: boolean; interval?: string | null; duration_minutes?: number | null; category?: string | null; perks?: string[] }[]>>({});
  const [venueViewMode, setVenueViewMode] = useState<"chat" | "shop">("chat");

  // ── Wallet status ──
  const walletStatus = useWalletStatus();

  // ── Passkey biometric ──
  const passkey = usePasskey();
  const [paymentMode, setPaymentMode] = useState<"choose" | "processing" | null>(null);
  const [deviceRefreshKey, setDeviceRefreshKey] = useState(0);

  // ── Navigation ──
  const [navInfo, setNavInfo] = useState<NavInfo | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navProfile, setNavProfile] = useState<"walking" | "driving">("walking");

  // ── Explore offerings (all venues) ──
  const [exploreOfferings, setExploreOfferings] = useState<{ id: string; name: string; type: string; price_cents: number; venue_id: string; description: string | null; image_url: string | null; category: string | null }[]>([]);
  const [exploreDigitalAssets, setExploreDigitalAssets] = useState<{ id: string; name: string; asset_type: string; category: string; venue_id: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }[]>([]);
  const exploreOfferingsLoaded = useRef(false);

  // ── Concierge venue data ──
  const [apiVenues, setApiVenues] = useState<Record<string, ApiVenue>>({});
  const [richVenues, setRichVenues] = useState<Record<string, RichVenue>>({});

  // ── Refs ──
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleTabTapRef = useRef<(tab: Tab) => void>(() => { });
  const conciergeHistoryLoaded = useRef(false);
  const threadInfo = useThreadCount();

  // ── Current venue messages ──
  const currentVenueMessages = selectedVenue ? (venueThreads.get(selectedVenue.id) || []) : [];

  // ── Cart helpers ──
  const currentCart = selectedVenue ? (carts.get(selectedVenue.id) || []) : [];
  const cartTotal = currentCart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const cartCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback((venueId: string, offeringId: string, name: string, priceCents: number) => {
    // Check if this is a bookable offering — redirect to venue page for scheduling
    const allMaps = offeringsMap[venueId] || {};
    const meta = allMaps[offeringId] as { duration_minutes?: number | null; type?: string } | undefined;
    if (meta?.type === "reservation" || (meta?.duration_minutes && ["service", "event"].includes(meta.type || ""))) {
      // Open ProductDrawer for bookable offerings instead of redirecting
      setDrawerOfferId(offeringId);
      return;
    }

    setCarts((prev) => {
      const next = new Map(prev);
      const items = [...(next.get(venueId) || [])];
      const existing = items.find((i) => i.offeringId === offeringId);
      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({ offeringId, name, priceCents, quantity: 1 });
      }
      next.set(venueId, items);
      return next;
    });
  }, [venues, offeringsMap]);

  const removeFromCart = useCallback((venueId: string, offeringId: string) => {
    setCarts((prev) => {
      const next = new Map(prev);
      const items = (next.get(venueId) || [])
        .map((i) => i.offeringId === offeringId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0);
      if (items.length === 0) next.delete(venueId);
      else next.set(venueId, items);
      return next;
    });
    if (currentCart.length <= 1) setCartExpanded(false);
  }, [currentCart.length]);

  const clearCart = useCallback((venueId: string) => {
    setCarts((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
    setCartExpanded(false);
  }, []);

  // ── GPS check-in helpers ──
  const nearbyVenue = useMemo(() => {
    if (!userLocation) return null;
    let closest: { venue: Venue; distance: number } | null = null;
    for (const v of venues) {
      if (!v.latitude || !v.longitude) continue;
      const dist = haversineMeters(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude);
      if (dist <= 150 && (!closest || dist < closest.distance)) {
        closest = { venue: v, distance: dist };
      }
    }
    return closest;
  }, [userLocation, venues]);

  const handleGpsCheckin = useCallback(async (venueId: string) => {
    if (!user || checkinLoading) return;
    setCheckinLoading(true);
    setCheckinResult(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const res = await fetch("/api/checkin/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");
      setCheckinResult({ xp: data.xp || 0, distance: Math.round(data.distance), venueName: data.venueName || "venue" });
      if (data.sessionId) {
        setActiveSessionMap((prev) => { const next = new Map(prev); next.set(venueId, data.sessionId); return next; });
      }
      // Auto-dismiss after 4s
      setTimeout(() => setCheckinResult(null), 4000);
    } catch (err) {
      // Could show error toast
      console.error("[gps-checkin]", err);
    } finally {
      setCheckinLoading(false);
    }
  }, [user, checkinLoading]);

  const handleEndSession = useCallback(async (venueId: string) => {
    if (!user || endSessionLoading) return;
    setEndSessionLoading(true);
    setEndSessionResult(null);
    try {
      const sessionId = activeSessionMap.get(venueId);
      const res = await fetch("/api/checkin/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { sessionId } : { venueId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "End session failed");
      setActiveSessionMap((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
      setEndSessionResult({ duration: data.duration_minutes || 0, xp: data.xp_earned || 0 });
      setTimeout(() => setEndSessionResult(null), 4000);
    } catch (err) {
      console.error("[end-session]", err);
    } finally {
      setEndSessionLoading(false);
    }
  }, [user, endSessionLoading, activeSessionMap]);

  // ── Navigation helpers ──
  const fetchDirections = useCallback(async (profile: "walking" | "driving") => {
    if (!userLocation || !selectedVenue) return;
    setNavLoading(true);
    setNavProfile(profile);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const coords = `${userLocation.longitude},${userLocation.latitude};${selectedVenue.longitude},${selectedVenue.latitude}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?steps=true&geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) throw new Error("No route found");

      const steps: NavStep[] = route.legs[0].steps.map((s: { maneuver: { instruction: string }; distance: number; duration: number }) => ({
        instruction: s.maneuver.instruction,
        distance: s.distance,
        duration: s.duration,
      }));

      setNavInfo({
        steps,
        distance: route.distance,
        duration: route.duration,
        profile,
      });

      // Draw route on map
      const color = selectedVenue ? (selectedVenue.themeColor || "#F97316") : ACCENT;
      onRouteChange?.({
        geometry: route.geometry,
        color,
      });

      // Fit map to route bounds
      const coords2 = route.geometry.coordinates as [number, number][];
      const lngs = coords2.map((c) => c[0]);
      const lats = coords2.map((c) => c[1]);
      parentMapRef?.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 100, bottom: 350, left: 60, right: 60 }, duration: 1000 }
      );
    } catch {
      setNavInfo(null);
    } finally {
      setNavLoading(false);
    }
  }, [userLocation, selectedVenue, onRouteChange, parentMapRef]);

  const clearNav = useCallback(() => {
    setNavInfo(null);
    onRouteChange?.(null);
  }, [onRouteChange]);

  const openInMaps = useCallback(() => {
    if (!selectedVenue) return;
    const { latitude, longitude } = selectedVenue;
    const label = encodeURIComponent(selectedVenue.name);
    const mode = navProfile === "walking" ? "w" : "d";
    // iOS/macOS
    const appleUrl = `maps://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=${mode}&q=${label}`;
    // Google Maps fallback
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${navProfile}`;
    // Try Apple Maps first (works on iOS/macOS), fall back to Google
    const w = window.open(appleUrl, "_blank");
    if (!w || w.closed) window.open(googleUrl, "_blank");
  }, [selectedVenue, navProfile]);

  // Clear route when venue deselected
  useEffect(() => {
    if (!selectedVenue) clearNav();
  }, [selectedVenue, clearNav]);

  // ── Smart quick replies ──
  const getVenueReplies = useCallback((): { label: string; action: string }[] => {
    if (!selectedVenue) return [];
    const offerings = venueOfferings[selectedVenue.id] || [];
    const cart = carts.get(selectedVenue.id) || [];
    const msgCount = currentVenueMessages.length;

    // After checkout (last AI message mentions "confirmed" or "all set")
    const lastAi = [...currentVenueMessages].reverse().find((m) => m.sender === "ai");
    if (lastAi && (/confirmed|all set|order.*placed/i.test(lastAi.body))) {
      const replies = [
        { label: "Anything else?", action: "anything else?" },
        { label: "What's happening later?", action: "what's happening later?" },
      ];
      if (user) replies.unshift({ label: "Add to Wallet", action: "__WALLET_PASS__" });
      return replies;
    }

    // Cart has items
    if (cart.length > 0) {
      return [
        { label: `Checkout (${cart.reduce((s, i) => s + i.quantity, 0)} items)`, action: "__CHECKOUT__" },
        { label: "Add more", action: "what else do you have?" },
        { label: "Clear cart", action: "__CLEAR_CART__" },
      ];
    }

    // After offerings shown — suggest specific items
    const offersShown = currentVenueMessages.some((m) => m.sender === "ai" && m.body.includes("[[OFFER:"));
    if (offersShown && offerings.length > 0) {
      const products = offerings.filter((o) => o.type === "product" || o.type === "service");
      const replies: { label: string; action: string }[] = products.slice(0, 2).map((o) => ({
        label: `Order the ${o.name}`,
        action: `I'd like to order the ${o.name}`,
      }));
      replies.push({ label: "What's popular?", action: "what's popular here?" });
      return replies;
    }

    // Fresh conversation — built from venue's offerings
    if (msgCount <= 2) {
      const types = new Set(offerings.map((o) => o.type));
      const replies: { label: string; action: string }[] = [];
      if (types.has("product") || types.has("service")) {
        const hasFood = offerings.some((o) => o.type === "product");
        const hasService = offerings.some((o) => o.type === "service");
        if (hasFood) replies.push({ label: "See the menu", action: "show me the menu" });
        if (hasService) {
          const svc = offerings.find((o) => o.type === "service");
          replies.push({ label: `Book a ${svc?.name || "service"}`, action: `I'd like to book a ${svc?.name || "service"}` });
        }
      }
      if (types.has("event")) replies.push({ label: "What's happening tonight?", action: "any events tonight?" });
      if (types.has("membership")) replies.push({ label: "Tell me about membership", action: "tell me about membership" });
      if (types.has("reservation")) replies.push({ label: "Reserve a spot", action: "I'd like to reserve a spot" });
      replies.push({ label: "Tell me more", action: "tell me more about this place" });
      return replies.slice(0, 4);
    }

    return [];
  }, [selectedVenue, venueOfferings, carts, currentVenueMessages]);

  // ── Animate height/radius/background on mode + snap changes ──
  useEffect(() => {
    controls.start({
      height: getDockHeight(mode, exploreSnap, venueChatSnap),
      borderRadius: getDockRadius(mode, exploreSnap, venueChatSnap),
      backgroundColor: getDockBg(mode, exploreSnap, venueChatSnap),
      transition: { type: "spring", damping: 30, stiffness: 300 },
    });
  }, [mode, exploreSnap, venueChatSnap, controls]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conciergeMessages, venueThreads, selectedVenue]);

  // ── Keyboard resize handler ──
  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // ── Keyboard shortcuts (desktop only) ──
  useEffect(() => {
    if (!isDesktop) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // ── Always-active shortcuts ──

      // ? — toggle shortcuts panel
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+K — focus input
      if (e.key === "k" && mod) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Escape — back / collapse / close shortcuts
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (inInput) { (target as HTMLInputElement).blur(); return; }
        e.preventDefault();
        if (mode === "profile") { setMode(previousMode); return; }
        if (mode === "threads") { setMode(previousMode === "threads" ? "idle" : previousMode); return; }
        if (mode === "concierge") { setMode("idle"); return; }
        if (mode === "venueChat") {
          if (venueChatSnap === "full") { setVenueChatSnap("expanded"); return; }
          if (venueChatSnap === "expanded") { setVenueChatSnap("collapsed"); return; }
          onVenueSelect(null); return;
        }
        if (mode === "explore") {
          if (exploreSnap === "full") { setExploreSnap("half"); return; }
          if (exploreSnap === "half") { setExploreSnap("peek"); return; }
          setMode("idle"); return;
        }
        return;
      }

      // Cmd/Ctrl+ArrowUp — snap dock up
      if (e.key === "ArrowUp" && mod) {
        e.preventDefault();
        if (mode === "idle") { setMode("explore"); setExploreSnap("half"); }
        else if (mode === "explore") {
          if (exploreSnap === "peek") setExploreSnap("half");
          else if (exploreSnap === "half") setExploreSnap("full");
        }
        else if (mode === "venueChat") {
          if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");
          else if (venueChatSnap === "expanded") setVenueChatSnap("full");
        }
        return;
      }

      // Cmd/Ctrl+ArrowDown — snap dock down
      if (e.key === "ArrowDown" && mod) {
        e.preventDefault();
        if (mode === "explore") {
          if (exploreSnap === "full") setExploreSnap("half");
          else if (exploreSnap === "half") setExploreSnap("peek");
          else setMode("idle");
        }
        else if (mode === "concierge") setMode("idle");
        else if (mode === "venueChat") {
          if (venueChatSnap === "full") setVenueChatSnap("expanded");
          else if (venueChatSnap === "expanded") setVenueChatSnap("collapsed");
        }
        return;
      }

      // ── Skip single-key shortcuts when typing ──
      if (inInput) return;

      // Arrow left/right — navigate venues
      if (e.key === "ArrowLeft") { e.preventDefault(); onNavigateVenue(-1); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNavigateVenue(1); return; }

      // Enter — open venue chat if venue selected (logged in only)
      if (e.key === "Enter" && selectedVenue && mode !== "venueChat" && user) {
        e.preventDefault();
        setMode("venueChat");
        setVenueChatSnap("expanded");
        return;
      }

      // E — toggle explore
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (mode === "explore") { setMode("idle"); }
        else { setMode("explore"); setExploreSnap("half"); }
        return;
      }

      // C — concierge (logged in only)
      if ((e.key === "c" || e.key === "C") && user) {
        e.preventDefault();
        if (mode === "concierge") setMode("idle");
        else setMode("concierge");
        return;
      }

      // P — profile (logged in only)
      if ((e.key === "p" || e.key === "P") && user) {
        e.preventDefault();
        if (mode === "profile") { setMode(previousMode); }
        else { setPreviousMode(mode); setMode("profile"); }
        return;
      }

      // L — recenter location
      if ((e.key === "l" || e.key === "L") && hasLocation) {
        e.preventDefault();
        onRecenter();
        return;
      }

      // 1-8 — venue tabs (only in venueChat)
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8 && mode === "venueChat" && selectedVenue) {
        const tab = TABS[num - 1];
        if (tab) {
          e.preventDefault();
          handleTabTapRef.current(tab.id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, mode, previousMode, exploreSnap, venueChatSnap, selectedVenue, hasLocation, showShortcuts, onNavigateVenue, onRecenter, onVenueSelect]);

  // ── Load thread history from API ──
  const loadThreadHistory = useCallback(async (venueId: string | null) => {
    try {
      const url = venueId ? `/api/threads?venueId=${venueId}` : "/api/threads?master=true";
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.messages?.length) return null;

      return data.messages.map((m: { id: string; sender_type: string; body: string; created_at: string }) => ({
        id: m.id,
        sender: m.sender_type as "guest" | "ai",
        body: m.body,
        timestamp: new Date(m.created_at).getTime(),
      })) as Message[];
    } catch {
      return null;
    }
  }, []);

  // ── Load all offerings + digital assets for explore mode ──
  useEffect(() => {
    if (mode !== "explore" || exploreOfferingsLoaded.current) return;
    exploreOfferingsLoaded.current = true;

    const claimed = venues.filter((v) => v.claimed !== false).slice(0, 15);
    // Fetch offerings
    Promise.all(
      claimed.map((v) =>
        fetch(`/api/offerings?venueId=${v.id}`)
          .then((r) => r.ok ? r.json() : { offerings: [] })
          .then((d) => (d.offerings || []).map((o: { id: string; name: string; type: string; price_cents: number; description: string | null; image_url?: string | null; category?: string | null }) => ({
            ...o, venue_id: v.id, image_url: o.image_url || null, category: o.category || null,
          })))
          .catch(() => [])
      )
    ).then((results) => {
      setExploreOfferings(results.flat());
    });
    // Fetch digital assets
    Promise.all(
      claimed.map((v) =>
        fetch(`/api/digital-assets?venueId=${v.id}`)
          .then((r) => r.ok ? r.json() : { assets: [] })
          .then((d) => (d.assets || []).map((a: { id: string; name: string; asset_type: string; category: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }) => ({
            ...a, venue_id: v.id,
          })))
          .catch(() => [])
      )
    ).then((results) => {
      setExploreDigitalAssets(results.flat());
    });
  }, [mode, venues]);

  // ── Load concierge history on first open ──
  // Concierge always starts fresh — old threads available in Threads mode
  useEffect(() => {
    if (mode !== "concierge") return;
    conciergeHistoryLoaded.current = true;
  }, [mode]);

  // ── Sync selectedVenue prop → mode ──
  useEffect(() => {
    if (selectedVenue) {
      if (!user) {
        // Not logged in — show venue profile only, no chat
        setMode("venueChat");
        setVenueChatSnap("expanded");
        setShowVenueContact(true);
        return;
      }
      setMode("venueChat");
      setVenueChatSnap("collapsed");
      setActiveTab("chat");

      // Always start fresh — old threads are in the Threads tab
      const isGhost = selectedVenue.claimed === false;
      const welcomeBody = isGhost
        ? `Hey — I know a bit about ${selectedVenue.name} from public info. ${selectedVenue.category ? `It's a ${selectedVenue.category}` : ""}${selectedVenue.neighborhood ? ` in ${selectedVenue.neighborhood}` : ""}. Ask me what you want to know.`
        : `Welcome to ${selectedVenue.name}. Ask me anything.`;
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [{
          id: `welcome-${Date.now()}`,
          sender: "ai",
          body: welcomeBody,
          timestamp: Date.now(),
        }]);
        return next;
      });

      const vid = selectedVenue.isEventPin && selectedVenue.parentVenueId ? selectedVenue.parentVenueId : selectedVenue.id;

      // Fetch offerings for quick replies (if not cached)
      if (!venueOfferings[vid]) {
        fetch(`/api/offerings?venueId=${vid}`)
          .then((r) => r.ok ? r.json() : { offerings: [] })
          .then((d) => {
            if (d.offerings?.length) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setVenueOfferings((prev) => ({ ...prev, [vid]: d.offerings.map((o: any) => ({ id: o.id, type: o.type, name: o.name, description: o.description, price_cents: o.price_cents, recurring: o.recurring, interval: o.interval, duration_minutes: o.duration_minutes, category: o.category, perks: o.perks || [] })) }));
            }
          })
          .catch(() => { });
      }

      // Auto-send pending prompt from explore/concierge tap
      if (pendingPromptRef.current) {
        const prompt = pendingPromptRef.current;
        pendingPromptRef.current = null;
        // Use requestAnimationFrame + timeout to ensure mode state has flushed before send
        requestAnimationFrame(() => {
          setTimeout(() => sendRef.current?.(prompt), 300);
        });
      }
    } else {
      if (mode === "venueChat") {
        setMode("explore");
        setExploreSnap("half");
      }
    }
    setShowVenueContact(false);
    setVenueViewMode("chat");
  }, [selectedVenue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load user profile ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser?.email) return;
      try {
        const res = await fetch("/api/points");
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        setUser({
          authId: authUser.id,
          email: authUser.email,
          kickbackScore: data.balance?.kickback_score || data.balance?.total_earned || 0,
          totalEarned: data.balance?.total_earned || 0,
          tier: data.balance?.tier || "explorer",
          streak: data.balance?.current_streak || 0,
          venueProfiles: data.venueProfiles || [],
        });
        setBalance(data.balance?.balance || 0);

        // Fetch memberships
        try {
          const mRes = await fetch("/api/points?memberships=true");
          if (mRes.ok) {
            const mData = await mRes.json();
            if (mData.memberships) setMemberships(mData.memberships);
          }
        } catch { /* skip */ }

        const allPerks: Perk[] = [];
        for (const v of venues.filter((v) => v.claimed !== false).slice(0, 10)) {
          try {
            const pRes = await fetch(`/api/points?venueId=${v.id}`);
            const pData = await pRes.json();
            if (pData.perks) allPerks.push(...pData.perks);
          } catch { /* skip */ }
        }
        setPerks(allPerks);

        // Fetch collectibles
        try {
          const cRes = await fetch("/api/my-collectibles");
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.collectibles) setMyCollectibles(cData.collectibles);
          }
        } catch { /* skip */ }

        // Fetch referral keys
        try {
          const rkRes = await fetch("/api/referral-keys");
          if (rkRes.ok) {
            const rkData = await rkRes.json();
            if (rkData.keys) setReferralKeys(rkData.keys);
          }
        } catch { /* skip */ }
      } catch {
        setUser({
          authId: authUser.id,
          email: authUser.email,
          kickbackScore: 0, totalEarned: 0, tier: "explorer", streak: 0, venueProfiles: [],
        });
      }
    });
  }, [venues]);

  // ─── Tag generation ────────────────────────────────────────────

  const tags = useMemo(() => {
    const result: Tag[] = [];
    const seen = new Set<string>();

    const catGroups = new Map<string, string[]>();
    for (const v of venues) {
      const cat = v.category?.toLowerCase();
      if (!cat || cat === "venue" || cat === "other") continue;
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(v.id);
    }
    for (const [cat, ids] of catGroups) {
      if (ids.length === 0) continue;
      const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ id: `cat-${cat}`, label, type: "category", color: "#a78bfa", venueIds: ids });
    }

    // Vibe filter tags removed from UI

    const hoodGroups = new Map<string, string[]>();
    for (const v of venues) {
      const hood = v.neighborhood?.trim();
      if (!hood) continue;
      if (!hoodGroups.has(hood)) hoodGroups.set(hood, []);
      hoodGroups.get(hood)!.push(v.id);
    }
    for (const [hood, ids] of hoodGroups) {
      if (ids.length < 1 || seen.has(hood)) continue;
      seen.add(hood);
      result.push({ id: `hood-${hood}`, label: hood, type: "neighborhood", color: "#60a5fa", venueIds: ids });
    }

    for (const v of venues) {
      if (v.claimed === false) continue;
      result.push({ id: `venue-${v.id}`, label: v.name, type: "venue", color: v.themeColor || "#F97316", venueIds: [v.id] });
    }

    return result;
  }, [venues]);

  // ─── Shelf memos ───────────────────────────────────────────────

  const claimedVenues = useMemo(() => venues.filter((v) => v.claimed !== false), [venues]);

  const happeningNow = useMemo(
    () => [...claimedVenues].sort((a, b) => (VIBE_ORDER[b.vibe] || 0) - (VIBE_ORDER[a.vibe] || 0)).slice(0, 10),
    [claimedVenues]
  );

  const quietSpots = useMemo(
    () => claimedVenues.filter((v) => v.vibe === "quiet" || v.vibe === "moderate"),
    [claimedVenues]
  );

  const nearYou = useMemo(() => {
    if (!userLocation) return [];
    return [...venues]
      .map((v) => ({ venue: v, dist: getDistance(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
  }, [venues, userLocation]);

  const yourSpots = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    return user.venueProfiles
      .map((vp) => {
        const venue = venues.find((v) => v.id === vp.venue_id);
        return venue ? { venue, xp: vp.xp } : null;
      })
      .filter(Boolean) as { venue: Venue; xp: number }[];
  }, [venues, user]);

  const recommended = useMemo(() => {
    if (!user?.venueProfiles.length) return [];
    const visitedVenueIds = new Set(user.venueProfiles.map((vp) => vp.venue_id));
    const visitedCategories = new Set(
      user.venueProfiles.map((vp) => venues.find((v) => v.id === vp.venue_id)?.category).filter(Boolean)
    );
    return claimedVenues.filter((v) => !visitedVenueIds.has(v.id) && visitedCategories.has(v.category)).slice(0, 10);
  }, [claimedVenues, venues, user]);

  const affordablePerks = useMemo(
    () => perks.sort((a, b) => a.point_cost - b.point_cost),
    [perks]
  );

  const venueNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of venues) m.set(v.id, v.name);
    return m;
  }, [venues]);

  // ─── Send message ──────────────────────────────────────────────

  const sendRef = useRef<((text?: string) => void) | null>(null);

  const send = useCallback(async (text?: string) => {
    if (!user) return; // Must be logged in to chat
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `user-${Date.now()}`, sender: "guest", body: msg, timestamp: Date.now() };

    if (mode === "venueChat" && selectedVenue) {
      // Venue chat
      if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");

      // ── Cart special actions ──
      if (msg === "__CHECKOUT__") {
        setInput("");
        // Build checkout from cart — filter out bookable items without date/time
        const rawCart = carts.get(selectedVenue.id) || [];
        const venueOffers = offeringsMap[selectedVenue.id] || {};
        const cart = rawCart.filter((item) => {
          const m = venueOffers[item.offeringId];
          const isBookable = m.type === "reservation" || (m?.duration_minutes && ["service", "event"].includes(m.type));
          const hasMeta = (item as unknown as { metadata?: Record<string, unknown> }).metadata?.date;
          if (isBookable && !hasMeta) {
            // Open the drawer for this item instead
            setDrawerOfferId(item.offeringId);
            return false;
          }
          return true;
        });
        if (cart.length === 0) return;
        const checkoutData: CheckoutCardData = {
          venue_name: selectedVenue.name,
          venue_id: selectedVenue.id,
          items: cart.map((item) => ({
            offering_id: item.offeringId,
            slot_id: null,
            name: item.name,
            quantity: item.quantity,
            unit_price_cents: item.priceCents,
            metadata: (item as unknown as { metadata?: Record<string, unknown> }).metadata || {},
          })),
        };
        const checkoutMsg: Message = {
          id: `checkout-${Date.now()}`, sender: "ai",
          body: "Here's your order — review and confirm when ready.",
          timestamp: Date.now(), checkout: checkoutData,
        };
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), checkoutMsg]);
          return next;
        });
        setCartExpanded(false);
        return;
      }
      if (msg === "__WALLET_PASS__") {
        setInput("");
        if (user) window.open(`https://thekickback.net/wallet/pass/${user.authId}`, "_blank");
        return;
      }
      if (msg === "__CLEAR_CART__") {
        setInput("");
        clearCart(selectedVenue.id);
        const clearMsg: Message = { id: `clear-${Date.now()}`, sender: "ai", body: "Cart cleared. What else can I help with?", timestamp: Date.now() };
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), clearMsg]);
          return next;
        });
        return;
      }

      if (msg.toLowerCase() === "sign out" || msg.toLowerCase() === "signout") {
        const supabase = createClient();
        await supabase.auth.signOut();
        setVenueThreads((prev) => {
          const next = new Map(prev);
          const thread = [...(next.get(selectedVenue.id) || []), userMsg, { id: `signout-${Date.now()}`, sender: "ai" as const, body: "You've been signed out.", timestamp: Date.now() }];
          next.set(selectedVenue.id, thread);
          return next;
        });
        setInput("");
        return;
      }

      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), userMsg]);
        return next;
      });
      setInput("");
      setLoading(true);

      try {
        const isGhost = selectedVenue.claimed === false;
        const chatUrl = isGhost ? "/api/chat/ghost" : "/api/chat";
        const chatBody = isGhost
          ? { message: msg, venueId: chatVenueId, venueName: selectedVenue.name, category: selectedVenue.category, neighborhood: selectedVenue.neighborhood, description: selectedVenue.description, tags: selectedVenue.tags }
          : { message: msg, venueId: chatVenueId, venueName: selectedVenue.name, vibe: selectedVenue.vibe };

        const res = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatBody),
        });

        const aiMsgId = `ai-${Date.now()}`;
        const contentType = res.headers.get("content-type") || "";
        let fullReply = "";
        let metadata: Record<string, unknown> | null = null;

        if (contentType.includes("text/event-stream") && res.body) {
          // SSE streaming response
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: aiMsgId, sender: "ai" as const, body: "", timestamp: Date.now() }]);
            return next;
          });
          setLoading(false);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

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
                  setVenueThreads((prev) => {
                    const next = new Map(prev);
                    const thread = next.get(selectedVenue.id) || [];
                    next.set(selectedVenue.id, thread.map((m) => m.id === aiMsgId ? { ...m, body: displayText } : m));
                    return next;
                  });
                } else if (event.type === "done") {
                  metadata = event;
                }
              } catch { /* skip */ }
            }
          }
        } else {
          // JSON fallback (non-streaming)
          const data = await res.json();
          fullReply = data.reply || "Couldn't reach the venue right now.";
          metadata = { type: "done", reply: fullReply, offerings: data.offerings, checkout: data.checkout, booking: data.booking };
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: aiMsgId, sender: "ai" as const, body: stripTags(fullReply), timestamp: Date.now() }]);
            return next;
          });
          setLoading(false);
        }

        // Process metadata after stream completes
        if (metadata) {
          const data = metadata as Record<string, unknown>;

          // Show "putting it together" while processing components
          const hasComponents = data.offerings || data.checkout || data.booking;
          if (hasComponents) {
            setVenueThreads((prev) => {
              const next = new Map(prev);
              const thread = next.get(selectedVenue.id) || [];
              next.set(selectedVenue.id, thread.map((m) => m.id === aiMsgId ? { ...m, body: stripTags(fullReply) + "\n\n⏳ Loading details..." } : m));
              return next;
            });
          }

          // Store offerings metadata for rendering inline cards
          if (data.offerings && typeof data.offerings === "object" && Object.keys(data.offerings as object).length > 0) {
            setOfferingsMap((prev) => ({
              ...prev,
              [selectedVenue.id]: { ...(prev[selectedVenue.id] || {}), ...(data.offerings as Record<string, OfferingMeta>) },
            }));
          }

          const cardTab = data.card || (activeTab !== "chat" ? activeTab : undefined);
          let finalBody = (data.reply as string) || fullReply || "Couldn't reach the venue right now. Try again.";

          // Build checkout data
          let checkoutData: CheckoutCardData | undefined;
          if (data.checkout) {
            checkoutData = { ...(data.checkout as CheckoutCardData), venue_name: selectedVenue.name, venue_id: selectedVenue.id };
          }

          // If a booking was confirmed, add to cart with date/time metadata
          const bookingData = data.booking as { booking?: { start?: string; end?: string; message?: string }; staffName?: string; message?: string } | null;
          if (bookingData?.booking) {
            const bk = bookingData.booking;
            const bkStart = bk.start ? new Date(bk.start) : null;
            const dateLabel = bkStart ? bkStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Today";
            const timeLabel = bkStart ? bkStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

            // Find the offering that was booked
            const bookingOfferId = (data.booking as Record<string, unknown>)?.offering_id as string | undefined;
            const bookingOffer = bookingOfferId ? (offeringsMap[selectedVenue.id] || {})[bookingOfferId] : null;

            if (bookingOffer && bookingOfferId) {
              // Auto-add to cart with date/time
              setCarts((prev) => {
                const next = new Map(prev);
                const items = [...(next.get(selectedVenue.id) || [])];
                items.push({
                  offeringId: bookingOfferId,
                  name: bookingOffer.name,
                  priceCents: bookingOffer.price_cents,
                  quantity: 1,
                  metadata: { date: dateLabel, time: timeLabel, staffName: bookingData.staffName || undefined },
                } as typeof items[0] & { metadata: Record<string, unknown> });
                next.set(selectedVenue.id, items);
                return next;
              });
              finalBody += `\n\nAdded to cart: ${bookingOffer.name} — ${dateLabel} ${timeLabel}. Check out when ready.`;
            } else {
              finalBody += `\n\nBooked: ${bookingData.message || bk.message || "Confirmed"} — ${dateLabel} ${timeLabel}`;
            }
          }

          // Update the AI message with cleaned reply and metadata
          setVenueThreads((prev) => {
            const next = new Map(prev);
            const thread = next.get(selectedVenue.id) || [];
            next.set(selectedVenue.id, thread.map((m) => m.id === aiMsgId ? { ...m, body: finalBody, tab: cardTab as Tab | undefined, checkout: checkoutData } : m));
            return next;
          });
        }
      } catch {
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() }]);
          return next;
        });
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    } else {
      // Concierge chat
      if (mode !== "concierge") setMode("concierge");

      setConciergeMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat/general", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            lat: userLocation?.latitude,
            lng: userLocation?.longitude,
            nearbyUnclaimed: venues
              .filter((v) => v.claimed === false && v.latitude !== 0)
              .slice(0, 20)
              .map((v) => ({ name: v.name, category: v.category, neighborhood: v.neighborhood, rating: v.rating, reviewCount: v.reviewCount, address: v.address || v.description })),
          }),
        });

        const aiMsgId = `ai-${Date.now()}`;
        const contentType = res.headers.get("content-type") || "";
        let fullReply = "";
        let metadata: Record<string, unknown> | null = null;

        if (contentType.includes("text/event-stream") && res.body) {
          // SSE streaming
          setConciergeMessages((prev) => [...prev, { id: aiMsgId, sender: "ai" as const, body: "", timestamp: Date.now() }]);
          setLoading(false);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

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
                  setConciergeMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, body: displayText } : m));
                } else if (event.type === "done") {
                  metadata = event;
                }
              } catch { /* skip */ }
            }
          }
        } else {
          // JSON fallback
          const data = await res.json();
          fullReply = data.reply || "Something went wrong.";
          metadata = { type: "done", reply: fullReply, venues: data.venues };
          setConciergeMessages((prev) => [...prev, { id: aiMsgId, sender: "ai" as const, body: stripTags(fullReply), timestamp: Date.now() }]);
          setLoading(false);
        }

        // Process metadata after stream completes
        if (metadata) {
          const data = metadata as Record<string, unknown>;
          const venuesList = data.venues as ApiVenue[] | undefined;

          // Show "putting it together" while loading venue cards
          if (venuesList?.length || data.offerings) {
            setConciergeMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, body: stripTags(fullReply) + "\n\n⏳ Finding places..." } : m));
          }

          // Store offerings from concierge response
          if (data.offerings && typeof data.offerings === "object") {
            const offerMap = data.offerings as Record<string, OfferingMeta>;
            // Group by venue (offerings have venue_id in the concierge response)
            for (const [oid, ometa] of Object.entries(offerMap)) {
              const venueId = (ometa as unknown as Record<string, unknown>).venue_id as string | undefined;
              if (venueId) {
                setOfferingsMap((prev) => ({
                  ...prev,
                  [venueId]: { ...(prev[venueId] || {}), [oid]: ometa },
                }));
              }
            }
          }

          if (venuesList?.length) {
            setApiVenues((prev) => {
              const next = { ...prev };
              for (const v of venuesList) next[v.id] = v;
              return next;
            });
            setRichVenues((prev) => {
              const next = { ...prev };
              for (const v of venuesList) next[v.id] = v as unknown as RichVenue;
              return next;
            });
          }

          // Update with cleaned reply
          // Use reply WITH tags — parseVenueChips renders [[VENUE_CARD:...]] and [[OFFER:...]] as components
          const finalReply = (data.reply as string) || fullReply || "Something went wrong. Try again in a moment.";
          setConciergeMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, body: finalReply } : m));
        }
      } catch {
        setConciergeMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, sender: "ai", body: "Something went wrong. Try again in a moment.", timestamp: Date.now() },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
  }, [input, loading, mode, selectedVenue, venueChatSnap, activeTab, carts, clearCart]);

  // Keep sendRef in sync so deferred callers always use the latest closure
  sendRef.current = send;

  // ─── Tab tap ───────────────────────────────────────────────────

  const handleTabTap = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (!selectedVenue) return;

    const cmd = TAB_COMMANDS[tab];
    if (!cmd) return;

    const venueId = selectedVenue.id;
    const sentForVenue = hasSentTabCommands.get(venueId) || new Set<Tab>();
    if (sentForVenue.has(tab)) return;

    setHasSentTabCommands((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(venueId) || []);
      s.add(tab);
      next.set(venueId, s);
      return next;
    });
    send(cmd);
  }, [selectedVenue, hasSentTabCommands, send]);

  // Keep ref in sync
  handleTabTapRef.current = handleTabTap;

  // ─── Drag handling ─────────────────────────────────────────────

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info;
    const draggingDown = offset.y > 60 || velocity.y > 300;
    const draggingUp = offset.y < -60 || velocity.y < -300;

    if (mode === "idle") {
      if (draggingUp) { setMode("explore"); setExploreSnap("half"); }
    } else if (mode === "explore") {
      if (draggingDown) {
        if (exploreSnap === "full") setExploreSnap("half");
        else if (exploreSnap === "half") setExploreSnap("peek");
        else setMode("idle");
      } else if (draggingUp) {
        if (exploreSnap === "peek") setExploreSnap("half");
        else if (exploreSnap === "half") setExploreSnap("full");
      }
    } else if (mode === "concierge") {
      if (draggingDown) setMode("idle");
    } else if (mode === "venueChat") {
      if (draggingDown) {
        if (venueChatSnap === "full") setVenueChatSnap("expanded");
        else if (venueChatSnap === "expanded") setVenueChatSnap("collapsed");
        // Don't dismiss on drag from collapsed — keep venue selected
      } else if (draggingUp) {
        if (venueChatSnap === "collapsed") setVenueChatSnap("expanded");
        else if (venueChatSnap === "expanded") setVenueChatSnap("full");
      }
    } else if (mode === "profile") {
      if (draggingDown) setMode(previousMode);
    }
  }

  // ─── Input focus handler ───────────────────────────────────────

  const handleInputFocus = useCallback(() => {
    if (!user) return; // Must be logged in for chat
    if (mode === "idle" || mode === "explore") {
      if (selectedVenue) {
        setMode("venueChat");
        setVenueChatSnap("expanded");
      } else {
        setMode("concierge");
      }
    } else if (mode === "venueChat" && venueChatSnap === "collapsed") {
      setVenueChatSnap("expanded");
    }
  }, [mode, selectedVenue, venueChatSnap, user]);

  // ─── Concierge venue card tap ──────────────────────────────────

  const handleConciergeVenueTap = useCallback((venue: Venue, prompt?: string) => {
    if (prompt) pendingPromptRef.current = prompt;
    onVenueSelect(venue);
  }, [onVenueSelect]);

  // ─── Explore venue card tap ────────────────────────────────────

  const pendingPromptRef = useRef<string | null>(null);

  const handleExploreVenueTap = useCallback((venue: Venue, autoPrompt?: string) => {
    if (autoPrompt) pendingPromptRef.current = autoPrompt;
    onVenueSelect(venue);
  }, [onVenueSelect]);

  // ─── KB back (venueChat → explore) ─────────────────────────────

  const handleKBBack = useCallback(() => {
    onVenueSelect(null);
  }, [onVenueSelect]);

  // ─── Profile ───────────────────────────────────────────────────

  const handleAvatarTap = useCallback(() => {
    if (!user) {
      // Not logged in — open explore with login form
      setMode("explore");
      setExploreSnap("half");
      return;
    }
    setPreviousMode(mode);
    setMode("profile");
  }, [mode, user]);

  const handleProfileBack = useCallback(() => {
    setMode(previousMode);
  }, [previousMode]);

  // ─── Computed ──────────────────────────────────────────────────

  const tierColor = TIER_CONFIG[user?.tier || "explorer"]?.color || "#94a3b8";
  // For event pins, use the parent venue ID for chat/offerings so the AI agent is the place's agent
  const chatVenueId = selectedVenue?.isEventPin && selectedVenue.parentVenueId ? selectedVenue.parentVenueId : selectedVenue?.id;
  const vibeColor = selectedVenue ? (selectedVenue.themeColor || "#F97316") : ACCENT;
  const sendColor = mode === "venueChat" ? vibeColor : ACCENT;
  const venueChatExpanded = venueChatSnap !== "collapsed";
  const showExpandedContent = mode === "explore" || mode === "concierge" || mode === "profile" || mode === "threads" || (mode === "venueChat" && venueChatExpanded);
  const isCollapsedPill = mode === "idle" || (mode === "venueChat" && !venueChatExpanded);

  // ─── Checkout handler for venue chat ──
  const processPayment = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card"
  ) => {
    if (!selectedVenue || !msg.checkout) return;
    if (paymentMode === "processing") return; // Prevent double-tap
    setPaymentMode("processing");

    const itemsTotal = msg.checkout.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price_cents, 0);
    const subtotal = itemsTotal + addOnsTotal - pointsToSpend;

    try {
      // Step 1: Create the order FIRST (no money moves yet)
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: selectedVenue.id,
          items: msg.checkout.items,
          addOns,
          pointsToSpend,
          notes: msg.checkout.notes,
          paymentMethod: method,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Order failed: HTTP ${res.status}`);

      // Step 2: ONLY deduct wallet AFTER order is confirmed
      if (method === "wallet") {
        const spendRes = await fetch("/api/wallet/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: subtotal,
            venueId: selectedVenue.id,
            orderId: result.orderId,
            description: `Order at ${selectedVenue.name}`,
          }),
        });
        const spendResult = await spendRes.json();
        if (!spendRes.ok) {
          // Order exists but payment failed — mark order as payment_failed
          // Don't throw — show specific wallet error
          setVenueThreads((prev) => {
            const next = new Map(prev);
            next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), {
              id: `wallet-err-${Date.now()}`, sender: "ai",
              body: `Order created but payment failed: ${spendResult.error || "Wallet error"}. Your balance was not charged.`,
              timestamp: Date.now(),
            }]);
            return next;
          });
          setPaymentMode(null);
          return;
        }
      }
      const walletPassNote = result.orderId && user ? `\n\nAdd your pass to Apple Wallet: https://thekickback.net/wallet/pass/${user.authId}` : "";
      // Build item summary for confirmation
      const itemNames = msg.checkout.items.map((i: { name: string; quantity?: number }) => i.quantity && i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name).join(", ");
      const bonusPts = Math.floor(subtotal / 10);
      const confirmMsg: Message = result.orderId
        ? { id: `order-${Date.now()}`, sender: "ai", body: `You're all set! Order confirmed: ${itemNames}. Total: $${(subtotal / 100).toFixed(2)}.${method === "wallet" ? " Paid from KB Wallet." : " Charged to card on file."}${pointsToSpend > 0 ? ` Used ${pointsToSpend} points.` : ""}${bonusPts > 0 ? ` +${bonusPts} XP earned!` : ""} Show this to the host when you arrive.${walletPassNote}`, timestamp: Date.now() }
        : { id: `err-${Date.now()}`, sender: "ai", body: result.error || "Something went wrong with the order.", timestamp: Date.now() };
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), confirmMsg]);
        return next;
      });
      if (result.orderId) {
        clearCart(selectedVenue.id);
        // Refresh wallet balance + XP immediately
        walletStatus?.refresh?.();
        // Re-fetch user points/XP
        fetch("/api/points").then((r) => r.ok ? r.json() : null).then((data) => {
          if (data?.balance && user) {
            setUser({
              ...user,
              kickbackScore: data.balance.kickback_score || data.balance.total_earned || user.kickbackScore,
              totalEarned: data.balance.total_earned || user.totalEarned,
              tier: data.balance.tier || user.tier,
              streak: data.balance.current_streak || user.streak,
              venueProfiles: data.venueProfiles || user.venueProfiles,
            });
          }
        }).catch(() => { });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("Payment error:", errMsg);
      setVenueThreads((prev) => {
        const next = new Map(prev);
        next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `err-${Date.now()}`, sender: "ai", body: `Payment failed: ${errMsg}`, timestamp: Date.now() }]);
        return next;
      });
    } finally {
      setPaymentMode(null);
    }
  }, [selectedVenue, clearCart, walletStatus, user]);

  const handleCheckoutConfirm = useCallback(async (
    msg: Message, addOns: CheckoutAddOn[], pointsToSpend: number, method: "wallet" | "card" = "card"
  ) => {
    if (!selectedVenue) return;
    if (!msg.checkout) return;

    // Passkey verification for wallet — BLOCKS payment if it fails
    if (method === "wallet" && passkey.hasPasskey) {
      const verified = await passkey.verify();
      if (!verified) {
        setVenueThreads((prev) => {
          const next = new Map(prev);
          next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), {
            id: `bio-fail-${Date.now()}`, sender: "ai",
            body: "Biometric verification failed. Payment cancelled. Try again or use Card instead.",
            timestamp: Date.now(),
          }]);
          return next;
        });
        return; // DO NOT proceed with payment
      }
    }

    await processPayment(msg, addOns, pointsToSpend, method);
  }, [selectedVenue, passkey, processPayment]);

  const handleCheckoutDismiss = useCallback(() => {
    if (!selectedVenue) return;
    setVenueThreads((prev) => {
      const next = new Map(prev);
      next.set(selectedVenue.id, [...(next.get(selectedVenue.id) || []), { id: `cancel-${Date.now()}`, sender: "ai", body: "No worries — let me know if you change your mind.", timestamp: Date.now() }]);
      return next;
    });
  }, [selectedVenue]);

  // ═══════════════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════

  const isVirtualSelected = selectedVenue && (selectedVenue.latitude === 0 && selectedVenue.longitude === 0);
  const virtualColor = isVirtualSelected ? (selectedVenue.themeColor || "#F97316") : null;

  return (
    <>
      {/* Virtual place ambient overlay — blurs the map and shows theme gradient */}
      <AnimatePresence>
        {isVirtualSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[8]"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${virtualColor}35 0%, transparent 60%), linear-gradient(to bottom, ${virtualColor}18 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.95) 100%)`,
              backdropFilter: "blur(20px) saturate(0.5)",
              WebkitBackdropFilter: "blur(20px) saturate(0.5)",
            }}
          />
        )}
      </AnimatePresence>
      {/* ─── Desktop Keyboard Shortcuts Button + Panel ─── */}
      {isDesktop && (
        <>
          {/* ? toggle button — fixed top-right */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => setShowShortcuts((prev) => !prev)}
            className="fixed right-4 top-[max(16px,env(safe-area-inset-top))] z-[60] flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.08]"
            style={{
              backgroundColor: showShortcuts ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showShortcuts ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
            title="Keyboard shortcuts (?)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showShortcuts ? "#a78bfa" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
            </svg>
          </motion.button>

          {/* Onboarding toast — shows once for new desktop users */}
          <AnimatePresence>
            {showOnboarding && !showShortcuts && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed right-4 top-[max(52px,calc(env(safe-area-inset-top)+52px))] z-[60] flex items-start gap-3  px-4 py-3"
                style={{
                  background: "rgba(12, 12, 14, 0.95)",
                  backdropFilter: "blur(40px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                  boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 8px 30px rgba(0,0,0,0.4)",
                  maxWidth: 320,
                }}
              >
                {/* Keyboard icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center " style={{ backgroundColor: "rgba(167,139,250,0.1)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h8" />
                  </svg>
                </div>

                <div className="flex-1">
                  <p className="font-sans text-[13px] font-semibold text-white/90">Keyboard shortcuts available</p>
                  <p className="mt-0.5 font-sans text-[11px] leading-[1.4] text-white/40">
                    Press <Kbd>?</Kbd> anytime to see all shortcuts. Try <Kbd>{isMac ? "\u2318" : "Ctrl"}</Kbd><span className="mx-0.5 text-[9px] text-white/15">+</span><Kbd>K</Kbd> to search, <Kbd>E</Kbd> to explore, or <Kbd>\u2190</Kbd> <Kbd>\u2192</Kbd> to browse venues.
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => { dismissOnboarding(); setShowShortcuts(true); }}
                      className="px-3 py-1 font-sans text-[11px] font-semibold text-black active:scale-95"
                      style={{ backgroundColor: "#a78bfa" }}
                    >
                      View all shortcuts
                    </button>
                    <button
                      onClick={dismissOnboarding}
                      className="px-3 py-1 font-sans text-[11px] font-medium text-white/40 active:scale-95"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Got it
                    </button>
                  </div>
                </div>

                {/* Close X */}
                <button onClick={dismissOnboarding} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-white/[0.08]">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-30">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shortcuts overlay */}
          <AnimatePresence>
            {showShortcuts && (
              <KeyboardShortcutsPanel isMac={isMac} mode={mode} onClose={() => setShowShortcuts(false)} />
            )}
          </AnimatePresence>
        </>
      )}

      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: 0 }}
      >
        {/* ── GPS check-in success toast ── */}
        <AnimatePresence>
          {checkinResult && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-2 left-4 right-4 z-30 flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.25)", backdropFilter: "blur(12px)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <div>
                <p className="font-sans text-[13px] font-semibold text-green-400">Checked in!</p>
                <p className="font-sans text-[11px] text-white/40">+{checkinResult.xp} XP · {checkinResult.distance}m away</p>
              </div>
            </motion.div>
          )}
          {endSessionResult && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-2 left-4 right-4 z-30 flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)", backdropFilter: "blur(12px)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <div>
                <p className="font-sans text-[13px] font-semibold text-orange-400">Session ended · {endSessionResult.duration} min</p>
                {endSessionResult.xp > 0 && <p className="font-sans text-[11px] text-white/40">+{endSessionResult.xp} XP</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={controls}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDrag}
          className="relative flex flex-col overflow-hidden"
          style={{
            height: 56,
            backgroundColor: "rgba(12, 12, 14, 0.55)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 -1px 0 rgba(255,255,255,0.06)",
            touchAction: "none",
          }}
        >
          {/* ═══ IDLE MODE ═══ */}
          {mode === "idle" && (
            <div className="flex h-full items-center gap-3 px-4">
              {/* Profile + KB Logo together on the left */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleAvatarTap}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: user ? `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)` : "rgba(255,255,255,0.06)",
                    border: `2px solid ${user ? `${tierColor}40` : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {user ? (
                    <span className="font-sans text-[13px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setMode("explore"); setExploreSnap("half"); }}
                  className="flex items-center"
                >
                  <Image src="/logo.png" alt="theKickBack" width={500} height={250} className="h-6 w-auto" priority />
                </button>
              </div>

              {/* Rotating search suggestions or sign-in prompt */}
              <button
                onClick={() => { setMode("explore"); setExploreSnap("half"); }}
                className="min-w-0 flex-1 text-left"
              >
                {user ? (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={Math.floor(Date.now() / 4000) % IDLE_SUGGESTIONS.length}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="block font-sans text-[14px] text-white/30"
                    >
                      {IDLE_SUGGESTIONS[Math.floor(Date.now() / 4000) % IDLE_SUGGESTIONS.length]}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <span className="font-sans text-[14px] text-white/30">Sign in to explore & chat</span>
                )}
              </button>

              {/* Location — recenter map */}
              {hasLocation && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRecenter(); }}
                  className="flex shrink-0 items-center justify-center h-8 w-8 rounded-full"
                  style={{ backgroundColor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </button>
              )}

              {/* Help / Tutorial */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowTutorial(true); }}
                className="flex shrink-0 items-center justify-center h-8 w-8 rounded-full"
                style={{ backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}
              >
                <span className="font-sans text-[13px] font-bold" style={{ color: "#a78bfa" }}>?</span>
              </button>

              {/* GPS Check-in / End Session — nearby venue */}
              {nearbyVenue && user && (
                activeSessionMap.has(nearbyVenue.venue.id) ? (
                  <button
                    onClick={() => handleEndSession(nearbyVenue.venue.id)}
                    disabled={endSessionLoading}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}
                  >
                    {endSessionLoading ? (
                      <span className="font-sans text-[11px] font-semibold text-orange-400">...</span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        <span className="font-sans text-[11px] font-semibold text-orange-400 whitespace-nowrap">End Session</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleGpsCheckin(nearbyVenue.venue.id)}
                    disabled={checkinLoading}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    {checkinLoading ? (
                      <span className="font-sans text-[11px] font-semibold text-green-400">...</span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span className="font-sans text-[11px] font-semibold text-green-400 whitespace-nowrap">Check in</span>
                      </>
                    )}
                  </button>
                )
              )}

              {/* Threads — opens threads mode */}
              {threadInfo.count > 0 && (
                <button
                  onClick={() => { setPreviousMode(mode); setMode("threads"); }}
                  className="relative flex shrink-0 items-center gap-1.5 px-2.5 py-1.5"
                  style={{ backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-mono text-[11px] font-bold" style={{ color: "#a78bfa" }}>{threadInfo.count}</span>
                  {threadInfo.unread > 0 && <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange" />}
                </button>
              )}

              {/* Profile moved to left next to KB */}
            </div>
          )}

          {/* Idle suggestion rotation timer */}
          {mode === "idle" && <IdleSuggestionRotator />}

          {/* ═══ VENUE CHAT COLLAPSED ═══ */}
          {mode === "venueChat" && !venueChatExpanded && selectedVenue && (
            <div className="flex h-full items-center gap-2 px-3">
              <button onClick={() => { if (user) setVenueChatSnap("expanded"); else { setVenueChatSnap("expanded"); setShowVenueContact(true); } }} className="flex items-center gap-2 pl-1">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full" style={{ border: `1.5px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
                  {selectedVenue.heroImage ? (
                    <img src={selectedVenue.heroImage} alt="" className="h-full w-full object-cover" />
                  ) : selectedVenue.logo ? (
                    <img src={selectedVenue.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-sans text-[10px] font-bold" style={{ color: vibeColor }}>{selectedVenue.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">{selectedVenue.name}</span>
              </button>

              {(() => {
                const venueInRange = userLocation && selectedVenue?.latitude && selectedVenue?.longitude && haversineMeters(userLocation.latitude, userLocation.longitude, selectedVenue.latitude, selectedVenue.longitude) <= 150;
                const hasActiveSession = activeSessionMap.has(selectedVenue.id);
                if (!user || !venueInRange) return null;
                return hasActiveSession ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEndSession(selectedVenue.id); }}
                    disabled={endSessionLoading}
                    className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    <span className="font-sans text-[10px] font-bold text-orange-400">{endSessionLoading ? "..." : "End"}</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGpsCheckin(selectedVenue.id); }}
                    disabled={checkinLoading}
                    className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="font-sans text-[10px] font-bold text-green-400">{checkinLoading ? "..." : "Check In"}</span>
                  </button>
                );
              })()}

              {user ? (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  onFocus={handleInputFocus}
                  placeholder="Ask anything..."
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => { setMode("explore"); setExploreSnap("half"); }}
                  className="min-w-0 flex-1 text-left font-sans text-[13px] text-white/25"
                >
                  Sign in to chat
                </button>
              )}

              <motion.button
                onClick={handleKBBack}
                whileTap={{ scale: 0.9 }}
                className="flex h-8 shrink-0 items-center gap-1.5 px-2.5"
                style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <Image src="/logo.png" alt="KB" width={250} height={125} className="h-3.5 w-auto" />
              </motion.button>
            </div>
          )}

          {/* ═══ EXPLORE MODE ═══ */}
          {mode === "explore" && (
            <>
              {/* Drag handle */}
              <div className="flex shrink-0 justify-center pt-2 pb-1">
                <div className="h-1 w-8" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
              </div>

              {/* KB header strip */}
              <button
                onClick={() => {
                  if (exploreSnap === "peek") setExploreSnap("half");
                  else if (exploreSnap === "half") setExploreSnap("peek");
                  else setExploreSnap("half");
                }}
                className="flex shrink-0 items-center gap-3 px-4 pb-2"
              >
                {/* KB Logo */}
                <Image src="/logo.png" alt="theKickBack" width={500} height={250} className="h-6 w-auto shrink-0" />

                {/* Profile */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleAvatarTap(); }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: user ? `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)` : "rgba(255,255,255,0.06)",
                    border: `2px solid ${user ? `${tierColor}40` : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {user ? (
                    <span className="font-sans text-[16px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>

                {/* Tier badge + XP bar */}
                {user && (
                  <div className="flex flex-1 items-center gap-2">
                    <span className="px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                      {TIER_CONFIG[user.tier]?.label || "Explorer"}
                    </span>
                    <div className="relative h-1.5 max-w-[100px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%`, backgroundColor: tierColor, boxShadow: `0 0 6px ${tierColor}40` }} />
                    </div>
                    <span className="font-mono text-[10px] font-bold" style={{ color: tierColor }}>{user.kickbackScore.toLocaleString()}</span>
                  </div>
                )}

                {/* Streak */}
                {user && user.streak > 0 && (
                  <div className="flex shrink-0 items-center gap-0.5 px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
                    <span className="text-[10px]">&#x1f525;</span>
                    <span className="font-mono text-[10px] font-bold text-orange">{user.streak}</span>
                  </div>
                )}

                {/* Thread count */}
                {threadInfo.count > 0 && (
                  <div className="relative flex shrink-0 items-center gap-0.5 px-2 py-1" style={{ backgroundColor: "rgba(167,139,250,0.08)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="font-mono text-[10px] font-bold text-[#a78bfa]">{threadInfo.count}</span>
                    {threadInfo.unread > 0 && <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange" />}
                  </div>
                )}

                {/* Chevron */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                  <polyline points={exploreSnap === "peek" ? "6 9 12 15 18 9" : "6 15 12 9 18 15"} />
                </svg>
              </button>

              {/* Scrollable content (half + full) */}
              {exploreSnap !== "peek" && !user && (
                <DockLogin onSuccess={() => window.location.reload()} />
              )}
              {exploreSnap !== "peek" && user && (
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto overscroll-contain"
                  style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                >
                  {/* Tag filters */}
                  {tags.length > 0 && (
                    <div className="mb-4">
                      <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                        {activeTag && (
                          <button
                            onClick={() => onTagSelect(null)}
                            className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                            style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            All
                          </button>
                        )}
                        {tags.map((tag) => {
                          const isActive = activeTag?.id === tag.id;
                          return (
                            <button
                              key={tag.id}
                              onClick={() => onTagSelect(isActive ? null : tag)}
                              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                              style={{
                                backgroundColor: isActive ? `${tag.color}20` : "rgba(255,255,255,0.04)",
                                color: isActive ? tag.color : "rgba(255,255,255,0.45)",
                                border: `1px solid ${isActive ? `${tag.color}40` : "rgba(255,255,255,0.06)"}`,
                              }}
                            >
                              {(tag.type === "venue" || tag.type === "vibe") && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />}
                              {tag.label}
                              {tag.venueIds.length > 1 && <span style={{ opacity: 0.5 }}>{tag.venueIds.length}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Personalized recommendations (top) ── */}
                  {recommended.length > 0 && (
                    <Shelf title="FOR YOU" count={recommended.length}>
                      {recommended.map((v, i) => (
                        <LandscapeVenueCard key={v.id} venue={v} onClick={() => handleExploreVenueTap(v, `What's good at ${v.name} right now?`)} delay={Math.min(i * 0.04, 0.2)} />
                      ))}
                    </Shelf>
                  )}

                  {/* ── Your spots ── */}
                  {yourSpots.length > 0 && (
                    <Shelf title="YOUR SPOTS">
                      {yourSpots.map(({ venue, xp }, i) => (
                        <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => handleExploreVenueTap(venue, `What's happening at ${venue.name}?`)} delay={Math.min(i * 0.04, 0.2)} xp={xp} />
                      ))}
                    </Shelf>
                  )}

                  {/* ── All Places ── */}
                  {venues.length > 0 && (
                    <Shelf title="PLACES" count={venues.length}>
                      {venues.slice(0, 12).map((v, i) => (
                        <LandscapeVenueCard key={v.id} venue={v} onClick={() => handleExploreVenueTap(v, `Tell me about ${v.name}`)} delay={Math.min(i * 0.04, 0.2)} />
                      ))}
                    </Shelf>
                  )}

                  {/* ── Virtual places (no location) ── */}
                  {(() => {
                    const virtualPlaces = venues.filter((v) => v.latitude === 0 && v.longitude === 0 && !v.isEventPin);
                    if (virtualPlaces.length === 0) return null;
                    return (
                      <Shelf title="VIRTUAL & MOBILE" count={virtualPlaces.length}>
                        {virtualPlaces.map((v, i) => (
                          <LandscapeVenueCard key={v.id} venue={v} onClick={() => { onVenueSelect(v); setMode("venueChat"); setVenueChatSnap("expanded"); }} delay={Math.min(i * 0.04, 0.2)} />
                        ))}
                      </Shelf>
                    );
                  })()}

                  {/* ── Offerings by category ── */}
                  {exploreOfferings.length > 0 && (() => {
                    const OFFER_CATEGORIES: { key: string; label: string; types: string[]; icon: string }[] = [
                      { key: "food", label: "FOOD & DRINKS", types: ["product"], icon: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3" },
                      { key: "events", label: "EVENTS", types: ["event"], icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
                      { key: "services", label: "SERVICES", types: ["service"], icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2M12 8v4l3 3" },
                      { key: "reserve", label: "RESERVATIONS", types: ["reservation"], icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
                      { key: "membership", label: "MEMBERSHIPS", types: ["membership"], icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
                      { key: "shop", label: "SHOP", types: ["package", "custom"], icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" },
                    ];

                    return OFFER_CATEGORIES.map(({ key, label, types, icon }) => {
                      const items = exploreOfferings.filter((o) => types.includes(o.type));
                      if (items.length === 0) return null;

                      return (
                        <div key={key} className="mb-5">
                          <div className="flex items-center justify-between px-5 pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                              <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/25">{label}</span>
                            </div>
                            <span className="font-sans text-[10px] text-white/15">{items.length}</span>
                          </div>
                          <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
                            {items.map((item, i) => {
                              const venue = venues.find((v) => v.id === item.venue_id);
                              const color = venue?.themeColor || "#F97316";
                              return (
                                <motion.button
                                  key={item.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: Math.min(i * 0.03, 0.15) }}
                                  onClick={() => {
                                    if (venue) {
                                      handleExploreVenueTap(venue, `Tell me about ${item.name}`);
                                    }
                                  }}
                                  className="flex shrink-0 flex-col overflow-hidden  text-left active:scale-[0.97]"
                                  style={{
                                    width: 160, scrollSnapAlign: "start",
                                    backgroundColor: "rgba(255,255,255,0.03)",
                                    border: `1px solid ${color}15`,
                                  }}
                                >
                                  {/* Image or gradient header */}
                                  <div className="relative h-20 w-full" style={{ background: item.image_url ? undefined : `linear-gradient(135deg, ${color}20 0%, ${color}06 100%)` }}>
                                    {item.image_url ? (
                                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={`${color}40`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                                      </div>
                                    )}
                                    {/* Price badge */}
                                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                                      <span className="font-mono text-[10px] font-bold" style={{ color }}>${(item.price_cents / 100).toFixed(item.price_cents % 100 === 0 ? 0 : 2)}</span>
                                    </div>
                                  </div>
                                  {/* Info */}
                                  <div className="flex flex-col gap-0.5 px-2.5 py-2">
                                    <span className="truncate font-sans text-[12px] font-semibold text-white/80">{item.name}</span>
                                    {item.description && (
                                      <span className="line-clamp-1 font-sans text-[9px] leading-[1.3] text-white/30">{item.description}</span>
                                    )}
                                    <span className="mt-0.5 truncate font-sans text-[9px] font-medium text-white/20">{venue?.name || "Venue"}</span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* (Your Spots + Recommended moved above categories) */}

                  {affordablePerks.length > 0 && (
                    <Shelf title="PERKS YOU CAN CLAIM" count={affordablePerks.length}>
                      {affordablePerks.map((perk, i) => (
                        <PerkBadge
                          key={perk.id}
                          perk={perk}
                          venueName={venueNameMap.get(perk.venue_id) || "Venue"}
                          canAfford={balance >= perk.point_cost}
                          onClick={() => {
                            const v = venues.find((v) => v.id === perk.venue_id);
                            if (v) {
                              handleExploreVenueTap(v);
                              setTimeout(() => send(`Tell me about the ${perk.name} perk`), 300);
                            }
                          }}
                          delay={Math.min(i * 0.04, 0.2)}
                        />
                      ))}
                    </Shelf>
                  )}

                  {exploreDigitalAssets.length > 0 && (
                    <Shelf title="COLLECTIBLES" count={exploreDigitalAssets.length}>
                      {exploreDigitalAssets.map((asset, i) => {
                        const assetEmoji = asset.asset_type === "sticker" ? "\u{1F3F7}\uFE0F" : asset.asset_type === "badge" ? "\u{1F3C5}" : "\u{1F4CC}";
                        const assetColor = asset.asset_type === "sticker" ? "#4ADE80" : asset.asset_type === "badge" ? "#F97316" : "#A78BFA";
                        const priceLabel = asset.xp_cost ? `${asset.xp_cost} XP` : asset.cash_price_cents ? `$${(asset.cash_price_cents / 100).toFixed(2)}` : "Free";
                        return (
                          <motion.button
                            key={asset.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300, delay: Math.min(i * 0.04, 0.2) }}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => {
                              const v = venues.find((v) => v.id === asset.venue_id);
                              if (v) {
                                handleExploreVenueTap(v);
                                setTimeout(() => send(`I want the ${asset.name} ${asset.asset_type}`), 300);
                              }
                            }}
                            className="flex shrink-0 flex-col items-center"
                            style={{ width: 80, scrollSnapAlign: "start" }}
                          >
                            <div
                              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
                              style={{
                                background: `linear-gradient(135deg, ${assetColor}20, ${assetColor}08)`,
                                border: `2px solid ${assetColor}30`,
                                boxShadow: `0 0 16px ${assetColor}15`,
                              }}
                            >
                              <span className="text-[28px]">{assetEmoji}</span>
                            </div>
                            <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueNameMap.get(asset.venue_id) || "Venue"}</p>
                            <span className="px-2 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: `${assetColor}15`, color: assetColor, border: `1px solid ${assetColor}25` }}>
                              {priceLabel}
                            </span>
                            {asset.is_animated && <span className="mt-0.5 font-sans text-[7px] text-white/15">{"\u2728"} animated</span>}
                          </motion.button>
                        );
                      })}
                    </Shelf>
                  )}

                  {happeningNow.length > 0 && (
                    <Shelf title="HAPPENING NOW" count={happeningNow.length}>
                      {happeningNow.map((v, i) => (
                        <LandscapeVenueCard
                          key={v.id} venue={v} onClick={() => handleExploreVenueTap(v)}
                          delay={Math.min(i * 0.04, 0.2)}
                          xp={user?.venueProfiles.find((vp) => vp.venue_id === v.id)?.xp}
                        />
                      ))}
                    </Shelf>
                  )}

                  {nearYou.length > 0 && (
                    <Shelf title="NEAR YOU">
                      {nearYou.map(({ venue, dist }, i) => (
                        <LandscapeVenueCard key={venue.id} venue={venue} onClick={() => handleExploreVenueTap(venue)} delay={Math.min(i * 0.04, 0.2)} distance={dist} />
                      ))}
                    </Shelf>
                  )}

                  {quietSpots.length > 0 && (
                    <Shelf title="GOOD FOR FOCUS">
                      {quietSpots.map((v, i) => (
                        <LandscapeVenueCard key={v.id} venue={v} onClick={() => handleExploreVenueTap(v)} delay={Math.min(i * 0.04, 0.2)} />
                      ))}
                    </Shelf>
                  )}

                  {/* Full-only sections */}
                  {(exploreSnap === "full" || exploreSnap === "half") && user && threadInfo.count > 0 && (
                    <>
                      <div className="mb-3">
                        <div className="flex items-center justify-between px-4 pb-2">
                          <div className="flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">YOUR CONVERSATIONS</span>
                            {threadInfo.unread > 0 && <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316" }}>{threadInfo.unread} new</span>}
                          </div>
                        </div>
                        <ThreadsList
                          onThreadSelect={(venueId) => {
                            if (venueId) {
                              const venue = venues.find((v) => v.id === venueId);
                              if (venue) handleExploreVenueTap(venue);
                            } else {
                              loadThreadHistory(null).then((messages) => {
                                if (messages && messages.length > 0) {
                                  setConciergeMessages(messages);
                                }
                              });
                              setMode("concierge");
                            }
                          }}
                          onThreadDelete={(venueId) => {
                            if (venueId) {
                              setVenueThreads((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
                            } else {
                              setConciergeMessages([]);
                            }
                          }}
                        />
                      </div>

                      <div className="px-4">
                        <PreferencesSection />
                      </div>

                      <div className="px-4 pb-6 pt-3">
                        <button
                          onClick={async () => {
                            const supabase = createClient();
                            await supabase.auth.signOut();
                            window.location.reload();
                          }}
                          className="flex w-full items-center justify-center gap-2  py-2.5 font-sans text-[11px] font-medium text-white/25 transition hover:bg-white/[0.04] hover:text-white/40"
                          style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Input bar at bottom of explore */}
              {exploreSnap !== "peek" && (
                <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    onFocus={handleInputFocus}
                    placeholder="What are you looking for?"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    className="min-w-0 flex-1 px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                    style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  {input.trim() && (
                    <motion.button
                      onClick={() => send()}
                      disabled={loading}
                      whileTap={{ scale: 0.9 }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                      style={{ backgroundColor: ACCENT, boxShadow: `0 2px 10px ${ACCENT}40` }}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══ CONCIERGE MODE ═══ */}
          {mode === "concierge" && (
            <>
              {/* Header — KB branding + profile */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[20px] font-black tracking-tighter" style={{ color: "#F97316" }}>K</span>
                  <span className="font-sans text-[20px] font-black tracking-tighter text-white/90" style={{ marginLeft: -6 }}>B</span>
                  <span className="font-sans text-[11px] text-white/25 ml-1">Concierge</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasLocation && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRecenter(); }}
                      className="flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                      </svg>
                    </button>
                  )}
                  {/* Profile */}
                  <button
                    onClick={handleAvatarTap}
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      background: user ? `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)` : "rgba(255,255,255,0.06)",
                      border: `2px solid ${user ? `${tierColor}40` : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {user ? (
                      <span className="font-sans text-[12px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </button>
                  <motion.button
                    onClick={() => setMode("idle")}
                    whileTap={{ scale: 0.85 }}
                    className="flex h-7 w-7 items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </motion.button>
                </div>
              </div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
              >
                <div className="flex flex-col gap-2.5">
                  {conciergeMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%]  px-3.5 py-2.5 ${msg.sender === "guest" ? "" : ""}`}
                        style={msg.sender === "guest"
                          ? { backgroundColor: ACCENT, color: "#000", boxShadow: `0 2px 12px ${ACCENT}33` }
                          : { backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }
                        }
                      >
                        <div className="font-sans text-[14px] leading-[1.5]">
                          {msg.sender === "ai"
                            ? parseVenueChips(venues, apiVenues, richVenues, msg.body, handleConciergeVenueTap, offeringsMap)
                            : msg.body}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {loading && <LoadingDots />}
                </div>
              </div>

              {/* Quick replies */}
              {conciergeMessages.length <= 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {["What's open right now?", "Somewhere quiet to work", "Best spot for a date", "Where's the party?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="shrink-0 px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything..."
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <motion.button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ backgroundColor: ACCENT, boxShadow: `0 2px 10px ${ACCENT}40` }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </motion.button>
              </div>
            </>
          )}

          {/* ═══ VENUE CHAT EXPANDED ═══ */}
          {mode === "venueChat" && venueChatExpanded && selectedVenue && !showVenueContact && user && (
            <>
              {/* Header */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowVenueContact(true)}
                    className="flex items-center gap-2.5 active:opacity-70"
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full" style={{ border: `2px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
                      {selectedVenue.heroImage ? (
                        <img src={selectedVenue.heroImage} alt="" className="h-full w-full object-cover" />
                      ) : selectedVenue.logo ? (
                        <img src={selectedVenue.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="font-sans text-[12px] font-bold" style={{ color: vibeColor }}>{selectedVenue.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-black" style={{ backgroundColor: vibeColor }} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[14px] font-semibold text-white/90 leading-tight">{selectedVenue.name}</span>
                      <span className="font-sans text-[9px] text-white/30">{selectedVenue.neighborhood || "Tap for info"}</span>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {/* Threads — switch conversations */}
                    {threadInfo.count > 1 && (
                      <motion.button
                        onClick={() => { setPreviousMode("venueChat"); setMode("threads"); }}
                        whileTap={{ scale: 0.9 }}
                        className="relative flex h-7 items-center gap-1 px-2"
                        style={{ backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="font-mono text-[9px] font-bold" style={{ color: "#a78bfa" }}>{threadInfo.count}</span>
                      </motion.button>
                    )}
                    {/* Back to KB */}
                    <motion.button
                      onClick={handleKBBack}
                      whileTap={{ scale: 0.9 }}
                      className="flex h-7 items-center gap-1.5 px-2.5"
                      style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span className="font-sans text-[10px] font-bold text-[#a78bfa]">KB</span>
                    </motion.button>
                    {/* Clear thread */}
                    {currentVenueMessages.length > 1 && (
                      <motion.button
                        onClick={() => {
                          if (!selectedVenue) return;
                          const welcomeBody = selectedVenue.claimed === false
                            ? `Hey — I know a bit about ${selectedVenue.name} from public info. Ask me what you want to know.`
                            : `Welcome to ${selectedVenue.name}. Ask me anything.`;
                          setVenueThreads((prev) => {
                            const next = new Map(prev);
                            next.set(selectedVenue.id, [{ id: `welcome-${Date.now()}`, sender: "ai", body: welcomeBody, timestamp: Date.now() }]);
                            return next;
                          });
                        }}
                        whileTap={{ scale: 0.85 }}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                        title="Start over"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </motion.button>
                    )}
                    {/* Expand to full / collapse from full */}
                    <motion.button
                      onClick={() => setVenueChatSnap(venueChatSnap === "full" ? "expanded" : "full")}
                      whileTap={{ scale: 0.85 }}
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: venueChatSnap === "full" ? `${vibeColor}15` : "rgba(255,255,255,0.08)" }}
                    >
                      {venueChatSnap === "full" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                          <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                          <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      )}
                    </motion.button>
                    {/* Collapse to pill */}
                    <motion.button
                      onClick={() => setVenueChatSnap("collapsed")}
                      whileTap={{ scale: 0.85 }}
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </motion.button>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="mt-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {selectedVenue.category && selectedVenue.category !== "venue" && (
                    <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 font-sans text-[8px] font-medium capitalize text-white/25" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>{selectedVenue.category}</span>
                  )}
                  {selectedVenue.neighborhood && <span className="shrink-0 font-sans text-[9px] text-white/20">{selectedVenue.neighborhood}</span>}
                  {selectedVenue.hours && (
                    <div className="flex shrink-0 items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="font-sans text-[8px] text-white/15">{selectedVenue.hours.split(",")[0]}</span>
                    </div>
                  )}
                  {walletStatus?.active && (
                    <div className="flex shrink-0 items-center gap-1 px-2 py-0.5" style={{ backgroundColor: "rgba(99,91,255,0.1)", border: "1px solid rgba(99,91,255,0.2)" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                      <span className="font-mono text-[9px] font-semibold" style={{ color: "#635bff" }}>${((walletStatus?.balanceCents || 0) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {/* Navigate button */}
                  {hasLocation && selectedVenue.latitude !== 0 && (
                    <button
                      onClick={() => navInfo ? clearNav() : fetchDirections(navProfile)}
                      disabled={navLoading}
                      className="flex shrink-0 items-center gap-1 px-2 py-0.5 active:scale-95"
                      style={{
                        backgroundColor: navInfo ? `${vibeColor}20` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${navInfo ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={navInfo ? vibeColor : "rgba(255,255,255,0.4)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                      <span className="font-sans text-[9px] font-semibold" style={{ color: navInfo ? vibeColor : "rgba(255,255,255,0.4)" }}>
                        {navLoading ? "..." : navInfo ? `${Math.round(navInfo.duration / 60)} min` : "Navigate"}
                      </span>
                    </button>
                  )}
                </div>

                {selectedVenue.tagline && (
                  <p className="mt-1 line-clamp-1 font-sans text-[10px] italic text-white/25">&ldquo;{selectedVenue.tagline}&rdquo;</p>
                )}
              </div>

              {/* Navigation directions panel */}
              <AnimatePresence>
                {navInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-4 mb-1 overflow-hidden "
                    style={{ backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${vibeColor}15` }}
                  >
                    {/* Profile toggle + summary */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Walking / Driving toggle */}
                        <div className="flex" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <button
                            onClick={() => fetchDirections("walking")}
                            className="flex items-center gap-1 px-2 py-1 font-sans text-[9px] font-semibold transition"
                            style={{
                              backgroundColor: navProfile === "walking" ? `${vibeColor}20` : "transparent",
                              color: navProfile === "walking" ? vibeColor : "rgba(255,255,255,0.35)",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="5" r="2" /><path d="M10 22V18L7 15V11L10 9L14 9L17 11V15L14 18V22" />
                            </svg>
                            Walk
                          </button>
                          <button
                            onClick={() => fetchDirections("driving")}
                            className="flex items-center gap-1 px-2 py-1 font-sans text-[9px] font-semibold transition"
                            style={{
                              backgroundColor: navProfile === "driving" ? `${vibeColor}20` : "transparent",
                              color: navProfile === "driving" ? vibeColor : "rgba(255,255,255,0.35)",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 3M19 17l1 3" />
                            </svg>
                            Drive
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[12px] font-bold" style={{ color: vibeColor }}>{Math.round(navInfo.duration / 60)} min</span>
                          <span className="font-mono text-[10px] text-white/30">
                            {navInfo.distance < 1000
                              ? `${Math.round(navInfo.distance)} m`
                              : `${(navInfo.distance / 1609).toFixed(1)} mi`
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={openInMaps}
                          className="flex items-center gap-1 px-2 py-1 font-sans text-[9px] font-semibold active:scale-95"
                          style={{ backgroundColor: `${vibeColor}15`, color: vibeColor, border: `1px solid ${vibeColor}25` }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          Open Maps
                        </button>
                        <button
                          onClick={clearNav}
                          className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/[0.08]"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Step-by-step directions */}
                    <div className="max-h-[120px] overflow-y-auto px-3 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                      {navInfo.steps.filter((s) => s.instruction).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 py-1" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${vibeColor}15` }}>
                            <span className="font-mono text-[7px] font-bold" style={{ color: vibeColor }}>{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-[11px] leading-[1.4] text-white/60">{step.instruction}</p>
                            <span className="font-mono text-[9px] text-white/20">
                              {step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1609).toFixed(1)} mi`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat / Shop toggle */}
              <div className="flex items-center gap-1 mx-4 mt-1 mb-1">
                {(["chat", "shop"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVenueViewMode(v)}
                    className="flex-1 py-1.5 font-sans text-[11px] font-semibold text-center transition"
                    style={{
                      backgroundColor: venueViewMode === v ? `${vibeColor}15` : "rgba(255,255,255,0.03)",
                      color: venueViewMode === v ? vibeColor : "rgba(255,255,255,0.25)",
                      borderBottom: venueViewMode === v ? `2px solid ${vibeColor}` : "2px solid transparent",
                    }}
                  >
                    {v === "chat" ? "Chat" : "Shop"}
                  </button>
                ))}
              </div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              {/* Shop view */}
              {venueViewMode === "shop" && (
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                  <DockShopView
                    offerings={venueOfferings[selectedVenue.id] || []}
                    themeColor={vibeColor}
                    onTap={(id) => {
                      const o = (venueOfferings[selectedVenue.id] || []).find((x) => x.id === id);
                      if (o && !offeringsMap[selectedVenue.id]?.[id]) {
                        setOfferingsMap((prev) => ({
                          ...prev,
                          [selectedVenue.id]: {
                            ...(prev[selectedVenue.id] || {}),
                            [id]: { name: o.name, description: o.description || null, price_cents: o.price_cents || 0, image_url: null, type: o.type, recurring: o.recurring, interval: o.interval, duration_minutes: o.duration_minutes },
                          },
                        }));
                      }
                      setDrawerOfferId(id);
                    }}
                    onAddToCart={(id, name, price) => addToCart(selectedVenue.id, id, name, price)}
                  />
                </div>
              )}

              {/* Messages + Venue Profile */}
              {venueViewMode === "chat" && (
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
              >
                <div className="flex flex-col gap-2.5">
                  {currentVenueMessages.map((msg) => {
                    if (msg.sender === "guest") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-end">
                          <div className="max-w-[80%]   px-3.5 py-2.5" style={{ backgroundColor: vibeColor, color: "#000", boxShadow: `0 2px 12px ${vibeColor}33` }}>
                            <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                          </div>
                        </motion.div>
                      );
                    }

                    if (msg.tab && msg.tab !== "chat") {
                      // Phase 5: Inline tab responses — text bubble + compact strip below
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col gap-2">
                          {msg.body && (
                            <div className="flex justify-start">
                              <div className="max-w-[85%]   px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <AiMessageBody
                                  body={msg.body}
                                  theme={vibeColor}
                                  offeringsMap={offeringsMap[selectedVenue.id] || {}}
                                  onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)} onBookOffer={(oid) => setDrawerOfferId(oid)} onTapOffer={(oid) => setDrawerOfferId(oid)}
                                />
                              </div>
                            </div>
                          )}
                          {/* Compact tab strip */}
                          <div className="ml-1">
                            <button
                              onClick={() => handleTabTap(msg.tab!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 font-sans text-[10px] font-medium active:scale-95"
                              style={{ backgroundColor: `${vibeColor}12`, color: vibeColor, border: `1px solid ${vibeColor}25` }}
                            >
                              <TabIcon path={TABS.find((t) => t.id === msg.tab)?.icon || ""} size={10} />
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
                          {/* AI message text */}
                          {msg.body && (
                            <div className="flex justify-start">
                              <div className="max-w-[85%]   px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <AiMessageBody
                                  body={msg.body}
                                  theme={vibeColor}
                                  offeringsMap={offeringsMap[selectedVenue.id] || {}}
                                  onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)} onBookOffer={(oid) => setDrawerOfferId(oid)} onTapOffer={(oid) => setDrawerOfferId(oid)}
                                />
                              </div>
                            </div>
                          )}

                          {/* Order summary */}
                          <div className="w-full  overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}15` }}>
                            <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="flex items-center gap-2 mb-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                <span className="font-sans text-[13px] font-bold text-white/80">Order at {selectedVenue.name}</span>
                              </div>
                              {msg.checkout.items.map((item, i) => {
                                const itemMeta = (item as unknown as { metadata?: { date?: string; time?: string; staffName?: string } }).metadata;
                                return (
                                  <div key={i} className="py-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-sans text-[12px] text-white/60">
                                        {item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}
                                      </span>
                                      <span className="font-mono text-[12px] text-white/50">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
                                    </div>
                                    {itemMeta?.date && (
                                      <p className="font-sans text-[10px] text-white/30 mt-0.5">
                                        {itemMeta.date} {itemMeta.time && `at ${itemMeta.time}`}{itemMeta.staffName && ` · ${itemMeta.staffName}`}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
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
                              className="flex w-full items-center justify-center gap-2  py-3.5 font-sans text-[14px] font-bold text-black active:scale-[0.97]"
                              style={{ backgroundColor: vibeColor }}
                            >
                              Log in to checkout
                            </a>
                          )}

                          {/* ══ Compact payment buttons ══ */}
                          {user && <div className="flex gap-2 w-full">
                            {/* KB Wallet */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "wallet")}
                              disabled={!canUseWallet || paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1  py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
                              style={{ backgroundColor: canUseWallet ? "rgba(99,91,255,0.12)" : "rgba(99,91,255,0.05)", border: `1px solid ${canUseWallet ? "rgba(99,91,255,0.3)" : "rgba(99,91,255,0.1)"}` }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                              <span className="font-mono text-[14px] font-bold" style={{ color: "#a78bfa" }}>${(subtotal / 100).toFixed(2)}</span>
                              <span className="font-sans text-[10px] font-semibold" style={{ color: "#a78bfa" }}>
                                {passkey.verifying || paymentMode === "processing" ? "Verifying..." : "KB Wallet"}
                              </span>
                              {walletStatus?.active && <span className="font-mono text-[9px] text-white/25">Bal: ${(walletStatus.balanceCents / 100).toFixed(2)}</span>}
                              <span className="font-sans text-[8px]" style={{ color: "#4ade80" }}>No fees</span>
                            </button>
                            {/* Card */}
                            <button
                              onClick={() => handleCheckoutConfirm(msg, [], 0, "card")}
                              disabled={paymentMode === "processing" || passkey.verifying}
                              className="flex-1 flex flex-col items-center gap-1  py-3 px-2 transition active:scale-[0.97] disabled:opacity-40"
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
                            className="w-full  py-2.5 font-sans text-[12px] font-medium text-white/30 transition hover:bg-white/[0.04]"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            Cancel
                          </button>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex justify-start">
                        <div className="max-w-[85%]   px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <AiMessageBody
                            body={msg.body}
                            theme={vibeColor}
                            offeringsMap={offeringsMap[selectedVenue.id] || {}}
                            onAddToCart={(oid, name, price) => addToCart(selectedVenue.id, oid, name, price)} onBookOffer={(oid) => setDrawerOfferId(oid)} onTapOffer={(oid) => setDrawerOfferId(oid)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  {loading && <LoadingDots />}
                </div>
              </div>
              )}

              {/* Unclaimed place banner */}
              {selectedVenue.claimed === false && (
                <div className="mx-3 mb-1 px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.1)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[10px] text-white/25">This place hasn&apos;t claimed their page yet</span>
                    <a href="https://dash.thekickback.net" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 font-sans text-[9px] font-bold text-black" style={{ backgroundColor: "#F97316" }}>
                      Claim
                    </a>
                  </div>
                </div>
              )}

              {/* Cart pill */}
              {cartCount > 0 && selectedVenue && (
                <div className="px-3 pb-1">
                  <AnimatePresence>
                    {cartExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-1.5 overflow-hidden "
                        style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${vibeColor}20` }}
                      >
                        <div className="flex flex-col gap-1 px-3 py-2">
                          {currentCart.map((item) => (
                            <div key={item.offeringId} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate font-sans text-[12px] text-white/70">{item.name}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => removeFromCart(selectedVenue.id, item.offeringId)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                  <span className="font-mono text-[11px] font-bold text-white/50">-</span>
                                </button>
                                <span className="w-4 text-center font-mono text-[11px] font-bold text-white/60">{item.quantity}</span>
                                <button
                                  onClick={() => addToCart(selectedVenue.id, item.offeringId, item.name, item.priceCents)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full active:scale-90"
                                  style={{ backgroundColor: `${vibeColor}20` }}
                                >
                                  <span className="font-mono text-[11px] font-bold" style={{ color: vibeColor }}>+</span>
                                </button>
                                <span className="w-12 text-right font-mono text-[11px] font-semibold text-white/50">${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: `${vibeColor}15` }}>
                          <button
                            onClick={() => clearCart(selectedVenue.id)}
                            className="px-2.5 py-1 font-sans text-[10px] font-medium text-white/30 active:scale-95"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            Clear
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => { setCartExpanded(false); send("__CHECKOUT__"); }}
                            className="px-4 py-1.5 font-sans text-[11px] font-bold text-black active:scale-95"
                            style={{ backgroundColor: vibeColor }}
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
                    style={{ backgroundColor: `${vibeColor}12`, border: `1px solid ${vibeColor}25` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      <span className="font-sans text-[11px] font-semibold" style={{ color: vibeColor }}>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: vibeColor }}>${(cartTotal / 100).toFixed(2)}</span>
                  </button>
                </div>
              )}

              {/* Smart quick replies */}
              {!loading && selectedVenue && (() => {
                const replies = getVenueReplies();
                if (replies.length === 0) return null;
                return (
                  <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                    {replies.map((r) => (
                      <button
                        key={r.label}
                        onClick={() => send(r.action)}
                        className="shrink-0 px-3 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                        style={{ backgroundColor: `${vibeColor}08`, color: `${vibeColor}cc`, border: `1px solid ${vibeColor}20` }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Input bar */}
              <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything..."
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <motion.button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ backgroundColor: vibeColor, boxShadow: `0 2px 10px ${vibeColor}40` }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </motion.button>
              </div>
            </>
          )}

          {/* ═══ VENUE CONTACT PAGE ═══ */}
          {mode === "venueChat" && venueChatExpanded && selectedVenue && showVenueContact && (
            <VenueContact
              venue={selectedVenue}
              onClose={() => setShowVenueContact(false)}
              onChat={() => setShowVenueContact(false)}
            />
          )}

          {/* Unclaimed venue "Claim" CTA — shown below the main chat for unclaimed places */}

          {/* ═══ PROFILE MODE ═══ */}
          {mode === "profile" && (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <motion.button onClick={handleProfileBack} whileTap={{ scale: 0.85 }} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><polyline points="15 18 9 12 15 6" /></svg>
                </motion.button>
                <span className="font-sans text-[15px] font-semibold text-white/90">Profile</span>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                {user && (
                  <div className="px-4 pb-6">

                    {/* ── Identity + Score (merged hero) ── */}
                    <ProfileIdentity user={user} tierColor={tierColor} />

                    {/* ── Quick actions row ── */}
                    <div className="flex gap-2 mb-4">
                      {/* KickBack Pass */}
                      <a
                        href={`https://thekickback.net/wallet/pass/${user.authId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 py-2.5 active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg, ${tierColor}12, ${tierColor}05)`, border: `1px solid ${tierColor}20` }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tierColor} strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                        <span className="font-sans text-[12px] font-semibold" style={{ color: tierColor }}>KB Pass</span>
                      </a>
                      {/* Biometric */}
                      <button
                        onClick={async () => {
                          const ok = await passkey.register();
                          if (ok) {
                            setDeviceRefreshKey((k) => k + 1);
                            setVenueThreads((prev) => {
                              const next = new Map(prev);
                              const vid = selectedVenue?.id || "global";
                              next.set(vid, [...(next.get(vid) || []), { id: `bio-ok-${Date.now()}`, sender: "ai", body: "Biometric registered.", timestamp: Date.now() }]);
                              return next;
                            });
                          }
                        }}
                        disabled={passkey.verifying}
                        className="flex flex-1 items-center justify-center gap-2 py-2.5 active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: passkey.hasPasskey ? "rgba(74,222,128,0.06)" : "rgba(249,115,22,0.06)", border: `1px solid ${passkey.hasPasskey ? "rgba(74,222,128,0.15)" : "rgba(249,115,22,0.15)"}` }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={passkey.hasPasskey ? "#4ADE80" : "#F97316"} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        <span className="font-sans text-[12px] font-semibold" style={{ color: passkey.hasPasskey ? "#4ADE80" : "#F97316" }}>
                          {passkey.hasPasskey ? "Secured" : "Set Up"}
                        </span>
                      </button>
                    </div>

                    {/* ── Wallet ── */}
                    <WalletSheet />

                    {/* ── Memberships + Perks (only if they have any) ── */}
                    {(memberships.length > 0 || perks.length > 0) && (
                      <div className="mt-4">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">MEMBERSHIPS & PERKS</span>
                        {memberships.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {memberships.map((m) => (
                              <div key={m.venue_id} className="flex items-center gap-2.5 px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.08)" }}>
                                <span className="text-[13px]">👑</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-sans text-[12px] font-semibold text-white/80">{m.venue_name}</p>
                                  <p className="font-sans text-[10px] text-white/30">{m.tier} · {new Date(m.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                </div>
                                <span className="shrink-0 rounded-full px-1.5 py-0.5 font-sans text-[9px] font-semibold" style={{ backgroundColor: m.billing === "stripe" ? "rgba(99,102,241,0.12)" : "rgba(249,115,22,0.12)", color: m.billing === "stripe" ? "#818CF8" : "#F97316" }}>
                                  {m.billing === "stripe" ? "Stripe" : "KB Wallet"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {perks.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {perks.map((p) => {
                              const canRedeem = user && user.kickbackScore >= p.point_cost;
                              return (
                                <RedeemablePerk key={p.id} perk={p} canRedeem={!!canRedeem} userScore={user?.kickbackScore || 0} />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Venues + Collectibles ── */}
                    {(user.venueProfiles.length > 0 || myCollectibles.length > 0) && (
                      <div className="mt-4">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">YOUR PLACES</span>
                        {user.venueProfiles.length > 0 && (
                          <div className="mt-2 flex gap-2.5 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                            {user.venueProfiles.slice(0, 10).map((vp) => {
                              const mc = vp.venue_xp_milestones?.color || "#94a3b8";
                              return (
                                <div key={vp.venue_id} className="flex shrink-0 flex-col items-center" style={{ width: 52 }}>
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${mc}20, ${mc}08)`, border: `2px solid ${mc}30` }}>
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mc }} />
                                  </div>
                                  <p className="mt-1 w-full truncate text-center font-sans text-[9px] text-white/40">{vp.venues?.name || "Venue"}</p>
                                  <span className="font-mono text-[9px] font-bold" style={{ color: mc }}>{vp.xp}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {myCollectibles.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                            {myCollectibles.slice(0, 8).map((c) => {
                              const emoji = c.asset_type === "sticker" ? "🏷️" : c.asset_type === "badge" ? "🏅" : "📌";
                              const color = c.asset_type === "sticker" ? "#4ADE80" : c.asset_type === "badge" ? "#F97316" : "#A78BFA";
                              return (
                                <button key={c.unlock_id} onClick={() => { const v = venues.find((v) => v.id === c.hub_id); if (v) { onVenueSelect(v); setTimeout(() => send(`Tell me about my ${c.name} ${c.asset_type}`), 300); } }} className="flex shrink-0 flex-col items-center active:scale-95" style={{ width: 52 }}>
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)`, border: `2px solid ${color}30` }}>
                                    <span className="text-[16px]">{emoji}</span>
                                  </div>
                                  <p className="mt-1 w-full truncate text-center font-sans text-[9px] text-white/40">{c.name}</p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Referral Keys (collapsed by default) ── */}
                    {referralKeys.length > 0 && (
                      <div className="mt-4">
                        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">INVITE FRIENDS</span>
                        <div className="mt-2 flex flex-col gap-1">
                          {referralKeys.filter((k) => !k.used_by_email).slice(0, 3).map((k) => (
                            <div key={k.id} className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.08)" }}>
                              <span className="flex-1 font-mono text-[11px] text-white/50">{k.key}</span>
                              <button onClick={() => navigator.clipboard?.writeText(`https://join.thekickback.net?ref=${k.key}`)} className="px-2.5 py-1 font-sans text-[10px] font-bold active:scale-95" style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316" }}>Copy</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Settings ── */}
                    <div className="mt-4">
                      <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">SETTINGS</span>
                      <div className="mt-2 flex flex-col gap-2">
                        <DiscoveryRadiusSetting />
                        <DeviceManager key={deviceRefreshKey} />
                        <PreferencesSection />
                      </div>
                    </div>

                    {/* Feedback */}
                    <FeedbackSection />

                    {/* Account actions */}
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); window.location.reload(); }}
                        className="flex w-full items-center justify-center gap-2 py-2.5 font-sans text-[12px] font-medium text-white/25 transition hover:text-white/40"
                        style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        Sign Out
                      </button>
                      <DeleteAccountButton />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ THREADS MODE ═══ */}
          {mode === "threads" && (
            <>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-sans text-[15px] font-semibold text-white/90">Conversations</span>
                  {threadInfo.unread > 0 && <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316" }}>{threadInfo.unread} new</span>}
                </div>
                <motion.button
                  onClick={() => setMode(previousMode === "threads" ? "idle" : previousMode)}
                  whileTap={{ scale: 0.85 }}
                  className="flex h-7 w-7 items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </motion.button>
              </div>

              <div className="mx-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                <ThreadsList
                  onThreadSelect={(venueId) => {
                    if (venueId) {
                      const venue = venues.find((v) => v.id === venueId);
                      if (venue) onVenueSelect(venue);
                    } else {
                      loadThreadHistory(null).then((messages) => {
                        if (messages && messages.length > 0) setConciergeMessages(messages);
                      });
                      setMode("concierge");
                    }
                  }}
                  onThreadDelete={(venueId) => {
                    if (venueId) {
                      setVenueThreads((prev) => { const next = new Map(prev); next.delete(venueId); return next; });
                    } else {
                      setConciergeMessages([]);
                    }
                  }}
                />
                {threadInfo.count === 0 && (
                  <div className="flex flex-col items-center py-12 text-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="mt-3 font-sans text-[13px] text-white/25">No conversations yet</p>
                    <p className="mt-1 font-sans text-[11px] text-white/15">Chat with a venue to start one</p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* ═══ TUTORIAL ═══ */}
      <AnimatePresence>
        {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* ═══ ABOUT SHEET ═══ */}
      <AnimatePresence>
        {showAbout && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAbout(false)}
              className="fixed inset-0 z-[100]"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[101] "
              style={{ backgroundColor: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "70dvh" }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="font-sans text-[14px] font-bold text-white/80">About</span>
                <button onClick={() => setShowAbout(false)} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "calc(70dvh - 60px)" }}>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="h-10 w-auto" />
                  <span className="font-mono text-[12px] text-white/30">v{APP_VERSION}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    ["Version", APP_VERSION],
                    ["Build", `#${BUILD_NUMBER}`],
                    ["Built", BUILD_DATE],
                    ["Platform", "Progressive Web App"],
                    ["Runtime", "Next.js 16 + React 19"],
                    ["AI", "OpenClaw (OpenRouter)"],
                    ["Payments", "Stripe Connect"],
                    ["Auth", "Supabase OTP + WebAuthn"],
                    ["Maps", "Mapbox GL"],
                    ["KB Wallet", "Apple Wallet + Google Wallet"],
                    ["Email", "Resend (place@thekickback.net)"],
                    ["Hosting", "Docker + Caddy on VPS"],
                    ["Workers", "Cloudflare Workers"],
                    ["Database", "Supabase (PostgreSQL)"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="font-sans text-[11px] text-white/30">{label}</span>
                      <span className="font-mono text-[11px] text-white/50">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-center font-sans text-[10px] text-white/15">
                  theKickBack Protocol &mdash; tap in, text in, you&rsquo;re in
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Product Drawer for bookable offerings ── */}
      <AnimatePresence>
        {drawerOfferId && selectedVenue && (() => {
          const venueOffers = offeringsMap[selectedVenue.id] || {};
          let meta = venueOffers[drawerOfferId];

          // If meta not loaded yet, try to fetch it
          if (!meta) {
            // Trigger fetch and close — will reopen when data arrives
            fetch(`/api/offerings?venueId=${selectedVenue.id}`)
              .then((r) => r.ok ? r.json() : { offerings: [] })
              .then((d) => {
                if (d.offerings?.length) {
                  const newMap: Record<string, OfferingMeta> = {};
                  for (const o of d.offerings) {
                    newMap[o.id] = { name: o.name, description: o.description, price_cents: o.price_cents, image_url: o.image_url || null, type: o.type, duration_minutes: o.duration_minutes };
                  }
                  setOfferingsMap((prev) => ({ ...prev, [selectedVenue.id]: { ...(prev[selectedVenue.id] || {}), ...newMap } }));
                  // Re-open drawer now that data is loaded
                  setDrawerOfferId(drawerOfferId);
                }
              })
              .catch(() => {});
            return null;
          }
          return (
            <ProductDrawer
              offer={{ id: drawerOfferId, name: meta.name, price: meta.price_cents }}
              meta={meta as SharedOfferingMeta}
              theme={selectedVenue.themeColor || "#F97316"}
              onClose={() => setDrawerOfferId(null)}
              onAdd={() => {
                setCarts((prev) => {
                  const next = new Map(prev);
                  const items = [...(next.get(selectedVenue.id) || [])];
                  const existing = items.find((i) => i.offeringId === drawerOfferId);
                  if (existing) existing.quantity += 1;
                  else items.push({ offeringId: drawerOfferId, name: meta.name, priceCents: meta.price_cents, quantity: 1 });
                  next.set(selectedVenue.id, items);
                  return next;
                });
                setDrawerOfferId(null);
              }}
              onAddWithMeta={(metadata) => {
                setCarts((prev) => {
                  const next = new Map(prev);
                  const items = [...(next.get(selectedVenue.id) || [])];
                  items.push({ offeringId: drawerOfferId, name: meta.name, priceCents: meta.price_cents, quantity: 1, metadata } as CartItem & { metadata: typeof metadata });
                  next.set(selectedVenue.id, items);
                  return next;
                });
                setDrawerOfferId(null);
              }}
              linkedStaff={[]}
              venueId={selectedVenue.id}
              user={user ? { id: user.authId, email: user.email } : null}
            />
          );
        })()}
      </AnimatePresence>
    </>
  );
}
