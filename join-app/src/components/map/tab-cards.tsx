"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { type Venue, getVibeLabel, getOccupancyPercent } from "@/lib/venues";

interface TabCardProps {
  body: string;
  venue: Venue;
  vibeColor: string;
}

const VIBE_LEVELS = ["quiet", "moderate", "busy", "lit"] as const;

export function VibeCard({ body, venue, vibeColor }: TabCardProps) {
  const pct = getOccupancyPercent(venue);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Vibe gauge */}
      <div className="flex gap-1 px-4 pt-4 pb-3">
        {VIBE_LEVELS.map((level) => {
          const isActive = level === venue.vibe;
          return (
            <div key={level} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="h-1.5 w-full rounded-full transition-all"
                style={{
                  backgroundColor: isActive ? vibeColor : "rgba(255,255,255,0.08)",
                  boxShadow: isActive ? `0 0 8px ${vibeColor}50` : "none",
                }}
              />
              <span
                className="font-sans text-[10px] font-semibold tracking-wide"
                style={{ color: isActive ? vibeColor : "rgba(255,255,255,0.2)" }}
              >
                {getVibeLabel(level).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Occupancy bar */}
      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sans text-[10px] font-semibold tracking-[1px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            CAPACITY
          </span>
          <span className="font-sans text-[12px] font-bold" style={{ color: vibeColor }}>
            {venue.occupancy} / {venue.capacity}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: vibeColor, boxShadow: `0 0 12px ${vibeColor}40` }}
          />
        </div>
      </div>

      {/* AI description */}
      <div className="mx-4 mb-3 rounded-xl px-3 py-2.5" style={{ borderLeft: `3px solid ${vibeColor}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
        <p className="font-sans text-[13px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          {body}
        </p>
      </div>

      {/* Tags */}
      {venue.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {venue.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 font-sans text-[10px] font-medium"
              style={{ backgroundColor: `${vibeColor}15`, color: `${vibeColor}cc`, border: `1px solid ${vibeColor}25` }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function MenuCard({ body, venue, vibeColor }: TabCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: `2px solid ${vibeColor}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${vibeColor}20` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </div>
        <span className="font-sans text-[14px] font-bold text-white/90">Menu</span>
        <span className="font-sans text-[11px] text-white/25">{venue.name}</span>
      </div>

      {/* AI body — formatted as menu content */}
      <div className="px-4 pb-3">
        <p className="whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-white/60">
          {body}
        </p>
      </div>

      {/* Footer — hours */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ backgroundColor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.25)" }}>
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          Open {venue.hours}
        </span>
      </div>
    </motion.div>
  );
}

export function EventsCard({ body, venue, vibeColor }: TabCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, rotate: -0.5 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px dashed ${vibeColor}60`,
      }}
    >
      {/* Ticket header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${vibeColor}20` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <span className="font-sans text-[14px] font-bold" style={{ color: vibeColor }}>Tonight</span>
        </div>
        <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: `${vibeColor}18`, color: vibeColor }}>
          LIVE
        </span>
      </div>

      {/* Event description */}
      <div className="px-4 pb-3">
        <p className="whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-white/60">
          {body}
        </p>
      </div>

      {/* Tear line */}
      <div className="mx-2 border-t border-dashed" style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-sans text-[11px] font-medium text-white/30">{venue.name}</span>
        <span className="font-sans text-[11px] text-white/20">{venue.hours}</span>
      </div>
    </motion.div>
  );
}

export function ReserveCard({ body, venue, vibeColor }: TabCardProps) {
  const spotsLeft = venue.capacity - venue.occupancy;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: `${vibeColor}10`, borderBottom: `1px solid ${vibeColor}20` }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span className="font-sans text-[14px] font-bold text-white/90">Reserve a Spot</span>
      </div>

      {/* AI body */}
      <div className="px-4 pt-3 pb-3">
        <p className="whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-white/60">
          {body}
        </p>
      </div>

      {/* Venue info row */}
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="flex-1">
          <p className="font-sans text-[12px] font-semibold text-white/70">{venue.name}</p>
          <p className="font-sans text-[10px] text-white/30">{venue.category} · {venue.neighborhood}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-[12px] font-bold" style={{ color: vibeColor }}>{spotsLeft} spots</p>
          <p className="font-sans text-[10px] text-white/30">available</p>
        </div>
      </div>

      {/* CTA — text to reserve */}
      <div className="px-4 pb-4">
        <a
          href={`sms:${venue.textNumber}`}
          className="flex items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-bold text-black active:scale-[0.97]"
          style={{ backgroundColor: vibeColor }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Text to Reserve
        </a>
      </div>
    </motion.div>
  );
}

// ─── Join Card (Venue Profile + Membership + Perks) ──────────────

interface JoinCardProps extends TabCardProps {
  userId: string | null;
}

interface VenueXpData {
  xp: number;
  visits: number;
  milestones: { name: string; threshold: number; color: string; reward: string | null; perks: string[] }[];
  perks: { id: string; name: string; description: string | null; point_cost: number; category: string }[];
  offerings: { id: string; type: string; name: string; description: string | null; price_cents: number; recurring: boolean; interval: string | null; perks: string[] }[];
  userBalance: number;
}

const PERK_EMOJI: Record<string, string> = { drink: "☕", food: "🍔", access: "🔑", experience: "✨", merch: "🎁", other: "🎯" };

export function JoinCard({ body, venue, vibeColor, userId }: JoinCardProps) {
  const [data, setData] = useState<VenueXpData | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fetch venue XP data, milestones, perks, and offerings
        const params = userId ? `userId=${userId}&venueId=${venue.id}` : `userId=anon&venueId=${venue.id}`;
        const res = await fetch(`/api/points?${params}`);
        const pts = await res.json();

        // Fetch offerings (memberships)
        const offerRes = await fetch(`/api/offerings?venueId=${venue.id}`);
        const offerData = offerRes.ok ? await offerRes.json() : { offerings: [] };

        setData({
          xp: pts.venueXp?.xp || 0,
          visits: pts.venueXp?.visits || 0,
          milestones: pts.venueMilestones || [],
          perks: pts.perks || [],
          offerings: offerData.offerings || [],
          userBalance: pts.balance?.balance || 0,
        });
      } catch {
        setData({ xp: 0, visits: 0, milestones: [], perks: [], offerings: [], userBalance: 0 });
      }
    }
    load();
  }, [venue.id, userId]);

  const handleRedeem = async (perkId: string) => {
    if (!userId) return;
    setRedeeming(perkId);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, venueId: venue.id, items: [], pointsToSpend: 0, notes: `Perk redemption: ${perkId}` }),
      });
      if (res.ok) {
        // Open wallet badge URL
        const result = await res.json();
        if (result.orderId) {
          window.open(`https://thekickback.net/wallet/reward/${result.orderId}`, "_blank");
        }
      }
    } catch { /* skip */ }
    setRedeeming(null);
  };

  // Find current milestone
  const currentMilestone = data?.milestones
    .filter((m) => m.threshold <= (data?.xp || 0))
    .sort((a, b) => b.threshold - a.threshold)[0];
  const nextMilestone = data?.milestones
    .filter((m) => m.threshold > (data?.xp || 0))
    .sort((a, b) => a.threshold - b.threshold)[0];

  const memberships = data?.offerings.filter((o) => o.type === "membership") || [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Venue Profile Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: `linear-gradient(135deg, ${vibeColor}12 0%, transparent 60%)` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-sans text-[16px] font-bold text-white/90">{venue.name}</p>
            <p className="mt-0.5 font-sans text-[11px] text-white/35">
              {venue.neighborhood || venue.category}{venue.address ? ` · ${venue.address}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2 py-1" style={{ backgroundColor: `${vibeColor}18` }}>
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: vibeColor }} />
            <span className="font-sans text-[10px] font-semibold" style={{ color: vibeColor }}>
              {getVibeLabel(venue.vibe)} · {venue.occupancy}
            </span>
          </div>
        </div>
        {venue.tagline && (
          <p className="mt-2 font-sans text-[12px] italic leading-[1.5] text-white/40">"{venue.tagline}"</p>
        )}
        {venue.hours && (
          <div className="mt-2 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="font-sans text-[10px] text-white/25">{venue.hours}</span>
          </div>
        )}
      </div>

      {/* XP Progress at this venue */}
      {data && (
        <div className="mx-4 mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">YOUR XP HERE</span>
            <span className="font-mono text-[12px] font-bold" style={{ color: currentMilestone?.color || vibeColor }}>
              {data.xp.toLocaleString()}
              {nextMilestone && <span className="text-white/15 font-normal"> / {nextMilestone.threshold.toLocaleString()}</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${nextMilestone ? Math.min((data.xp / nextMilestone.threshold) * 100, 100) : 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                backgroundColor: currentMilestone?.color || vibeColor,
                boxShadow: `0 0 8px ${currentMilestone?.color || vibeColor}40`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-sans text-[9px] text-white/20">
              {currentMilestone?.name || "New"} · {data.visits} visit{data.visits !== 1 ? "s" : ""}
            </span>
            {nextMilestone && (
              <span className="font-sans text-[9px] text-white/20">{(nextMilestone.threshold - data.xp).toLocaleString()} to {nextMilestone.name}</span>
            )}
          </div>
        </div>
      )}

      {/* Membership Tiers */}
      {memberships.length > 0 && (
        <div className="mx-4 mb-3">
          <span className="font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">MEMBERSHIP TIERS</span>
          <div className="mt-2 flex flex-col gap-2">
            {memberships.map((m) => {
              const price = m.price_cents === 0 ? "Free" : `$${(m.price_cents / 100).toFixed(0)}/${m.interval || "mo"}`;
              return (
                <div
                  key={m.id}
                  className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[13px] font-bold text-white/80">{m.name}</span>
                    <span className="font-mono text-[12px] font-bold" style={{ color: vibeColor }}>{price}</span>
                  </div>
                  {m.description && (
                    <p className="mt-0.5 font-sans text-[10px] text-white/30">{m.description}</p>
                  )}
                  {m.perks.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {m.perks.slice(0, 4).map((p: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full" style={{ backgroundColor: vibeColor }} />
                          <span className="font-sans text-[10px] text-white/35">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* XP Roadmap milestones */}
      {data && data.milestones.length > 0 && (
        <div className="mx-4 mb-3">
          <span className="font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">XP ROADMAP</span>
          <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {data.milestones.sort((a, b) => a.threshold - b.threshold).map((m) => {
              const reached = data.xp >= m.threshold;
              return (
                <div
                  key={m.name}
                  className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: reached ? `${m.color}12` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${reached ? `${m.color}25` : "rgba(255,255,255,0.04)"}`,
                    opacity: reached ? 1 : 0.5,
                    minWidth: 72,
                  }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: reached ? m.color : "rgba(255,255,255,0.1)" }} />
                  <span className="font-sans text-[10px] font-bold" style={{ color: reached ? m.color : "rgba(255,255,255,0.3)" }}>
                    {m.name}
                  </span>
                  <span className="font-mono text-[8px] text-white/20">{m.threshold} XP</span>
                  {m.reward && reached && (
                    <span className="font-sans text-[8px] text-white/25">{m.reward}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Redeemable Perks */}
      {data && data.perks.length > 0 && (
        <div className="mx-4 mb-3">
          <span className="font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">REDEEM WITH POINTS</span>
          <div className="mt-2 flex flex-col gap-1.5">
            {data.perks.map((perk) => {
              const canAfford = data.userBalance >= perk.point_cost;
              const emoji = PERK_EMOJI[perk.category] || "🎯";
              return (
                <div
                  key={perk.id}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{
                    backgroundColor: canAfford ? "rgba(249,115,22,0.04)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)"}`,
                    opacity: canAfford ? 1 : 0.45,
                  }}
                >
                  <span className="text-[16px]">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-sans text-[12px] font-semibold text-white/70">{perk.name}</p>
                    {perk.description && (
                      <p className="truncate font-sans text-[9px] text-white/25">{perk.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold" style={{ color: canAfford ? "#f97316" : "rgba(255,255,255,0.2)" }}>
                      {perk.point_cost}
                    </span>
                    {canAfford && (
                      <button
                        onClick={() => handleRedeem(perk.id)}
                        disabled={redeeming === perk.id}
                        className="rounded-lg px-2.5 py-1 font-sans text-[9px] font-bold text-black active:scale-95 disabled:opacity-50"
                        style={{ backgroundColor: vibeColor }}
                      >
                        {redeeming === perk.id ? "..." : "Redeem"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI context message */}
      {body && (
        <div className="mx-4 mb-4 rounded-xl px-3 py-2.5" style={{ borderLeft: `3px solid ${vibeColor}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <p className="font-sans text-[12px] italic leading-relaxed text-white/50">{body}</p>
        </div>
      )}
    </motion.div>
  );
}
