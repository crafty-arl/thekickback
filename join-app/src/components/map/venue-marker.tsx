"use client";

import { motion } from "framer-motion";
import { getVibeHexColor, type Venue } from "@/lib/venues";

interface VenueMarkerProps {
  venue: Venue;
  selected: boolean;
  onClick: () => void;
}

export function VenueMarker({ venue, selected, onClick }: VenueMarkerProps) {
  const color = getVibeHexColor(venue.vibe);

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
        className="absolute rounded-full"
        style={{
          width: 48,
          height: 48,
          border: `1px solid ${color}`,
          opacity: 0.25,
        }}
        animate={
          selected
            ? { scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }
            : { scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }
        }
        transition={{ duration: selected ? 1.5 : 2.5, repeat: Infinity, ease: "easeOut" }}
      />

      {/* Second pulse ring (selected only) */}
      {selected && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 48,
            height: 48,
            border: `1px solid ${color}`,
          }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.15, 0, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
        />
      )}

      {/* Outer hexagonal glow ring */}
      <div
        className="absolute"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `1.5px solid ${color}40`,
          boxShadow: `0 0 12px ${color}20`,
        }}
      />

      {/* Inner node core */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 16px ${color}60, 0 0 4px ${color}`,
        }}
        animate={
          selected
            ? { boxShadow: [`0 0 16px ${color}60, 0 0 4px ${color}`, `0 0 28px ${color}90, 0 0 8px ${color}`, `0 0 16px ${color}60, 0 0 4px ${color}`] }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Center dot */}
        <div
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        />
      </motion.div>

      {/* Connector lines — small ticks radiating out */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
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
          {venue.name}
        </motion.div>
      )}
    </motion.button>
  );
}
