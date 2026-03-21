"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";
import Lenis from "lenis";
import { useLiveStats } from "@/lib/use-live-stats";
import type { VenueData } from "@/lib/fetch-venues";

/* ─── Animated counter ─── */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const end = value;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (ref.current) {
        ref.current.textContent = Math.round(eased * end) + suffix;
      }
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ─── Vibe dot color ─── */
function vibeColor(vibe: string) {
  switch (vibe) {
    case "quiet": return "#4ade80";
    case "moderate": return "#facc15";
    case "busy": return "#f97316";
    case "lit": case "packed": return "#f87171";
    default: return "#9ca3af";
  }
}

/* ─── Tier definitions for the about section ─── */
const TIERS = [
  { name: "Explorer", range: "0 – 499", color: "#94a3b8", emoji: "🧭", description: "You've just arrived. Start visiting venues to grow your score." },
  { name: "Regular", range: "500 – 1,999", color: "#4ade80", emoji: "🎯", description: "The city knows you. Unlocks venue perks, collectibles, and priority check-ins." },
  { name: "Member", range: "2,000 – 4,999", color: "#f97316", emoji: "⚡", description: "You're a fixture. VIP access, exclusive badges, and hub owner attention." },
  { name: "VIP", range: "5,000+", color: "#a78bfa", emoji: "👑", description: "You define the vibe. Shape neighborhoods. The map literally shows your influence." },
];

/* ─── Main Component ─── */
export function LandingPage({ venues }: { venues: VenueData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stats = useLiveStats();

  // Smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Parallax scroll tracking
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Hero parallax layers
  const heroY1 = useTransform(smoothProgress, [0, 0.15], [0, -120]);
  const heroY2 = useTransform(smoothProgress, [0, 0.15], [0, -200]);
  const heroY3 = useTransform(smoothProgress, [0, 0.15], [0, -300]);
  const heroScale = useTransform(smoothProgress, [0, 0.08], [1, 1.05]);
  const heroOpacity = useTransform(smoothProgress, [0.08, 0.18], [1, 0]);

  // Section reveals
  const aboutY = useTransform(smoothProgress, [0.12, 0.25], [100, 0]);
  const aboutOpacity = useTransform(smoothProgress, [0.12, 0.22], [0, 1]);
  const venuesSectionY = useTransform(smoothProgress, [0.35, 0.5], [100, 0]);
  const venuesSectionOpacity = useTransform(smoothProgress, [0.35, 0.45], [0, 1]);
  const ctaY = useTransform(smoothProgress, [0.7, 0.85], [80, 0]);
  const ctaOpacity = useTransform(smoothProgress, [0.7, 0.8], [0, 1]);

  const displayStats = {
    totalVenues: stats?.totalVenues ?? venues.length,
    totalPeopleOut: stats?.totalPeopleOut ?? venues.reduce((s, v) => s + v.occupancy, 0),
    recentCheckins: stats?.recentCheckins ?? 0,
    trending: stats?.trending ?? [],
    vibeBreakdown: stats?.vibeBreakdown ?? { quiet: 0, moderate: 0, busy: 0, lit: 0 },
  };

  return (
    <div ref={containerRef} className="relative bg-black text-white">
      {/* ════════════════════════════════════════
          SECTION 1 — HERO: "So what's your KickBack Score?"
          ════════════════════════════════════════ */}
      <section className="relative h-[180vh] overflow-hidden">
        <div className="sticky top-0 h-dvh overflow-hidden">

          {/* Layer 1 — Deep background gradient */}
          <motion.div
            style={{ y: heroY1, scale: heroScale }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0012] via-[#1a0030] to-[#0d001a]" />
            <div className="absolute left-1/4 top-1/3 h-[600px] w-[600px] rounded-full bg-purple-600/20 blur-[150px]" />
            <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-orange-500/15 blur-[120px]" />
          </motion.div>

          {/* Layer 2 — City silhouette */}
          <motion.div
            style={{ y: heroY2 }}
            className="absolute inset-x-0 bottom-0"
          >
            <div className="relative h-[45vh]">
              <div className="absolute bottom-0 left-[5%] h-[70%] w-[8%] bg-gradient-to-t from-[#1a1a2e] to-[#16162a] rounded-t-sm opacity-80" />
              <div className="absolute bottom-0 left-[15%] h-[85%] w-[5%] bg-gradient-to-t from-[#1a1a2e] to-[#0f0f23] rounded-t-sm opacity-70">
                <div className="absolute right-0 top-[10%] h-[15%] w-[40%] bg-gradient-to-t from-[#1a1a2e] to-[#0f0f23] rounded-t-sm" />
              </div>
              <div className="absolute bottom-0 left-[22%] h-[55%] w-[10%] bg-gradient-to-t from-[#1a1a2e] to-[#12122b] rounded-t-sm opacity-75" />
              <div className="absolute bottom-0 left-[35%] h-[90%] w-[4%] bg-gradient-to-t from-[#1a1a2e] to-[#0d0d20] rounded-t-sm opacity-85" />
              <div className="absolute bottom-0 left-[40%] h-[60%] w-[12%] bg-gradient-to-t from-[#1a1a2e] to-[#131330] rounded-t-sm opacity-65" />
              <div className="absolute bottom-0 right-[30%] h-[95%] w-[3%] bg-gradient-to-t from-[#1a1a2e] to-[#0a0a1e] rounded-t-sm opacity-90" />
              <div className="absolute bottom-0 right-[20%] h-[50%] w-[14%] bg-gradient-to-t from-[#1a1a2e] to-[#151530] rounded-t-sm opacity-60" />
              <div className="absolute bottom-0 right-[8%] h-[75%] w-[6%] bg-gradient-to-t from-[#1a1a2e] to-[#111128] rounded-t-sm opacity-80" />
              <div className="absolute bottom-0 right-[0%] h-[65%] w-[9%] bg-gradient-to-t from-[#1a1a2e] to-[#0e0e25] rounded-t-sm opacity-70" />

              {/* Window lights */}
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute h-[2px] w-[3px] rounded-full"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    bottom: `${5 + Math.random() * 60}%`,
                    backgroundColor: Math.random() > 0.6 ? "#fbbf24" : Math.random() > 0.3 ? "#f97316" : "#a78bfa",
                    opacity: 0.4 + Math.random() * 0.6,
                    boxShadow: `0 0 ${3 + Math.random() * 4}px currentColor`,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Layer 3 — Foreground content */}
          <motion.div
            style={{ y: heroY3, opacity: heroOpacity }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Image
                src="/logo.png"
                alt="theKickBack"
                width={500}
                height={250}
                className="h-20 w-auto drop-shadow-2xl sm:h-28 md:h-32"
                style={{ filter: "invert(1)" }}
                priority
              />
            </motion.div>

            {/* Hero tagline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="mt-6 max-w-lg text-center font-[family-name:var(--font-fraunces)] text-3xl font-bold tracking-tight sm:text-5xl"
            >
              So what&apos;s your{" "}
              <span className="bg-gradient-to-r from-[#a78bfa] via-[#f97316] to-[#4ade80] bg-clip-text text-transparent">
                KickBack Score
              </span>
              ?
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              className="mt-3 max-w-sm text-center font-sans text-base font-light text-white/50 sm:text-lg"
            >
              Your reputation across every venue, neighborhood, and vibe in the city.
            </motion.p>

            {/* Live stats pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                <span className="text-sm text-white/80">
                  <strong className="text-white"><AnimatedNumber value={displayStats.totalVenues} /></strong> venues live
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <span className="text-sm text-white/80">
                  <strong className="text-white"><AnimatedNumber value={displayStats.totalPeopleOut} /></strong> building their score
                </span>
              </div>
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute bottom-8 flex flex-col items-center gap-2"
            >
              <span className="text-xs font-light tracking-[0.3em] uppercase text-white/30">What is it?</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="h-8 w-[1px] bg-gradient-to-b from-white/40 to-transparent"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 2 — ABOUT: What your KickBack Score defines
          ════════════════════════════════════════ */}
      <motion.section
        style={{ y: aboutY, opacity: aboutOpacity }}
        className="relative z-10 px-6 py-24 sm:px-12"
      >
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[200px]" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight sm:text-5xl">
              Your score is your <span className="text-[#a78bfa]">place</span> in the city
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/50 sm:text-lg leading-relaxed">
              Every check-in, every event, every venue you support adds to your KickBack Score.
              It&apos;s not just a number — it defines your tier, unlocks collectibles, and shapes the
              neighborhoods you care about.
            </p>
          </motion.div>

          {/* How it builds */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-16"
          >
            <h3 className="text-center text-sm font-medium uppercase tracking-[0.25em] text-white/30">
              How your score builds
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { icon: "📍", label: "Check in", detail: "Visit venues IRL" },
                { icon: "⭐", label: "Earn XP", detail: "Every action counts" },
                { icon: "🔥", label: "Keep streaks", detail: "Consistency rewards" },
                { icon: "🏅", label: "Collect badges", detail: "Show your status" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex flex-col items-center rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5 text-center backdrop-blur-sm"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="mt-2 text-sm font-semibold text-white/80">{item.label}</span>
                  <span className="mt-0.5 text-xs text-white/30">{item.detail}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tier breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16"
          >
            <h3 className="text-center text-sm font-medium uppercase tracking-[0.25em] text-white/30">
              What your score unlocks
            </h3>
            <div className="mt-6 space-y-3">
              {TIERS.map((tier, i) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 backdrop-blur-sm"
                >
                  <span className="text-2xl">{tier.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: tier.color }}>{tier.name}</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30">{tier.range}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-white/40">{tier.description}</p>
                  </div>
                  {/* Progress glow */}
                  <div className="h-8 w-1 rounded-full" style={{ backgroundColor: `${tier.color}30`, boxShadow: `0 0 12px ${tier.color}20` }} />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* The flywheel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-16 rounded-2xl border border-[#a78bfa]/15 bg-[#a78bfa]/[0.04] px-6 py-8 text-center sm:px-10"
          >
            <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold tracking-tight sm:text-2xl">
              The higher your score, the more the city gives back
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/40 leading-relaxed">
              Collect stickers and 3D pins to decorate your neighborhood on the map.
              Earn perks from the spots you love. Hit VIP and the people behind the counter know your name.
              When you support a venue, they get seen by more people too. That&apos;s the whole point.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {["🏷️ Stickers", "🏅 Badges", "📌 3D Pins", "🎁 Perks", "👑 VIP Access"].map((item) => (
                <span key={item} className="rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 px-3 py-1.5 text-xs font-medium text-[#a78bfa]">
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════
          SECTION 3 — VENUE SHOWCASE: Where scores are earned
          ════════════════════════════════════════ */}
      <motion.section
        style={{ y: venuesSectionY, opacity: venuesSectionOpacity }}
        className="relative z-10 px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight sm:text-5xl">
              Where scores are earned
            </h2>
            <p className="mt-3 max-w-lg text-base text-white/50">
              Real spots run by real people. Every visit builds your reputation —
              and helps the places you love get discovered by more people like you.
            </p>
          </motion.div>

          {/* Venue cards */}
          <div className="mt-12 -mx-6 px-6 overflow-x-auto no-scrollbar">
            <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
              {venues.map((venue, i) => (
                <motion.div
                  key={venue.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="group relative flex w-[280px] shrink-0 flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/[0.06] sm:w-[320px]"
                >
                  {/* Vibe indicator */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                      {venue.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: vibeColor(venue.vibe) }}
                      />
                      <span className="text-xs capitalize text-white/50">{venue.vibe}</span>
                    </div>
                  </div>

                  {/* Venue name */}
                  <h3 className="mt-3 font-[family-name:var(--font-fraunces)] text-xl font-semibold tracking-tight">
                    {venue.name}
                  </h3>
                  <p className="mt-1 text-sm text-white/40">{venue.neighborhood}</p>

                  {/* Occupancy bar */}
                  <div className="mt-4 flex-1">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>{venue.occupancy} people</span>
                      <span>{venue.capacity} capacity</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min(100, Math.round((venue.occupancy / venue.capacity) * 100))}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.08, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: vibeColor(venue.vibe) }}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  {venue.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/30">
                      {venue.description}
                    </p>
                  )}

                  <div
                    className="absolute bottom-0 left-5 right-5 h-[2px] rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: venue.themeColor }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Live stats row */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {[
              { label: "Venues Live", value: displayStats.totalVenues, color: "#4ade80" },
              { label: "People Out", value: displayStats.totalPeopleOut, color: "#f97316" },
              { label: "Check-ins This Hour", value: displayStats.recentCheckins, color: "#a78bfa" },
              { label: "Quiet Spots", value: displayStats.vibeBreakdown.quiet, color: "#4ade80" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <div className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: stat.color }}>
                  <AnimatedNumber value={stat.value} />
                </div>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════
          SECTION 4 — RUN A SPOT? (operator voice)
          ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 py-24 sm:px-12">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-1/4 top-1/2 h-[500px] w-[500px] rounded-full bg-orange-500/8 blur-[180px]" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight sm:text-5xl">
              Run a spot?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/50 leading-relaxed">
              You already pour your heart into your place. KickBack just makes sure people know about it.
              When your guests build their score at your venue, your spot shows up on the map,
              in conversations, and in their neighborhood. No ad budget needed — just happy regulars doing what they do.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { emoji: "📊", title: "See who shows up", desc: "Real-time vibes, not guesswork. Know when you're busy, quiet, or trending." },
              { emoji: "🎨", title: "Make it yours", desc: "Create custom badges, stickers, and perks your guests actually want to collect." },
              { emoji: "📣", title: "Free word of mouth", desc: "Every sticker placed on the map is a shoutout. Your regulars become your marketing team." },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center backdrop-blur-sm"
              >
                <span className="text-3xl">{card.emoji}</span>
                <h3 className="mt-3 text-sm font-semibold text-white/80">{card.title}</h3>
                <p className="mt-1.5 text-xs text-white/35 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center text-sm text-white/30 italic"
          >
            &ldquo;We didn&apos;t run a single ad. Our guests just kept putting stickers on the map and people started showing up.&rdquo;
          </motion.p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 5 — CTA: Dual path
          ════════════════════════════════════════ */}
      <motion.section
        style={{ y: ctaY, opacity: ctaOpacity }}
        className="relative z-10 flex flex-col items-center justify-center px-6 py-32 text-center"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 bottom-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-orange-500/15 blur-[200px]" />
          <div className="absolute left-1/3 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[180px]" />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative font-[family-name:var(--font-fraunces)] text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Ready to find out?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative mt-4 max-w-md text-lg text-white/50"
        >
          Whether you&apos;re exploring the city or running a favorite spot — this is where it starts.
        </motion.p>

        {/* Dual buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200 }}
          className="relative mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link
            href="/map"
            className="group inline-flex items-center gap-3 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/15 px-8 py-4 text-lg font-semibold backdrop-blur-md transition-all hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/25 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span className="bg-gradient-to-r from-[#a78bfa] to-white bg-clip-text text-transparent">
              Find out your score
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>

          <Link
            href="/login"
            className="group inline-flex items-center gap-3 rounded-full border border-[#f97316]/25 bg-[#f97316]/10 px-8 py-4 text-lg font-semibold backdrop-blur-md transition-all hover:border-[#f97316]/40 hover:bg-[#f97316]/20 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span className="bg-gradient-to-r from-[#f97316] to-white bg-clip-text text-transparent">
              Bring your spot on
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </Link>
        </motion.div>

        {/* Live indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative mt-8 flex items-center gap-2"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="text-sm text-white/40">
            {displayStats.totalVenues} spots already on the map
          </span>
        </motion.div>
      </motion.section>

      {/* Bottom padding */}
      <div className="h-20" />
    </div>
  );
}
