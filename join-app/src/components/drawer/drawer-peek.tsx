"use client";

import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { type UserProfile, ACCENT } from "./the-drawer";
import { APP_VERSION } from "@/lib/version";

interface DrawerPeekProps {
  user: UserProfile | null;
  selectedVenue: Venue | null;
  vibeColor: string;
  tierColor: string;
  onTap: () => void;
  onSignIn: () => void;
}

export function DrawerPeek({ user, selectedVenue, vibeColor, tierColor, onTap, onSignIn }: DrawerPeekProps) {
  return (
    <button onClick={onTap} className="flex h-full items-center gap-3 px-4">
      {/* Drag handle */}
      <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />

      {selectedVenue && user ? (
        // Logged in + venue selected
        <>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full" style={{ border: `2px solid ${vibeColor}40`, backgroundColor: `${vibeColor}15` }}>
            {selectedVenue.heroImage ? (
              <img src={selectedVenue.heroImage} alt="" className="h-full w-full object-cover" />
            ) : selectedVenue.logo ? (
              <img src={selectedVenue.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-sans text-[14px] font-bold" style={{ color: vibeColor }}>{selectedVenue.name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-sans text-[16px] font-bold text-white/90">{selectedVenue.name}</span>
            {selectedVenue.neighborhood && (
              <span className="truncate font-sans text-[14px] text-white/35">{selectedVenue.neighborhood}</span>
            )}
          </div>
        </>
      ) : user ? (
        // Logged in, no venue
        <>
          <motion.div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: ACCENT }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <span className="font-sans text-[16px] font-semibold text-white/60">theKickBack</span>
          <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] text-white/15">v{APP_VERSION}</span>
        </>
      ) : (
        // Not logged in
        <>
          <motion.div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: ACCENT }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <span className="font-sans text-[16px] font-semibold text-white/60">theKickBack</span>
          <button
            onClick={(e) => { e.stopPropagation(); onSignIn(); }}
            className="ml-auto shrink-0 rounded-full px-3 py-1.5 font-sans text-[15px] font-semibold active:scale-95"
            style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            Sign in &#9656;
          </button>
        </>
      )}
    </button>
  );
}
