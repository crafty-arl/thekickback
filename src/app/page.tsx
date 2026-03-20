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

const ACCENT = "#F97316";

/* ── Knowledge base — the AI answers from this ── */
const KB_KNOWLEDGE: Record<string, string> = {
  "what is kickback": "KickBack is the digital front door for real-world venues. Every venue gets its own AI agent, every guest earns XP. No app download needed — works on web, email, and SMS.",
  "how does it work": "Guests discover venues on a live map. Tap one — you're chatting with its AI. Ask about the vibe, menu, events, or reserve a booth. All from one conversation. Venue owners set up in 5 minutes — AI builds everything.",
  "what do venues get": "Your own AI agent that knows your menu, hours, and vibe. A live dashboard with occupancy, messages, and member management. Wallet passes for guests. XP roadmap for loyalty. Stripe payouts. All from one setup.",
  "what do guests get": "A map of every venue around you. Chat with any of them. Earn XP everywhere you go — it all adds up to your KickBack Score. Redeem perks, collect venue badges, never wonder 'what's the vibe?' again.",
  "pricing": "Guests are always free. Venue owners: Free plan ($0) gets 1 venue + AI + 100 interactions. Pro ($49/mo) gets unlimited + all channels + wallet passes. Network ($99/mo) gets map priority + cross-venue recognition + insights.",
  "groups": "KickBack works for any gathering point — running clubs, book clubs, tech meetups, sports leagues, community orgs. Same dashboard, same AI, same XP system. It's not just venues, it's any third place where people come together.",
  "xp": "Every visit, order, referral, and interaction earns XP. Your KickBack Score is the total across all venues. Each venue also has its own XP roadmap with milestones and perks. Visit more, earn more, unlock more.",
  "wallet": "Guests get Apple or Google Wallet passes with live venue updates on their lock screen. When they redeem a perk, it becomes a wallet badge with a QR code the venue scans. No app needed.",
  "ai agent": "Every venue gets a dedicated AI agent powered by OpenClaw. It knows the menu, hours, vibe, and offerings. Guests chat naturally — 'any booths open?' — and the AI handles it. Venue owners customize the knowledge base from the dashboard.",
  "stripe": "Venue owners connect Stripe in 5 minutes. Guests pay through chat — the venue receives funds directly. Automatic payouts to your bank. Platform fee based on your plan (5-10%).",
  "get started": "Venue owners: go to dash.thekickback.net, tell the AI about your spot, and you're live in 5 minutes. Guests: go to join.thekickback.net and open the map. That's it.",
  "events": "Venues and groups can create events as offerings. Guests RSVP through chat, earn XP for attending, and get wallet pass reminders. Works for live music, workshops, meetups, game nights — anything.",
  "membership": "Venues set their own membership tiers with custom perks. Members earn bonus XP. Memberships are managed through the dashboard, billed through Stripe, and recognized across the network.",
};

function matchKnowledge(input: string): string {
  const lower = input.toLowerCase().replace(/[?!.,]/g, "");
  for (const [key, value] of Object.entries(KB_KNOWLEDGE)) {
    const words = key.split(" ");
    if (words.every((w) => lower.includes(w))) return value;
  }
  // Fuzzy match
  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) return KB_KNOWLEDGE["pricing"];
  if (lower.includes("venue") || lower.includes("owner") || lower.includes("business")) return KB_KNOWLEDGE["what do venues get"];
  if (lower.includes("guest") || lower.includes("user") || lower.includes("visitor")) return KB_KNOWLEDGE["what do guests get"];
  if (lower.includes("group") || lower.includes("club") || lower.includes("meetup") || lower.includes("league")) return KB_KNOWLEDGE["groups"];
  if (lower.includes("xp") || lower.includes("points") || lower.includes("earn") || lower.includes("loyalty")) return KB_KNOWLEDGE["xp"];
  if (lower.includes("wallet") || lower.includes("pass") || lower.includes("apple")) return KB_KNOWLEDGE["wallet"];
  if (lower.includes("ai") || lower.includes("agent") || lower.includes("chat")) return KB_KNOWLEDGE["ai agent"];
  if (lower.includes("pay") || lower.includes("stripe") || lower.includes("money")) return KB_KNOWLEDGE["stripe"];
  if (lower.includes("start") || lower.includes("sign up") || lower.includes("join") || lower.includes("setup")) return KB_KNOWLEDGE["get started"];
  if (lower.includes("event") || lower.includes("rsvp") || lower.includes("ticket")) return KB_KNOWLEDGE["events"];
  if (lower.includes("member")) return KB_KNOWLEDGE["membership"];
  if (lower.includes("how") || lower.includes("work")) return KB_KNOWLEDGE["how does it work"];
  if (lower.includes("what")) return KB_KNOWLEDGE["what is kickback"];
  return "I can tell you about how KickBack works, what venues and guests get, pricing, XP, groups, events, wallet passes, or the AI agent. What are you curious about?";
}

function getCardForQuery(input: string): string | undefined {
  const lower = input.toLowerCase();
  if (lower.includes("how") && lower.includes("work")) return "how";
  if (lower.includes("venue") || lower.includes("owner") || lower.includes("business")) return "venues";
  if (lower.includes("guest") || lower.includes("user") || lower.includes("visitor")) return "guests";
  if (lower.includes("price") || lower.includes("cost") || lower.includes("plan")) return "pricing";
  if (lower.includes("start") || lower.includes("sign") || lower.includes("setup") || lower.includes("own")) return "owner";
  return undefined;
}

/* ── Cards ── */

function HeroCard() {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${ACCENT}20` }}>
      <div className="relative flex items-end px-4 pb-4 pt-12 sm:px-6 sm:pt-16 md:pt-20" style={{ background: `linear-gradient(135deg, ${ACCENT}20 0%, ${ACCENT}06 50%, rgba(0,0,0,0.5) 100%)` }}>
        <div className="w-full">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT }}>
              <div className="h-1 w-1 animate-pulse rounded-full bg-black" />
              <span className="font-sans text-[8px] font-bold tracking-[1px] text-black">LIVE</span>
            </div>
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-white/40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>Austin · Milwaukee · Expanding</span>
          </div>
          <h1 className="font-display text-[22px] font-bold leading-tight text-white sm:text-[32px] md:text-[40px]">theKickBack</h1>
          <p className="mt-1 font-sans text-[12px] text-white/45 sm:text-[14px] md:text-[16px]">The digital front door for real-world venues.</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2 sm:px-6" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
        <span className="font-sans text-[8px] font-semibold tracking-[1px] text-white/20 sm:text-[9px]">VENUES · GROUPS · COMMUNITIES</span>
      </div>
    </div>
  );
}

function HowCard() {
  const steps = [
    { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", label: "Discover", desc: "Live map of every venue and group around you" },
    { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", label: "Chat", desc: "Every venue has its own AI agent" },
    { icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", label: "Earn XP", desc: "Visit, order, refer — your score grows" },
    { icon: "M20 14H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z", label: "Wallet", desc: "Apple/Google Wallet passes, live updates" },
  ];
  return (
    <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20 sm:text-[9px]">HOW IT WORKS</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10" style={{ backgroundColor: `${ACCENT}15` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
            </div>
            <div>
              <p className="font-sans text-[11px] font-semibold text-white/70 sm:text-[12px]">{s.label}</p>
              <p className="font-sans text-[9px] text-white/30 sm:text-[10px]">{s.desc}</p>
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
    "Works for venues, groups, clubs, and orgs",
  ];
  return (
    <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20 sm:text-[9px]">FOR VENUE OWNERS & ORGANIZERS</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
            <span className="font-sans text-[10px] text-white/45 sm:text-[11px]">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestsCard() {
  return (
    <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20 sm:text-[9px]">FOR GUESTS</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { emoji: "🗺️", title: "Live Map", desc: "Every venue, color-coded by vibe" },
          { emoji: "💬", title: "Chat with Venues", desc: "Ask anything, book anything" },
          { emoji: "⚡", title: "Earn XP", desc: "Every visit and order counts" },
          { emoji: "🏆", title: "Collect Badges", desc: "Each venue has its own roadmap" },
          { emoji: "🎁", title: "Redeem Perks", desc: "Free drinks, priority access" },
          { emoji: "👥", title: "Join Groups", desc: "Running clubs, book clubs, leagues" },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-2.5">
            <span className="text-[14px] sm:text-[16px]">{item.emoji}</span>
            <div>
              <p className="font-sans text-[10px] font-semibold text-white/60 sm:text-[11px]">{item.title}</p>
              <p className="font-sans text-[9px] text-white/25 sm:text-[10px]">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingCard() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {[
        { tier: "Free", price: "$0", features: ["1 venue", "AI agent", "Web chat", "100 interactions/mo"], highlight: false },
        { tier: "Pro", price: "$49", features: ["Unlimited interactions", "All channels", "Wallet passes", "Members", "10% fee"], highlight: true },
        { tier: "Network", price: "$99", features: ["Everything in Pro", "Map priority", "Cross-venue", "Insights", "7% fee"], highlight: false },
      ].map((p) => (
        <div
          key={p.tier}
          className="rounded-xl px-3 py-2.5 sm:px-4 sm:py-3"
          style={{
            backgroundColor: p.highlight ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
            border: `1px solid ${p.highlight ? `${ACCENT}30` : "rgba(255,255,255,0.05)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans text-[9px] font-semibold tracking-[1px] sm:text-[10px]" style={{ color: p.highlight ? ACCENT : "rgba(255,255,255,0.25)" }}>{p.tier.toUpperCase()}</span>
              <span className="font-sans text-[18px] font-bold text-white sm:text-[22px]">{p.price}</span>
              <span className="font-sans text-[9px] text-white/20">/mo</span>
            </div>
            {p.highlight && <span className="rounded-full px-2 py-0.5 font-sans text-[7px] font-bold sm:text-[8px]" style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}>POPULAR</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.features.map((f) => (
              <span key={f} className="rounded-md px-1.5 py-0.5 font-sans text-[8px] text-white/30 sm:text-[9px]" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>{f}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerCard() {
  return (
    <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: `${ACCENT}06`, border: `1px solid ${ACCENT}15` }}>
      <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] sm:text-[9px]" style={{ color: `${ACCENT}80` }}>GET STARTED</p>
      <p className="font-sans text-[11px] text-white/50 sm:text-[13px]">Tell your AI about your spot. It builds everything — menu, offerings, XP, milestones, perks. Zero manual work. Live in 5 minutes.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a href="https://dash.thekickback.net" className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[12px] font-bold text-black active:scale-[0.97] sm:text-[13px]" style={{ backgroundColor: ACCENT }}>
          Set Up Your Venue
        </a>
        <a href="https://join.thekickback.net" className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[12px] font-semibold text-white/50 active:scale-[0.97] sm:text-[13px]" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          Explore as a Guest
        </a>
      </div>
      <p className="mt-2 text-center font-sans text-[8px] text-white/15 sm:text-[9px]">Free to start · No credit card · 5 minute setup</p>
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

const QUICK_ACTIONS = [
  "How does it work?",
  "What do venues get?",
  "What do guests get?",
  "Pricing",
  "Groups & clubs",
  "I own a venue",
];

/* ═══ MAIN ═══ */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "hero", sender: "ai", body: "", card: "hero" },
    { id: "welcome", sender: "ai", body: "Hey. I'm KickBack — the digital front door for real-world venues and groups. Every spot gets its own AI. Every guest earns XP. Ask me anything or pick a topic below." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "guest", body: msg }]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const reply = matchKnowledge(msg);
      const card = getCardForQuery(msg);
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: "ai", body: reply, card }]);
      setLoading(false);
    }, 500);
  }

  return (
    <main className="flex h-dvh w-full flex-col bg-black text-white">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 pt-[max(10px,env(safe-area-inset-top))] pb-1 sm:px-8">
        <Image src="/logo.png" alt="theKickBack" width={140} height={44} className="h-6 w-auto invert sm:h-8 md:h-9" priority />
        <div className="hidden items-center gap-3 sm:flex">
          <a href="https://join.thekickback.net" className="font-sans text-[12px] text-white/40 transition hover:text-white/60">Explore</a>
          <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 font-sans text-[12px] font-semibold text-black" style={{ backgroundColor: ACCENT }}>Dashboard</a>
        </div>
      </div>

      {/* Chat — responsive max-width */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-8 md:px-12" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
          {messages.map((msg) => {
            if (msg.sender === "guest") {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 sm:max-w-[70%]" style={{ backgroundColor: ACCENT, color: "#000" }}>
                    <p className="font-sans text-[13px] leading-[1.5] sm:text-[14px]">{msg.body}</p>
                  </div>
                </motion.div>
              );
            }
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
                {msg.card && CARD_MAP[msg.card] && CARD_MAP[msg.card]()}
                {msg.body && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 sm:max-w-[70%]" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <p className="font-sans text-[13px] leading-[1.5] sm:text-[14px]">{msg.body}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-2 w-2 rounded-full bg-white/30" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 no-scrollbar sm:justify-center sm:px-8" style={{ WebkitOverflowScrolling: "touch" }}>
        {QUICK_ACTIONS.map((q) => (
          <button key={q} onClick={() => send(q)} className="shrink-0 rounded-full px-3.5 py-2 font-sans text-[11px] font-medium text-white/40 active:scale-95 sm:text-[12px]" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {q}
          </button>
        ))}
      </div>

      {/* Dock */}
      <div className="px-3 pb-[max(6px,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full px-3 sm:px-4" style={{ height: 52, background: "rgba(15,15,18,0.9)", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 -4px 30px rgba(0,0,0,0.3)" }}>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="font-sans text-[12px] font-semibold text-white/80">KB</span>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about KickBack..."
            className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/20 focus:outline-none sm:text-[14px]"
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30 sm:h-9 sm:w-9" style={{ backgroundColor: ACCENT }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
          <div className="hidden shrink-0 items-center gap-2 pl-2 sm:flex">
            <a href="https://join.thekickback.net" className="rounded-full px-3 py-1.5 font-sans text-[10px] font-bold text-black sm:text-[11px]" style={{ backgroundColor: ACCENT }}>Explore Venues</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-3 py-1.5 font-sans text-[10px] font-semibold text-white/50 sm:text-[11px]" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>I Own a Venue</a>
          </div>
        </div>
      </div>
    </main>
  );
}
