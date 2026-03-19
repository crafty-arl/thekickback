"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Screen = "home" | "map" | "venue" | "checkin" | "pricing";

const NAV: { id: Screen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "map", label: "Discover" },
  { id: "venue", label: "Talk" },
  { id: "checkin", label: "Check In" },
  { id: "pricing", label: "Pricing" },
];

/* ── Phone frame ── */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div
        className="overflow-hidden rounded-[28px] border-2 border-white/10"
        style={{ aspectRatio: "9/18", background: "#0A0A0A", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-black" />
        {children}
      </div>
    </div>
  );
}

/* ═══ SCREEN: Map ═══ */
function MapDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const venues = [
    { x: 30, y: 30, color: "#f97316", name: "The Rooftop", vibe: "Busy", pct: "72%" },
    { x: 65, y: 22, color: "#4ade80", name: "Daily Grind", vibe: "Quiet", pct: "27%" },
    { x: 45, y: 52, color: "#facc15", name: "Study Loft", vibe: "Moderate", pct: "45%" },
    { x: 75, y: 58, color: "#f87171", name: "North House", vibe: "Packed", pct: "90%" },
    { x: 22, y: 68, color: "#a78bfa", name: "The Den", vibe: "Quiet", pct: "24%" },
  ];

  return (
    <Phone>
      <div className="relative h-full w-full bg-[#111]">
        {/* Grid lines */}
        {[20, 40, 60, 80].map((p) => (
          <div key={`h${p}`} className="absolute inset-x-0 h-px bg-white/[0.03]" style={{ top: `${p}%` }} />
        ))}
        {[25, 50, 75].map((p) => (
          <div key={`v${p}`} className="absolute inset-y-0 w-px bg-white/[0.03]" style={{ left: `${p}%` }} />
        ))}

        {/* Venue dots */}
        {venues.map((v, i) => (
          <button
            key={v.name}
            onClick={() => setSelected(i === selected ? null : i)}
            className="absolute flex flex-col items-center transition-transform"
            style={{ left: `${v.x}%`, top: `${v.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              animate={{ scale: i === selected ? 1.4 : 1 }}
              className="rounded-full"
              style={{
                width: 14,
                height: 14,
                backgroundColor: v.color,
                boxShadow: `0 0 ${i === selected ? 16 : 8}px ${v.color}60`,
              }}
            />
            <AnimatePresence>
              {i === selected && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="mt-1.5 rounded-lg px-2.5 py-1"
                  style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <p className="whitespace-nowrap font-sans text-[10px] font-semibold text-white">{v.name}</p>
                  <p className="font-sans text-[8px]" style={{ color: v.color }}>{v.vibe} · {v.pct}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}

        {/* Command bar */}
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "rgba(15,15,18,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="h-2 w-2 rounded-full bg-[#a78bfa]" />
          <span className="font-sans text-[10px] font-semibold text-white/80">KB</span>
          <span className="flex-1 font-sans text-[9px] text-white/20">Where should I go?</span>
        </div>
      </div>
    </Phone>
  );
}

/* ═══ SCREEN: Venue Chat ═══ */
function VenueDemo() {
  const [msgs, setMsgs] = useState([
    { sender: "ai", text: "Welcome to The Rooftop. Busy tonight — 28 people." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickReplies = [
    { label: "Booths?", msg: "Any booths open?" },
    { label: "Menu", msg: "What's on the menu?" },
    { label: "Events", msg: "Any events tonight?" },
  ];

  const responses: Record<string, string> = {
    "Any booths open?": "Booth 4 by the window is open. Seats 4. Want me to hold it?",
    "What's on the menu?": "Tonight's specials: Smoked Old Fashioned ($14), Truffle Fries ($12), Rooftop Burger ($18).",
    "Any events tonight?": "Live jazz trio at 9 PM on the terrace. No cover. Gets busy around 9:30.",
  };

  function send(text: string) {
    if (loading) return;
    setMsgs((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      setMsgs((prev) => [...prev, { sender: "ai", text: responses[text] || "I can help with that. Let me check." }]);
      setLoading(false);
    }, 800);
  }

  return (
    <Phone>
      <div className="flex h-full flex-col bg-[#0A0A0A]">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-7 pb-2">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f97316]" style={{ boxShadow: "0 0 6px #f9731650" }} />
          <div>
            <p className="font-sans text-[11px] font-semibold text-white">The Rooftop</p>
            <p className="font-sans text-[8px] text-white/30">Busy · 72%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pb-2">
          {["Chat", "Vibe", "Menu", "Events"].map((t, i) => (
            <div
              key={t}
              className="rounded-md px-2 py-0.5 font-sans text-[8px] font-medium"
              style={{
                background: i === 0 ? "#f9731620" : "rgba(255,255,255,0.04)",
                color: i === 0 ? "#f97316" : "rgba(255,255,255,0.3)",
                border: `1px solid ${i === 0 ? "#f9731630" : "rgba(255,255,255,0.04)"}`,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="mx-3 h-px bg-white/[0.06]" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-col gap-2">
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-xl px-2.5 py-1.5 font-sans text-[9px] leading-[1.5]"
                  style={
                    m.sender === "user"
                      ? { background: "#f97316", color: "#000" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.05)" }
                  }
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex gap-1 px-2 py-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-white/30" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick replies */}
        <div className="flex gap-1.5 px-3 pb-1.5">
          {quickReplies.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.msg)}
              className="rounded-full px-2.5 py-1 font-sans text-[8px] font-medium text-white/40 active:scale-95"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-1.5 px-3 pb-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && send(input.trim())}
            placeholder="Ask anything..."
            className="flex-1 rounded-full bg-white/[0.04] px-3 py-1.5 font-sans text-[9px] text-white placeholder:text-white/20 focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          />
          <button
            onClick={() => input.trim() && send(input.trim())}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316] active:scale-90"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </Phone>
  );
}

/* ═══ SCREEN: Check In ═══ */
function CheckinDemo() {
  const [checked, setChecked] = useState(false);
  const [xp, setXp] = useState(0);

  function doCheckin() {
    setChecked(true);
    let count = 0;
    const interval = setInterval(() => {
      count += 2;
      setXp(Math.min(count, 50));
      if (count >= 50) clearInterval(interval);
    }, 30);
  }

  return (
    <Phone>
      <div className="flex h-full flex-col items-center justify-center bg-[#0A0A0A] px-6">
        <AnimatePresence mode="wait">
          {!checked ? (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-white/10">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <p className="font-sans text-[12px] text-white/40 text-center">Scan a venue QR code to check in and earn XP</p>
              <button
                onClick={doCheckin}
                className="rounded-xl bg-[#F97316] px-6 py-2.5 font-sans text-[11px] font-bold text-black active:scale-95"
              >
                Simulate Check-In
              </button>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 150 }}
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "#f9731620", border: "2px solid #f9731640" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
              <p className="font-sans text-[14px] font-bold text-white">You&apos;re in.</p>
              <p className="font-sans text-[10px] text-white/30">The Rooftop · Table 4</p>

              <div className="w-full rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-sans text-[8px] font-semibold tracking-[1.5px] text-white/25">XP EARNED</p>
                <p className="mt-1 font-mono text-[24px] font-bold text-[#f97316]">+{xp}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div animate={{ width: `${xp * 1.3}%` }} className="h-full rounded-full bg-[#4ade80]" />
                </div>
                <p className="mt-1 font-sans text-[8px] text-white/20">175 XP to Regular</p>
              </div>

              <button
                onClick={() => { setChecked(false); setXp(0); }}
                className="font-sans text-[10px] text-white/25 underline"
              >
                Reset demo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Phone>
  );
}

/* ═══ SCREEN: Pricing ═══ */
function PricingDemo() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 sm:grid-cols-3">
      {[
        { tier: "Free", price: "$0", desc: "Get started today", features: ["1 venue", "AI agent", "Web chat", "100 interactions/mo"], cta: "Get Started", highlight: false },
        { tier: "Pro", price: "$49", desc: "Everything you need", features: ["Unlimited interactions", "All channels", "Wallet passes", "Member management", "10% membership fee"], cta: "Start Free Trial", highlight: true },
        { tier: "Network", price: "$99", desc: "Maximum visibility", features: ["Everything in Pro", "Priority on map", "Cross-venue recognition", "Guest insights", "7% membership fee"], cta: "Contact Us", highlight: false },
      ].map((p) => (
        <div
          key={p.tier}
          className="flex flex-col rounded-2xl p-5 text-left"
          style={{
            background: p.highlight ? "rgba(249,115,22,0.06)" : "#111",
            border: p.highlight ? "2px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span className="font-sans text-[10px] font-semibold tracking-[1.5px]" style={{ color: p.highlight ? "#F97316" : "rgba(255,255,255,0.25)" }}>
            {p.tier.toUpperCase()}
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-sans text-[28px] font-bold text-white">{p.price}</span>
            <span className="font-sans text-[12px] text-white/30">/mo</span>
          </div>
          <p className="mt-1 font-sans text-[11px] text-white/35">{p.desc}</p>
          <div className="mt-4 flex flex-col gap-2">
            {p.features.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="font-sans text-[11px] text-white/50">{f}</span>
              </div>
            ))}
          </div>
          <button
            className="mt-5 rounded-xl py-2.5 font-sans text-[12px] font-bold active:scale-[0.97]"
            style={{
              background: p.highlight ? "#F97316" : "rgba(255,255,255,0.06)",
              color: p.highlight ? "#000" : "rgba(255,255,255,0.5)",
              border: p.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {p.cta}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══ CONTENT FOR EACH SCREEN ═══ */
const SCREENS: Record<Screen, { label: string; sub: string; body: string }> = {
  home: {
    label: "Find your spot.",
    sub: "KICKBACK",
    body: "Every venue has an AI. Every vibe has a color. Just open the map and pull up.",
  },
  map: {
    label: "Every dot is a venue.",
    sub: "DISCOVER",
    body: "Tap a dot to see the vibe, occupancy, and what's happening. The map is live.",
  },
  venue: {
    label: "Ask the venue anything.",
    sub: "TALK TO IT",
    body: "Check the menu. Reserve a booth. Ask about events. The venue's AI knows everything.",
  },
  checkin: {
    label: "Scan. Earn. Level up.",
    sub: "CHECK IN",
    body: "Scan the QR at any venue. Earn XP. Unlock perks. Snap your receipt for bonus points.",
  },
  pricing: {
    label: "Simple. Fair.",
    sub: "PRICING",
    body: "Guests always free. Venue owners start free and upgrade when ready.",
  },
};

/* ═══ MAIN PAGE ═══ */
export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const s = SCREENS[screen];

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-black text-white">
      {/* Logo */}
      <div className="flex justify-center pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <Image src="/logo.png" alt="theKickBack" width={120} height={38} className="h-6 w-auto invert sm:h-8" priority />
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="flex w-full flex-col items-center gap-6"
          >
            {/* Text */}
            <div className="text-center">
              <span className="font-sans text-[9px] font-semibold tracking-[2.5px] text-white/20 sm:text-[10px]">{s.sub}</span>
              <h1 className="mt-2 font-display text-[24px] font-semibold leading-tight tracking-tight sm:text-[32px] md:text-[40px]">{s.label}</h1>
              <p className="mx-auto mt-3 max-w-md font-sans text-[13px] leading-[1.6] text-white/40 sm:text-[15px]">{s.body}</p>
            </div>

            {/* Interactive demo */}
            <div className="w-full max-w-3xl">
              {screen === "home" && (
                <div className="flex justify-center">
                  <a
                    href="https://join.thekickback.net"
                    className="flex items-center gap-2 rounded-full bg-[#F97316] px-6 py-3 font-sans text-[13px] font-bold text-black active:scale-95 sm:text-[14px]"
                  >
                    Open theKickBack
                  </a>
                </div>
              )}
              {screen === "map" && <MapDemo />}
              {screen === "venue" && <VenueDemo />}
              {screen === "checkin" && <CheckinDemo />}
              {screen === "pricing" && <PricingDemo />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <nav className="flex justify-center pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center gap-1 rounded-full px-2 py-1.5 sm:gap-1.5 sm:px-3" style={{ background: "rgba(15,15,18,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              className="rounded-full px-3 py-1.5 font-sans text-[10px] font-medium transition-all sm:px-4 sm:py-2 sm:text-[11px]"
              style={{
                background: screen === n.id ? "#F97316" : "transparent",
                color: screen === n.id ? "#000" : "rgba(255,255,255,0.35)",
              }}
            >
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
