"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ── */
interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  card?: string;
}

/* ── The landing page IS a chat with KickBack ── */
const ACCENT = "#F97316";

const WELCOME_CARDS: Message[] = [
  {
    id: "hero",
    sender: "ai",
    body: "",
    card: "hero",
  },
  {
    id: "welcome",
    sender: "ai",
    body: "Hey. I'm KickBack — the digital front door for real-world venues. Every venue gets its own AI, every guest earns XP. No app download. Just pull up.",
  },
];

const QUICK_ACTIONS = [
  { label: "How does it work?", response: "Guests discover venues on a live map. Tap one — you're chatting with its AI. Ask about the vibe, menu, events, or reserve a booth. All from one conversation. Venue owners set up in 5 minutes — AI does the rest.", card: "how" },
  { label: "What do venues get?", response: "Your own AI agent that knows your menu, hours, and vibe. A live dashboard with occupancy, messages, and member management. Wallet passes for guests. XP roadmap for loyalty. Stripe payouts. All from one setup.", card: "venues" },
  { label: "What do guests get?", response: "A map of every venue around you. Chat with any of them. Earn XP everywhere you go — it all adds up to your KickBack Score. Redeem perks, collect venue badges, and never wonder 'what's the vibe?' again.", card: "guests" },
  { label: "Show me pricing", response: "Guests are always free. Venue owners start free and upgrade when ready.", card: "pricing" },
  { label: "I own a venue", response: "Let's get you set up. Takes 5 minutes — just tell your AI about your spot and it builds everything: menu, offerings, XP roadmap, milestones, perks. Zero manual work.", card: "owner" },
];

/* ── Card Components (mirrors the real app's card style) ── */

function HeroCard() {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${ACCENT}20` }}>
      <div
        className="relative flex items-end px-4 pb-4 pt-16"
        style={{ background: `linear-gradient(135deg, ${ACCENT}20 0%, ${ACCENT}06 50%, rgba(0,0,0,0.5) 100%)` }}
      >
        <div className="w-full">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT }}>
              <div className="h-1 w-1 animate-pulse rounded-full bg-black" />
              <span className="font-sans text-[8px] font-bold tracking-[1px] text-black">LIVE</span>
            </div>
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-white/40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
              Austin · Milwaukee · Expanding
            </span>
          </div>
          <h1 className="font-display text-[22px] font-bold leading-tight text-white sm:text-[28px]">
            theKickBack
          </h1>
          <p className="mt-1 font-sans text-[12px] text-white/45">
            The digital front door for real-world venues.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
        <span className="font-sans text-[8px] font-semibold tracking-[1px] text-white/20">NETWORK</span>
        <div className="flex items-center gap-3">
          <span className="font-sans text-[10px] text-white/30">Venues live</span>
          <span className="font-mono text-[10px] font-bold text-white/50">∞</span>
        </div>
      </div>
    </div>
  );
}

function HowCard() {
  const steps = [
    { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", label: "Discover", desc: "Live map of every venue around you" },
    { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", label: "Chat", desc: "Every venue has its own AI agent" },
    { icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", label: "Earn XP", desc: "Visit, order, refer — your score grows" },
    { icon: "M20 14H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z", label: "Wallet", desc: "Apple/Google Wallet passes, live updates" },
  ];
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">HOW IT WORKS</p>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}15` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
            </div>
            <div>
              <p className="font-sans text-[11px] font-semibold text-white/70">{s.label}</p>
              <p className="font-sans text-[9px] text-white/30">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenuesCard() {
  const features = [
    "AI agent that knows your menu, hours, vibe",
    "Live dashboard — occupancy, messages, members",
    "Offerings + POS — sell anything through chat",
    "XP roadmap + milestones — custom loyalty",
    "Wallet passes — your venue on their lock screen",
    "Stripe Connect — automatic payouts",
  ];
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">FOR VENUE OWNERS</p>
      <div className="flex flex-col gap-1.5">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-sans text-[10px] text-white/45">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestsCard() {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">FOR GUESTS</p>
      <div className="flex flex-col gap-2">
        {[
          { emoji: "🗺️", title: "Live Map", desc: "Every venue, color-coded by vibe" },
          { emoji: "💬", title: "Chat with Venues", desc: "Ask anything, book anything, order anything" },
          { emoji: "⚡", title: "Earn XP", desc: "Every visit, order, and referral counts" },
          { emoji: "🏆", title: "Collect Badges", desc: "Each venue has its own XP roadmap" },
          { emoji: "🎁", title: "Redeem Perks", desc: "Free drinks, priority access, members-only events" },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-2.5">
            <span className="text-[14px]">{item.emoji}</span>
            <div>
              <p className="font-sans text-[10px] font-semibold text-white/60">{item.title}</p>
              <p className="font-sans text-[9px] text-white/25">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingCard() {
  return (
    <div className="flex flex-col gap-2">
      {[
        { tier: "Free", price: "$0", features: ["1 venue", "AI agent", "Web chat", "100 interactions/mo"], highlight: false },
        { tier: "Pro", price: "$49", features: ["Unlimited interactions", "All channels", "Wallet passes", "Members", "10% fee"], highlight: true },
        { tier: "Network", price: "$99", features: ["Everything in Pro", "Map priority", "Cross-venue", "Insights", "7% fee"], highlight: false },
      ].map((p) => (
        <div
          key={p.tier}
          className="rounded-xl px-3 py-2.5"
          style={{
            backgroundColor: p.highlight ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
            border: `1px solid ${p.highlight ? `${ACCENT}30` : "rgba(255,255,255,0.05)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans text-[9px] font-semibold tracking-[1px]" style={{ color: p.highlight ? ACCENT : "rgba(255,255,255,0.25)" }}>{p.tier.toUpperCase()}</span>
              <span className="font-sans text-[16px] font-bold text-white">{p.price}</span>
              <span className="font-sans text-[9px] text-white/20">/mo</span>
            </div>
            {p.highlight && <span className="rounded-full px-2 py-0.5 font-sans text-[7px] font-bold" style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}>POPULAR</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.features.map((f) => (
              <span key={f} className="rounded-md px-1.5 py-0.5 font-sans text-[8px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>{f}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerCard() {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: `${ACCENT}06`, border: `1px solid ${ACCENT}15` }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px]" style={{ color: `${ACCENT}80` }}>GET STARTED</p>
      <p className="font-sans text-[11px] text-white/50">Tell your AI about your spot. It builds everything — menu, offerings, XP, milestones, perks. Zero manual work. Live in 5 minutes.</p>
      <a
        href="https://dash.thekickback.net"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[12px] font-bold text-black active:scale-[0.97]"
        style={{ backgroundColor: ACCENT }}
      >
        Set Up Your Venue
      </a>
      <p className="mt-2 text-center font-sans text-[8px] text-white/15">Free to start · No credit card · 5 minute setup</p>
    </div>
  );
}

const CARD_MAP: Record<string, () => React.ReactNode> = {
  hero: () => <HeroCard />,
  how: () => <HowCard />,
  venues: () => <VenuesCard />,
  guests: () => <GuestsCard />,
  pricing: () => <PricingCard />,
  owner: () => <OwnerCard />,
};

/* ═══ MAIN PAGE ═══ */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>(WELCOME_CARDS);
  const [showQuick, setShowQuick] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleQuick(action: typeof QUICK_ACTIONS[number]) {
    setShowQuick(false);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: "guest", body: action.label },
    ]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, sender: "ai", body: action.response, card: action.card },
      ]);
      setShowQuick(true);
    }, 600);
  }

  return (
    <main className="flex h-dvh w-full flex-col bg-black text-white">
      {/* Logo */}
      <div className="flex items-center justify-center pt-[max(10px,env(safe-area-inset-top))] pb-1">
        <Image src="/logo.png" alt="theKickBack" width={120} height={38} className="h-6 w-auto invert sm:h-8" priority />
      </div>

      {/* Chat area — fills the screen */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2.5">
          {messages.map((msg) => {
            if (msg.sender === "guest") {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5" style={{ backgroundColor: ACCENT, color: "#000" }}>
                    <p className="font-sans text-[13px] leading-[1.5] sm:text-[14px]">{msg.body}</p>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2"
              >
                {/* Card */}
                {msg.card && CARD_MAP[msg.card] && CARD_MAP[msg.card]()}

                {/* Text bubble */}
                {msg.body && (
                  <div className="flex justify-start">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <p className="font-sans text-[13px] leading-[1.5] sm:text-[14px]">{msg.body}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <AnimatePresence>
        {showQuick && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex gap-1.5 overflow-x-auto px-4 pb-2 no-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => handleQuick(q)}
                className="shrink-0 rounded-full px-3.5 py-2 font-sans text-[11px] font-medium text-white/40 active:scale-95 sm:text-[12px]"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {q.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock — matches the app's pill bar */}
      <div className="px-3 pb-[max(6px,env(safe-area-inset-bottom))]">
        <div
          className="flex items-center gap-2 rounded-full px-3"
          style={{
            height: 52,
            background: "rgba(15, 15, 18, 0.9)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 -4px 30px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="font-sans text-[12px] font-semibold text-white/80">KB</span>
          </div>

          <span className="flex-1 font-sans text-[12px] text-white/20">Ask about KickBack...</span>

          {/* CTAs */}
          <a
            href="https://join.thekickback.net"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-bold text-black sm:text-[11px]"
            style={{ backgroundColor: ACCENT }}
          >
            Explore Venues
          </a>
          <a
            href="https://dash.thekickback.net"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[10px] font-semibold text-white/50 sm:text-[11px]"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            I Own a Venue
          </a>
        </div>
      </div>
    </main>
  );
}
