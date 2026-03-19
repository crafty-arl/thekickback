"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

const PlayerWrapper = dynamic(
  () =>
    import("@/components/remotion/player-wrapper").then(
      (m) => m.PlayerWrapper
    ),
  { ssr: false }
);

const HeroComposition = dynamic(
  () =>
    import("@/components/remotion/hero-composition").then(
      (m) => m.HeroComposition
    ),
  { ssr: false }
);

type Screen =
  | "home"
  | "discover"
  | "talk"
  | "actions"
  | "network";

const SCREENS: {
  id: Screen;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: "talk",
    label: "Talk",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "actions",
    label: "Actions",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    id: "network",
    label: "Network",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" />
        <line x1="12" y1="8" x2="19" y2="16" />
      </svg>
    ),
  },
];

/* ── Interactive screen content panels ── */
function ScreenContent({ screen }: { screen: Screen }) {
  if (screen === "home") return null; // Remotion plays in bg

  const content: Record<Exclude<Screen, "home">, { title: string; subtitle: string; body: string; visual: React.ReactNode }> = {
    discover: {
      title: "See what's live around you.",
      subtitle: "DISCOVER",
      body: "Every dot is a venue. Every color is a vibe. Green means chill. Orange means it's poppin. Tap one and you're in.",
      visual: <DiscoverVisual />,
    },
    talk: {
      title: "Every venue has its own AI.",
      subtitle: "TALK TO IT",
      body: "Ask if there's space. Check the menu. Reserve a booth. The venue talks back — like a friend who works there.",
      visual: <TalkVisual />,
    },
    actions: {
      title: "Book. Meet. Greet.",
      subtitle: "DO THINGS",
      body: "One chat, endless actions. Check the vibe, browse the menu, see events, or lock down a reservation — all without leaving the conversation.",
      visual: <ActionsVisual />,
    },
    network: {
      title: "One identity. Every venue.",
      subtitle: "THE NETWORK",
      body: "Walk into any KickBack venue and you're already recognized. Your preferences travel with you. Your membership stacks. Just pull up.",
      visual: <NetworkVisual />,
    },
  };

  const c = content[screen];

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-[fadeIn_0.3s_ease-out]">
      <div className="flex w-full max-w-5xl flex-col items-center gap-6 px-6 md:flex-row md:gap-12 md:px-12">
        {/* Text side */}
        <div className="flex flex-1 flex-col gap-4 text-center md:text-left">
          <span className="font-sans text-[10px] font-semibold tracking-[2.5px] text-white/25 uppercase sm:text-xs">
            {c.subtitle}
          </span>
          <h2 className="font-display text-2xl font-semibold leading-[1.1] tracking-tight text-white sm:text-3xl md:text-5xl md:tracking-[-1.5px]">
            {c.title}
          </h2>
          <p className="max-w-md font-sans text-sm leading-[1.6] text-white/40 sm:text-base md:text-lg">
            {c.body}
          </p>
        </div>
        {/* Visual side */}
        <div className="flex flex-1 items-center justify-center">
          {c.visual}
        </div>
      </div>
    </div>
  );
}

/* ── Discover: interactive map preview ── */
function DiscoverVisual() {
  const markers = [
    { x: 25, y: 30, color: "#f97316", name: "The Rooftop", vibe: "Busy" },
    { x: 55, y: 50, color: "#4ade80", name: "Daily Grind", vibe: "Quiet" },
    { x: 75, y: 28, color: "#facc15", name: "Study Loft", vibe: "Moderate" },
    { x: 35, y: 68, color: "#f87171", name: "North House", vibe: "Lit" },
    { x: 65, y: 72, color: "#a78bfa", name: "The Yard", vibe: "Chill" },
  ];
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="relative aspect-[4/3] w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a1a] md:aspect-video md:max-w-[560px] md:rounded-3xl">
      {/* Grid */}
      {[25, 50, 75].map((p) => (
        <div key={p} className="absolute inset-x-0 h-px bg-white/[0.03]" style={{ top: `${p}%` }} />
      ))}
      {[33, 66].map((p) => (
        <div key={p} className="absolute inset-y-0 w-px bg-white/[0.03]" style={{ left: `${p}%` }} />
      ))}
      {/* Blocks */}
      {[
        { x: 10, y: 12, w: 16, h: 12 }, { x: 42, y: 8, w: 14, h: 16 },
        { x: 72, y: 45, w: 14, h: 10 }, { x: 15, y: 55, w: 18, h: 12 },
        { x: 55, y: 60, w: 12, h: 14 }, { x: 80, y: 15, w: 10, h: 12 },
      ].map((b, i) => (
        <div key={i} className="absolute rounded-sm border border-white/[0.02] bg-white/[0.02]" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} />
      ))}
      {/* Markers */}
      {markers.map((m, i) => (
        <button
          key={m.name}
          onClick={() => setSelected(i === selected ? null : i)}
          className="absolute flex flex-col items-center gap-1 transition-transform hover:scale-110"
          style={{ left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div
            className={`rounded-full transition-all ${i === selected ? "scale-125" : ""}`}
            style={{
              width: i === selected ? 16 : 12,
              height: i === selected ? 16 : 12,
              backgroundColor: m.color,
              boxShadow: `0 0 ${i === selected ? 16 : 8}px ${m.color}50`,
            }}
          />
          {i === selected && (
            <div className="rounded-md bg-black/70 px-2 py-0.5 backdrop-blur-sm">
              <span className="whitespace-nowrap font-sans text-[9px] font-semibold text-white sm:text-[10px]">{m.name}</span>
              <span className="ml-1 text-[8px] sm:text-[9px]" style={{ color: m.color }}>{m.vibe}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Talk: interactive drawer demo ── */
function TalkVisual() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3 md:max-w-[460px]">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-full border border-white/[0.08] bg-[rgba(15,15,18,0.9)] px-3.5 py-2.5 backdrop-blur-xl transition-all hover:border-white/15 sm:gap-3 sm:px-4 sm:py-3"
      >
        <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange shadow-[0_0_6px_#f9731650]" />
        <span className="font-sans text-xs font-semibold text-white sm:text-sm">The Rooftop</span>
        <div className="flex-1 rounded-xl bg-white/[0.04] px-3 py-1.5 text-left font-sans text-[10px] text-white/20 sm:text-xs">
          {expanded ? "Tap to collapse" : "Ask anything..."}
        </div>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`opacity-30 transition-transform ${expanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded drawer */}
      {expanded && (
        <div className="overflow-hidden rounded-t-2xl border border-white/[0.08] bg-[rgba(15,15,18,0.9)] backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-orange shadow-[0_0_6px_#f9731650]" />
            <div>
              <div className="font-sans text-xs font-semibold text-white sm:text-sm">The Rooftop</div>
              <div className="font-sans text-[9px] text-white/35 sm:text-[10px]">Busy · 72%</div>
            </div>
          </div>
          <div className="flex gap-1.5 px-3 pb-2 sm:gap-2">
            {["Chat", "Vibe", "Menu", "Events", "Reserve"].map((t, i) => (
              <div
                key={t}
                className={`rounded-md px-2 py-1 font-sans text-[9px] font-medium sm:text-[10px] ${
                  i === 0
                    ? "border border-orange/30 bg-orange/10 text-orange"
                    : "border border-white/[0.04] bg-white/[0.04] text-white/30"
                }`}
              >
                {t}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-3 pb-2">
            <div className="flex"><div className="rounded-xl rounded-bl-sm border border-white/[0.06] bg-white/[0.06] px-3 py-2 font-sans text-[10px] text-white/70 sm:text-xs">Welcome to The Rooftop. Busy tonight — 28 people.</div></div>
            <div className="flex justify-end"><div className="rounded-xl rounded-br-sm bg-orange px-3 py-2 font-sans text-[10px] text-black sm:text-xs">Any booths open?</div></div>
            <div className="flex"><div className="rounded-xl rounded-bl-sm border border-white/[0.06] bg-white/[0.06] px-3 py-2 font-sans text-[10px] text-white/70 sm:text-xs">Booth 4 is open. Want me to hold it?</div></div>
          </div>
          <div className="flex items-center gap-2 px-3 pb-3">
            <div className="flex-1 rounded-full bg-white/[0.04] px-3 py-2 font-sans text-[10px] text-white/15 sm:text-xs">Ask anything...</div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange shadow-[0_2px_8px_#f9731640]">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Actions: tab showcase ── */
function ActionsVisual() {
  const [active, setActive] = useState(0);
  const tabs = [
    { tab: "Vibe", desc: "What's the energy like right now?", color: "#4ade80", response: "It's a good night — busy but not packed. Music is chill, lights are low. Solid date spot energy." },
    { tab: "Menu", desc: "See what they're serving", color: "#facc15", response: "Tonight's specials: Smoked Old Fashioned ($14), Truffle Fries ($12), and the Rooftop Burger ($18). Kitchen closes at 11." },
    { tab: "Events", desc: "Anything happening tonight?", color: "#a78bfa", response: "Live jazz trio starting at 9 PM on the terrace. No cover charge. Gets busy around 9:30 so come early." },
    { tab: "Reserve", desc: "Lock down a table or booth", color: "#f97316", response: "I can hold Booth 4 (window, seats 4) or Table 12 (terrace, seats 2). Which one? Reply with your pick." },
  ];

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3 md:max-w-[460px]">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button
            key={t.tab}
            onClick={() => setActive(i)}
            className="rounded-lg px-3 py-1.5 font-sans text-xs font-semibold transition-all sm:text-sm"
            style={{
              backgroundColor: i === active ? `${t.color}20` : "rgba(255,255,255,0.04)",
              color: i === active ? t.color : "rgba(255,255,255,0.3)",
              border: `1px solid ${i === active ? `${t.color}30` : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {t.tab}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <p className="font-sans text-xs text-white/35 sm:text-sm">{tabs[active].desc}</p>
        <div className="mt-3 rounded-xl rounded-bl-sm border border-white/[0.06] bg-white/[0.06] px-3 py-2.5">
          <p className="font-sans text-xs leading-relaxed text-white/70 sm:text-sm">
            {tabs[active].response}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Network: connected nodes ── */
function NetworkVisual() {
  return (
    <div className="flex flex-col items-center gap-6">
      <svg width="100%" viewBox="0 0 300 120" className="max-w-[400px] md:max-w-[480px]">
        <line x1="50" y1="60" x2="110" y2="35" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="110" y1="35" x2="150" y2="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="150" y1="70" x2="190" y2="30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="190" y1="30" x2="250" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="110" y1="35" x2="190" y2="30" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <line x1="50" y1="60" x2="150" y2="70" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        {[
          { cx: 50, cy: 60, color: "#f97316", label: "The Rooftop" },
          { cx: 110, cy: 35, color: "#4ade80", label: "Daily Grind" },
          { cx: 150, cy: 70, color: "#facc15", label: "Study Loft" },
          { cx: 190, cy: 30, color: "#f87171", label: "North House" },
          { cx: 250, cy: 55, color: "#a78bfa", label: "The Yard" },
        ].map((n, i) => (
          <g key={i}>
            <circle cx={n.cx} cy={n.cy} r="12" fill={`${n.color}12`} />
            <circle cx={n.cx} cy={n.cy} r="5" fill={n.color} />
            <text x={n.cx} y={n.cy + 22} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="var(--font-dm-sans), system-ui, sans-serif">{n.label}</text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-2">
        {["Your identity travels", "Memberships stack", "No sign-ups needed"].map((t) => (
          <span
            key={t}
            className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 font-sans text-[10px] text-white/40 sm:text-xs"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN LANDING EXPERIENCE
   ═══════════════════════════════════════════════════ */
export function LandingExperience() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Remotion background — always running, full viewport */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${screen === "home" ? "opacity-100" : "opacity-30"}`}>
        <PlayerWrapper
          component={HeroComposition as React.ComponentType}
          durationInFrames={900}
          fps={30}
        />
      </div>

      {/* Logo — always visible */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-5 sm:pt-6">
        <Image
          src="/logo.png"
          alt="theKickBack"
          width={160}
          height={50}
          className="h-7 w-auto invert sm:h-9 md:h-10"
          priority
        />
      </div>

      {/* Screen overlay */}
      <ScreenContent screen={screen} />

      {/* Navigation bar — bottom, always visible */}
      <nav className="absolute inset-x-0 bottom-0 z-30 flex justify-center pb-4 sm:pb-6">
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[rgba(15,15,18,0.85)] px-2 py-2 backdrop-blur-xl sm:gap-2 sm:px-3">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[10px] font-medium transition-all sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs ${
                screen === s.id
                  ? "bg-orange text-black"
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
              }`}
            >
              <span className={screen === s.id ? "text-black" : "text-white/40"}>
                {s.icon}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* CTA — visible on home screen */}
      {screen === "home" && (
        <div className="absolute inset-x-0 bottom-20 z-20 flex justify-center sm:bottom-24">
          <a
            href="shortcuts://run-shortcut?name=Join%20theKickBack"
            className="flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sans text-xs font-semibold text-black transition-opacity hover:opacity-90 sm:gap-3 sm:px-6 sm:py-3 sm:text-sm"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Open theKickBack
          </a>
        </div>
      )}
    </div>
  );
}
