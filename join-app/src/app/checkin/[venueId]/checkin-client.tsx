"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Props {
  venue: { id: string; name: string; vibe: string };
  themeColor: string;
  tagline: string | null;
  slug: string | null;
  table: string | null;
  user: { id: string; email: string } | null;
  xpActions: { action: string; label: string; points: number }[];
  milestones: { id: string; name: string; threshold: number; color: string; reward: string | null; perks: string[] }[];
}

type Phase = "identify" | "checking-in" | "checked-in";

function vibeColor(vibe: string): string {
  switch (vibe) {
    case "quiet": return "#4ADE80";
    case "moderate": return "#FACC15";
    case "busy": return "#F97316";
    case "packed": return "#EF4444";
    default: return "#4ADE80";
  }
}

export function CheckinClient({ venue, themeColor, tagline, slug, table, user, xpActions, milestones }: Props) {
  const [phase, setPhase] = useState<Phase>(user ? "checking-in" : "identify");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check-in result
  const [xpResult, setXpResult] = useState<{
    xp: number;
    venue_xp_total: number;
    milestone: string | null;
    milestone_changed: boolean;
  } | null>(null);
  const [perkBridge, setPerkBridge] = useState<{
    balance: number;
    nextPerk: { id: string; name: string; point_cost: number; category: string | null } | null;
    pointsToNext: number | null;
    progressPct: number;
  } | null>(null);

  // Phase 2: vibe drop submission state
  const [vibeText, setVibeText] = useState("");
  const [vibeSubmitting, setVibeSubmitting] = useState(false);
  const [vibeResult, setVibeResult] = useState<{ pointsGranted: number; newBalance: number | null } | null>(null);
  const [vibeError, setVibeError] = useState<string | null>(null);

  const visitAction = xpActions.find((a) => a.action === "visit" || a.action === "first_visit");
  const vColor = vibeColor(venue.vibe);

  // Auto check-in on mount if user is authenticated
  useState(() => {
    if (user && phase === "checking-in") {
      doCheckin();
    }
  });

  async function sendOtpEmail() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setOtpSent(true); }
    } catch { setError("Failed to send code. Try again."); }
    setLoading(false);
  }

  async function verifyOtpCode() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: otp }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setPhase("checking-in");
        doCheckin();
      }
    } catch { setError("Verification failed. Try again."); }
    setLoading(false);
  }

  async function doCheckin() {
    setPhase("checking-in");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, table }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setPhase("identify");
        return;
      }
      setXpResult(data.xp);
      if (data.perkBridge) setPerkBridge(data.perkBridge);
      setPhase("checked-in");
    } catch {
      setError("Check-in failed. Try again.");
      setPhase("identify");
    }
  }

  // Phase 2: submit a vibe drop (lightweight contribution)
  async function submitVibe() {
    const text = vibeText.trim();
    if (!text || vibeSubmitting) return;
    setVibeSubmitting(true);
    setVibeError(null);
    try {
      const res = await fetch("/api/contributions/vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, body: text, sentiment: venue.vibe }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setVibeError(data.error || "Couldn't submit. Try again.");
        return;
      }
      setVibeResult({ pointsGranted: data.pointsGranted, newBalance: data.newBalance });
      setVibeText("");
      // Reflect new balance in the perk bridge so the bar updates without a refetch
      if (typeof data.newBalance === "number" && perkBridge?.nextPerk) {
        const np = perkBridge.nextPerk;
        const newPct = np.point_cost > 0
          ? Math.max(0, Math.min(100, Math.round((data.newBalance / np.point_cost) * 100)))
          : 100;
        setPerkBridge({
          balance: data.newBalance,
          nextPerk: np,
          pointsToNext: Math.max(0, np.point_cost - data.newBalance),
          progressPct: newPct,
        });
      }
    } catch {
      setVibeError("Something went wrong. Try again.");
    } finally {
      setVibeSubmitting(false);
    }
  }

  // Find current milestone
  const currentXp = xpResult?.venue_xp_total || 0;
  const currentMilestone = [...milestones].reverse().find((m) => currentXp >= m.threshold);
  const nextMilestone = milestones.find((m) => m.threshold > currentXp);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-white" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Logo */}
      <div className="absolute inset-x-0 top-0 flex justify-center pt-[max(16px,env(safe-area-inset-top))]">
        <Image src="/logo.png" alt="theKickBack" width={120} height={40} className="h-6 w-auto" priority />
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* ═══ PHASE: Identify ═══ */}
          {phase === "identify" && (
            <motion.div key="identify" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center gap-6">
              {/* Venue header */}
              <div className="text-center">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: themeColor }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-black" />
                  <span className="font-sans text-[10px] font-bold tracking-[1.5px] text-black">LIVE</span>
                </div>
                <h1 className="font-sans text-[28px] font-bold tracking-tight">{venue.name}</h1>
                {tagline && <p className="mt-1 font-sans text-[13px] text-white/40">{tagline}</p>}
                {table && <p className="mt-2 font-sans text-[12px] text-white/25">Table {table}</p>}
              </div>

              {/* Email input */}
              <div className="w-full">
                <p className="mb-3 text-center font-sans text-[14px] text-white/50">
                  Enter your email to check in{visitAction ? ` and earn ${visitAction.points} XP` : ""}
                </p>
                {!otpSent ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendOtpEmail()}
                      placeholder="your@email.com"
                      className="min-w-0 flex-1 border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:border-orange/40 focus:outline-none"
                    />
                    <button
                      onClick={sendOtpEmail}
                      disabled={!email || loading}
                      className="shrink-0 px-5 py-3 font-sans text-[13px] font-bold text-black active:scale-95 disabled:opacity-40"
                      style={{ backgroundColor: themeColor }}
                    >
                      {loading ? "..." : "Go"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-center font-sans text-[12px] text-white/30">Code sent to {email}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && verifyOtpCode()}
                        placeholder="6-digit code"
                        maxLength={6}
                        className="min-w-0 flex-1 border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center font-mono text-[18px] tracking-[0.3em] text-white placeholder:text-white/20 focus:outline-none"
                      />
                      <button
                        onClick={verifyOtpCode}
                        disabled={otp.length < 6 || loading}
                        className="shrink-0 px-5 py-3 font-sans text-[13px] font-bold text-black active:scale-95 disabled:opacity-40"
                        style={{ backgroundColor: themeColor }}
                      >
                        {loading ? "..." : "Verify"}
                      </button>
                    </div>
                  </div>
                )}
                {error && <p className="mt-2 text-center font-sans text-[13px] text-red-400">{error}</p>}
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE: Checking In ═══ */}
          {phase === "checking-in" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <motion.div
                className="h-16 w-16 rounded-full"
                style={{ border: `3px solid ${themeColor}`, borderTopColor: "transparent" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              <p className="font-sans text-[14px] text-white/50">Checking in to {venue.name}...</p>
            </motion.div>
          )}

          {/* ═══ PHASE: Checked In ═══ */}
          {phase === "checked-in" && xpResult && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5">
              {/* Success checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${themeColor}20`, border: `2px solid ${themeColor}40` }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>

              <div className="text-center">
                <h2 className="font-sans text-[22px] font-bold">You're in.</h2>
                <p className="mt-1 font-sans text-[14px] text-white/40">{venue.name}{table ? ` · Table ${table}` : ""}</p>
              </div>

              {/* XP earned */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full border border-white/[0.06] p-4"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[11px] font-semibold tracking-[1.5px] text-white/25">XP EARNED</span>
                  <span className="font-mono text-[20px] font-bold" style={{ color: themeColor }}>+{xpResult.xp}</span>
                </div>

                {/* Milestone progress */}
                {milestones.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans text-[12px] font-semibold" style={{ color: currentMilestone?.color || "#94a3b8" }}>
                        {currentMilestone?.name || "Getting Started"}
                      </span>
                      <span className="font-mono text-[11px] text-white/30">
                        {xpResult.venue_xp_total} XP{nextMilestone ? ` / ${nextMilestone.threshold}` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${nextMilestone ? Math.min((xpResult.venue_xp_total / nextMilestone.threshold) * 100, 100) : 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: currentMilestone?.color || themeColor }}
                      />
                    </div>
                    {nextMilestone && (
                      <p className="mt-1 font-sans text-[10px] text-white/20">
                        {nextMilestone.threshold - xpResult.venue_xp_total} XP to {nextMilestone.name}
                        {nextMilestone.reward ? ` — ${nextMilestone.reward}` : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Milestone unlocked */}
                {xpResult.milestone_changed && xpResult.milestone && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-3 p-3 text-center"
                    style={{ backgroundColor: `${currentMilestone?.color || themeColor}15`, border: `1px solid ${currentMilestone?.color || themeColor}30` }}
                  >
                    <p className="font-sans text-[13px] font-bold" style={{ color: currentMilestone?.color || themeColor }}>
                      {xpResult.milestone} Unlocked!
                    </p>
                    {currentMilestone?.reward && (
                      <p className="mt-0.5 font-sans text-[11px] text-white/40">{currentMilestone.reward}</p>
                    )}
                  </motion.div>
                )}
              </motion.div>

              {/* Phase 1: next perk bridge — explicit reason to come back */}
              {perkBridge?.nextPerk && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full border border-white/[0.06] p-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[11px] font-semibold tracking-[1.5px] text-white/25">NEXT PERK</span>
                    <span className="font-mono text-[11px] text-white/40">
                      {perkBridge.balance} / {perkBridge.nextPerk.point_cost} pts
                    </span>
                  </div>
                  <p className="mt-1.5 font-sans text-[14px] font-semibold text-white">
                    {perkBridge.nextPerk.name}
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${perkBridge.progressPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                  </div>
                  <p className="mt-2 font-sans text-[11px] text-white/40">
                    {perkBridge.pointsToNext} pts to go — come back tomorrow to keep the streak.
                  </p>
                </motion.div>
              )}

              {/* Phase 2: vibe drop prompt — single lightweight contribution */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full"
              >
                {!vibeResult ? (
                  <div
                    className="border border-white/[0.06] p-3"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  >
                    <label className="mb-2 block font-sans text-[11px] font-semibold tracking-[1.5px] text-white/25">
                      HOW&apos;S IT TONIGHT?
                    </label>
                    <textarea
                      value={vibeText}
                      onChange={(e) => setVibeText(e.target.value)}
                      maxLength={280}
                      rows={2}
                      placeholder="A quick read for the next person..."
                      className="w-full resize-none border border-white/[0.06] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/25 focus:border-white/15 focus:outline-none"
                      disabled={vibeSubmitting}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-sans text-[10px] text-white/20">
                        +25 pts &middot; {280 - vibeText.length} left
                      </span>
                      <button
                        onClick={submitVibe}
                        disabled={!vibeText.trim() || vibeSubmitting}
                        className="px-4 py-1.5 font-sans text-[12px] font-bold text-black active:scale-95 disabled:opacity-40"
                        style={{ backgroundColor: themeColor }}
                      >
                        {vibeSubmitting ? "..." : "Drop it"}
                      </button>
                    </div>
                    {vibeError && (
                      <p className="mt-2 font-sans text-[11px] text-red-400">{vibeError}</p>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between border border-white/[0.06] p-3"
                    style={{ backgroundColor: `${themeColor}10`, borderColor: `${themeColor}30` }}
                  >
                    <span className="font-sans text-[13px] text-white/70">
                      Thanks for the read.
                    </span>
                    <span className="font-mono text-[14px] font-bold" style={{ color: themeColor }}>
                      +{vibeResult.pointsGranted}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* View venue link */}
              {slug && (
                <a
                  href={`/${slug}`}
                  className="font-sans text-[12px] text-white/30 underline decoration-white/10 transition hover:text-white/50"
                >
                  View {venue.name}
                </a>
              )}
            </motion.div>
          )}

          {/* Phase 2: receipt upload UI removed — vibe drops only for launch.
              The /api/receipt route stays on the server for future re-enable. */}
        </AnimatePresence>
      </div>

      {/* Vibe bar at bottom */}
      <div className="fixed inset-x-0 bottom-0 flex justify-center pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: vColor }} />
          <span className="font-sans text-[11px] text-white/30">
            {venue.vibe}
          </span>
        </div>
      </div>
    </main>
  );
}
