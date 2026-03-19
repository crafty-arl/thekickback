"use client";

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
