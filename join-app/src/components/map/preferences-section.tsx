"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Preference {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  venue_id: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  dietary: "\ud83e\udd6c",
  vibe: "\u2728",
  venue_type: "\ud83d\udccd",
  group_size: "\ud83d\udc65",
  time: "\ud83d\udd50",
  order: "\u2615",
  neighborhood: "\ud83c\udfe0\ufe0f",
  interest: "\ud83c\udfb5",
  general: "\ud83d\udcac",
};

export function PreferencesSection() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/preferences")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => {
        setPrefs(data.preferences || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setPrefs((prev) => prev.filter((p) => p.id !== id));
    await fetch("/api/preferences", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const handleConfirm = async (id: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, confidence: 1, source: "user" } : p))
    );
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confirmed: true }),
    });
  };

  if (loading) return null;
  if (prefs.length === 0) {
    return (
      <div className="mt-2 rounded-xl px-3 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">ABOUT YOU</span>
        </div>
        <p className="font-sans text-[11px] text-white/20">
          The more you chat, the more I learn your preferences. Nothing here yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">ABOUT YOU</span>
        <span className="font-sans text-[9px] text-white/15">{prefs.length} learned</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>
          {prefs.map((pref) => {
            const emoji = CATEGORY_EMOJI[pref.category] || "\ud83d\udcac";
            const isConfirmed = pref.source === "user" || pref.confidence >= 0.9;
            return (
              <motion.div
                key={pref.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group flex items-center gap-1 rounded-full px-2 py-1"
                style={{
                  backgroundColor: isConfirmed ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isConfirmed ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <span className="text-[10px]">{emoji}</span>
                <span className="font-sans text-[10px] font-medium text-white/50">
                  {pref.value}
                </span>
                {!isConfirmed && (
                  <button
                    onClick={() => handleConfirm(pref.id)}
                    className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: "rgba(74,222,128,0.15)" }}
                  >
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(pref.id)}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                >
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
