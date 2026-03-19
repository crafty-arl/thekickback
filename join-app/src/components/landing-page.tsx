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
      // ease-out cubic
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

  // Hero parallax layers — different speeds
  const heroY1 = useTransform(smoothProgress, [0, 0.3], [0, -120]); // slowest — far bg
  const heroY2 = useTransform(smoothProgress, [0, 0.3], [0, -200]); // mid
  const heroY3 = useTransform(smoothProgress, [0, 0.3], [0, -300]); // foreground
  const heroScale = useTransform(smoothProgress, [0, 0.15], [1, 1.05]);
  const heroOpacity = useTransform(smoothProgress, [0.15, 0.3], [1, 0]);

  // Section reveals
  const venuesSectionY = useTransform(smoothProgress, [0.15, 0.35], [100, 0]);
  const venuesSectionOpacity = useTransform(smoothProgress, [0.15, 0.3], [0, 1]);
  const ctaY = useTransform(smoothProgress, [0.6, 0.8], [80, 0]);
  const ctaOpacity = useTransform(smoothProgress, [0.6, 0.75], [0, 1]);

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
          SECTION 1 — HERO with parallax layers
          ════════════════════════════════════════ */}
      <section className="relative h-[200vh] overflow-hidden">
        {/* Sticky container */}
        <div className="sticky top-0 h-dvh overflow-hidden">

          {/* Layer 1 — Deep background gradient (slowest) */}
          <motion.div
            style={{ y: heroY1, scale: heroScale }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0012] via-[#1a0030] to-[#0d001a]" />
            {/* Glow orbs */}
            <div className="absolute left-1/4 top-1/3 h-[600px] w-[600px] rounded-full bg-purple-600/20 blur-[150px]" />
            <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-orange-500/15 blur-[120px]" />
          </motion.div>

          {/* Layer 2 — City silhouette (mid speed) */}
          <motion.div
            style={{ y: heroY2 }}
            className="absolute inset-x-0 bottom-0"
          >
            {/* Stylized skyline using CSS shapes */}
            <div className="relative h-[45vh]">
              {/* Buildings — using box shadows and gradients */}
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

              {/* Window lights — scattered dots on buildings */}
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

          {/* Layer 3 — Foreground content (fastest parallax) */}
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
                className="h-24 w-auto drop-shadow-2xl sm:h-32 md:h-40"
                style={{ filter: "invert(1)" }}
                priority
              />
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="mt-4 max-w-md text-center font-sans text-lg font-light tracking-wide text-white/70 sm:text-xl"
            >
              Discover what&apos;s happening right now
            </motion.p>

            {/* Live stats pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
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
                  <strong className="text-white"><AnimatedNumber value={displayStats.totalPeopleOut} /></strong> people out
                </span>
              </div>
              {displayStats.recentCheckins > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                  <span className="text-sm text-white/80">
                    <strong className="text-white"><AnimatedNumber value={displayStats.recentCheckins} /></strong> check-ins this hour
                  </span>
                </div>
              )}
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute bottom-8 flex flex-col items-center gap-2"
            >
              <span className="text-xs font-light tracking-[0.3em] uppercase text-white/30">Scroll</span>
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
          SECTION 2 — VENUE SHOWCASE (live data)
          ════════════════════════════════════════ */}
      <motion.section
        style={{ y: venuesSectionY, opacity: venuesSectionOpacity }}
        className="relative z-10 px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight sm:text-5xl">
              The city is alive
            </h2>
            <p className="mt-3 max-w-lg text-base text-white/50">
              Real venues. Real vibes. Real-time occupancy from people actually there.
            </p>
          </motion.div>

          {/* Venue cards — horizontal scroll */}
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

                  {/* Theme color accent line */}
                  <div
                    className="absolute bottom-0 left-5 right-5 h-[2px] rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: venue.themeColor }}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════
          SECTION 3 — ACTIVITY PULSE
          ════════════════════════════════════════ */}
      <section className="relative z-10 overflow-hidden px-6 py-24 sm:px-12">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[200px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight sm:text-5xl">
              Right now
            </h2>
            <p className="mt-3 max-w-lg text-base text-white/50">
              Live pulse from the city. Updated in real time.
            </p>
          </motion.div>

          {/* Stats grid */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
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
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm"
              >
                <div
                  className="text-3xl font-bold tracking-tight sm:text-4xl"
                  style={{ color: stat.color }}
                >
                  <AnimatedNumber value={stat.value} />
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Trending venues */}
          {displayStats.trending.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10"
            >
              <h3 className="text-sm font-medium uppercase tracking-wider text-white/40">
                Trending now
              </h3>
              <div className="mt-4 space-y-2">
                {displayStats.trending.map((venue, i) => (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white/20">{i + 1}</span>
                      <div>
                        <p className="font-medium">{venue.name}</p>
                        <p className="text-xs text-white/40">{venue.neighborhood}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: vibeColor(venue.vibe) }}
                      />
                      <span className="text-sm text-white/60">{venue.occupancy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Vibe breakdown bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10"
          >
            <h3 className="text-sm font-medium uppercase tracking-wider text-white/40">
              City vibe
            </h3>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/5">
              {(() => {
                const total = displayStats.vibeBreakdown.quiet + displayStats.vibeBreakdown.moderate + displayStats.vibeBreakdown.busy + displayStats.vibeBreakdown.lit;
                if (total === 0) return null;
                return (
                  <>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(displayStats.vibeBreakdown.quiet / total) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-green-400"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(displayStats.vibeBreakdown.moderate / total) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
                      className="h-full bg-yellow-400"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(displayStats.vibeBreakdown.busy / total) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                      className="h-full bg-orange-500"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(displayStats.vibeBreakdown.lit / total) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                      className="h-full bg-red-400"
                    />
                  </>
                );
              })()}
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-white/30">
              <span>Quiet</span>
              <span>Moderate</span>
              <span>Busy</span>
              <span>Lit</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 4 — CTA → Enter the map
          ════════════════════════════════════════ */}
      <motion.section
        style={{ y: ctaY, opacity: ctaOpacity }}
        className="relative z-10 flex flex-col items-center justify-center px-6 py-32 text-center"
      >
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 bottom-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-orange-500/15 blur-[200px]" />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative font-[family-name:var(--font-fraunces)] text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Pull up
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative mt-4 max-w-md text-lg text-white/50"
        >
          Tap into any venue. See who&apos;s there. No app download needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200 }}
          className="relative mt-10"
        >
          <Link
            href="/map"
            className="group inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-8 py-4 text-lg font-semibold backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/15 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Enter the map</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
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
            {displayStats.totalVenues} venues streaming live data
          </span>
        </motion.div>
      </motion.section>

      {/* Bottom padding */}
      <div className="h-20" />
    </div>
  );
}
