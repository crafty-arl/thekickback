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
      animate={{
        scale: selected ? 1.25 : 1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative flex items-center justify-center"
      style={{ width: 32, height: 32 }}
    >
      <div
        className="rounded-full border-[2.5px] border-black/20 shadow-lg"
        style={{
          width: selected ? 40 : 32,
          height: selected ? 40 : 32,
          backgroundColor: color,
          transition: "width 0.2s, height 0.2s",
        }}
      />
      {selected && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -bottom-6 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
        >
          {venue.name}
        </motion.div>
      )}
    </motion.button>
  );
}
