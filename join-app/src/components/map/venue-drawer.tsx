"use client";

import { useState } from "react";
import { motion, PanInfo } from "framer-motion";
import {
  Venue,
  getVibeHexColor,
  getVibeLabel,
  getOccupancyPercent,
} from "@/lib/venues";

interface VenueDrawerProps {
  venue: Venue;
  onClose: () => void;
}

type DrawerState = "peek" | "half";

const PEEK_HEIGHT = 200;
const HALF_HEIGHT_VH = 55;

export function VenueDrawer({ venue, onClose }: VenueDrawerProps) {
  const [state, setState] = useState<DrawerState>("peek");
  const pct = getOccupancyPercent(venue);
  const vibeColor = getVibeHexColor(venue.vibe);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info;

    if (state === "peek") {
      // Dragging up → go to half
      if (offset.y < -60 || velocity.y < -300) {
        setState("half");
      }
      // Dragging down → close
      else if (offset.y > 80 || velocity.y > 300) {
        onClose();
      }
    } else {
      // half state — drag down → peek or close
      if (offset.y > 150 || velocity.y > 500) {
        onClose();
      } else if (offset.y > 60 || velocity.y > 200) {
        setState("peek");
      }
    }
  }

  const height = state === "peek" ? PEEK_HEIGHT : `${HALF_HEIGHT_VH}vh`;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-[20px] bg-[#0D0D0F]"
      style={{
        height,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        touchAction: "none",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pb-2 pt-3">
        <div className="h-1 w-10 rounded-full bg-white/15" />
      </div>

      {/* Peek content — always visible */}
      <div className="px-5">
        {/* Name + vibe */}
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-lg font-semibold text-white">
            {venue.name}
          </h3>
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: vibeColor }}
            />
            <span className="font-sans text-xs font-medium text-white/50">
              {getVibeLabel(venue.vibe)}
            </span>
          </div>
        </div>

        {/* Category + neighborhood */}
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 font-sans text-[11px] font-medium tracking-wide text-white/40">
            {venue.category.toUpperCase()}
          </span>
          <span className="font-sans text-sm text-white/40">
            {venue.neighborhood}
          </span>
        </div>

        {/* Occupancy bar */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] font-medium text-white/40">
              {venue.occupancy} / {venue.capacity} people
            </span>
            <span className="font-sans text-[11px] font-medium text-white/40">
              {pct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: vibeColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Half content — only visible in half state */}
      {state === "half" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 overflow-y-auto px-5"
          style={{
            maxHeight: `calc(${HALF_HEIGHT_VH}vh - ${PEEK_HEIGHT}px - 20px)`,
          }}
        >
          {/* Divider */}
          <div className="mb-4 h-px bg-white/[0.06]" />

          {/* Description */}
          <p className="font-sans text-sm leading-relaxed text-white/60">
            {venue.description}
          </p>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {venue.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/[0.08] px-2 py-0.5 font-sans text-[11px] text-white/45"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Hours */}
          <div className="mt-4 flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/30"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="font-sans text-sm text-white/40">
              {venue.hours}
            </span>
          </div>

          {/* Join CTA */}
          <div className="mt-6 flex items-center gap-3">
            <a
              href={`/${venue.id}`}
              className="flex-1 rounded-xl py-3 text-center font-sans text-sm font-semibold text-black transition-colors"
              style={{ backgroundColor: vibeColor }}
            >
              View Venue
            </a>
            {venue.memberOnly && (
              <span className="rounded-md bg-white/[0.08] px-3 py-1 font-sans text-[10px] font-medium tracking-wide text-white/50">
                MEMBERS ONLY
              </span>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
