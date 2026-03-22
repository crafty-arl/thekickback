"use client";

import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { type UserProfile, ACCENT } from "./the-drawer";
import { RefObject } from "react";

interface DrawerPeekProps {
  user: UserProfile | null;
  selectedVenue: Venue | null;
  vibeColor: string;
  tierColor: string;
  onTap: () => void;
  onSignIn: () => void;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onInputFocus: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
}

export function DrawerPeek({ user, selectedVenue, vibeColor, onSignIn, input, setInput, onSend, onInputFocus, inputRef, loading }: DrawerPeekProps) {
  if (!user) {
    return (
      <div className="flex h-full items-center gap-3 px-4">
        <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 " style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        <motion.div
          className="h-2.5 w-2.5 shrink-0 "
          style={{ backgroundColor: ACCENT }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <span className="font-sans text-[16px] font-semibold text-white/60">theKickBack</span>
        <button
          onClick={onSignIn}
          className="ml-auto shrink-0  px-3 py-1.5 font-sans text-[15px] font-semibold active:scale-95"
          style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
        >
          Sign in &#9656;
        </button>
      </div>
    );
  }

  const color = selectedVenue ? vibeColor : ACCENT;
  const placeholder = selectedVenue ? `Ask ${selectedVenue.name} anything...` : "Ask KickBack anything...";

  return (
    <div className="flex h-full flex-col justify-end px-3" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}>
      <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 " style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(); } }}
          onFocus={onInputFocus}
          placeholder={placeholder}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          className="min-w-0 flex-1  px-4 font-sans text-[16px] text-white placeholder:text-white/25 focus:outline-none"
          style={{ height: 44, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        {input.trim() && (
          <motion.button
            onClick={onSend}
            disabled={loading}
            whileTap={{ scale: 0.9 }}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center  disabled:opacity-30"
            style={{ backgroundColor: color, boxShadow: `0 2px 10px ${color}40` }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </motion.button>
        )}
      </div>
    </div>
  );
}
