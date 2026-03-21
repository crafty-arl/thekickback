"use client";

import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";

interface VenueMarkerProps {
  venue: Venue;
  selected: boolean;
  onClick: () => void;
}

export function VenueMarker({ venue, selected, onClick }: VenueMarkerProps) {
  const isClaimed = venue.claimed !== false;
  const isEvent = venue.isEventPin === true;
  const color = isClaimed ? (venue.themeColor || "#F97316") : "#6b7280";

  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      animate={{ scale: selected ? 1.15 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative flex items-center justify-center"
      style={{ width: 48, height: 48 }}
    >
      {/* Outer pulse ring */}
      <motion.div
        className="absolute"
        style={{
          width: isEvent ? 44 : isClaimed ? 48 : 36,
          height: isEvent ? 44 : isClaimed ? 48 : 36,
          borderRadius: isEvent ? 10 : "50%",
          border: `1px solid ${color}`,
          opacity: 0.25,
        }}
        animate={
          selected
            ? { scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }
            : isEvent
              ? { scale: [1, 1.4, 1], opacity: [0.25, 0, 0.25] }
              : { scale: [1, isClaimed ? 1.5 : 1.3, 1], opacity: [isClaimed ? 0.2 : 0.1, 0, isClaimed ? 0.2 : 0.1] }
        }
        transition={{ duration: selected ? 1.5 : isEvent ? 2 : isClaimed ? 2.5 : 4, repeat: Infinity, ease: "easeOut" }}
      />

      {/* Second pulse ring (selected only) */}
      {selected && (
        <motion.div
          className="absolute"
          style={{
            width: 48,
            height: 48,
            borderRadius: isEvent ? 12 : "50%",
            border: `1px solid ${color}`,
          }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.15, 0, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
        />
      )}

      {/* Outer glow ring — only for claimed / event */}
      {(isClaimed || isEvent) && (
        <div
          className="absolute"
          style={{
            width: isEvent ? 32 : 36,
            height: isEvent ? 32 : 36,
            borderRadius: isEvent ? 8 : "50%",
            border: `1.5px solid ${color}40`,
            boxShadow: `0 0 12px ${color}20`,
          }}
        />
      )}

      {/* Inner node core */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: isEvent ? 22 : isClaimed ? 20 : 14,
          height: isEvent ? 22 : isClaimed ? 20 : 14,
          borderRadius: isEvent ? 6 : "50%",
          backgroundColor: color,
          boxShadow: isEvent
            ? `0 0 16px ${color}60, 0 0 6px ${color}`
            : isClaimed
              ? `0 0 16px ${color}60, 0 0 4px ${color}`
              : `0 0 8px ${color}30`,
          opacity: isClaimed || isEvent ? 1 : 0.7,
        }}
        animate={
          selected
            ? { boxShadow: [`0 0 16px ${color}60, 0 0 4px ${color}`, `0 0 28px ${color}90, 0 0 8px ${color}`, `0 0 16px ${color}60, 0 0 4px ${color}`] }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Event: calendar icon */}
        {isEvent ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="3" width="14" height="12" rx="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" fill="none" />
            <line x1="1" y1="7" x2="15" y2="7" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
            <line x1="5" y1="1" x2="5" y2="5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="1" x2="11" y2="5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : isClaimed ? (
          <div
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          />
        ) : null}
      </motion.div>

      {/* Connector lines — claimed only, not event */}
      {isClaimed && !isEvent && [0, 60, 120, 180, 240, 300].map((angle) => (
        <div
          key={angle}
          className="absolute"
          style={{
            width: 1,
            height: 6,
            backgroundColor: `${color}50`,
            transform: `rotate(${angle}deg) translateY(-21px)`,
            borderRadius: 1,
          }}
        />
      ))}

      {/* Label */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="absolute -bottom-7 whitespace-nowrap rounded-md px-2.5 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-white"
          style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${color}30`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
          }}
        >
          {isEvent ? (venue.eventName || venue.name) : venue.name}
          {!isClaimed && !isEvent && (
            <span className="ml-1 text-[8px] font-normal text-white/30">· unclaimed</span>
          )}
          {isEvent && (
            <span className="ml-1 text-[8px] font-normal text-white/50">· event</span>
          )}
        </motion.div>
      )}
    </motion.button>
  );
}
