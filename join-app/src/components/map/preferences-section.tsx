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
  updated_at?: string;
}

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string }> = {
  dietary: { emoji: "\ud83e\udd6c", label: "Diet" },
  vibe: { emoji: "\u2728", label: "Vibe" },
  venue_type: { emoji: "\ud83d\udccd", label: "Places" },
  group_size: { emoji: "\ud83d\udc65", label: "Group" },
  time: { emoji: "\ud83d\udd50", label: "Time" },
  order: { emoji: "\u2615", label: "Orders" },
  neighborhood: { emoji: "\ud83c\udfe0", label: "Area" },
  interest: { emoji: "\ud83c\udfb5", label: "Interest" },
  general: { emoji: "\ud83d\udcac", label: "Note" },
};

export function PreferencesSection() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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
    setDeleting(id);
    // Optimistic removal after brief animation
    setTimeout(() => {
      setPrefs((prev) => prev.filter((p) => p.id !== id));
      setDeleting(null);
    }, 200);
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

  // Group by category
  const grouped: Record<string, Preference[]> = {};
  for (const pref of prefs) {
    const cat = pref.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(pref);
  }
  const categories = Object.entries(grouped);

  if (prefs.length === 0) {
    return (
      <div className="mt-2 px-3 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">YOUR MEMORY</span>
        </div>
        <p className="font-sans text-[11px] leading-relaxed text-white/20">
          As you chat with venues and the concierge, I learn what you like — your vibes, favorite orders, and preferences. Nothing here yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">YOUR MEMORY</span>
        </div>
        <span className="font-sans text-[9px] text-white/15">{prefs.length} memories</span>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {categories.map(([cat, items]) => {
            const config = CATEGORY_CONFIG[cat] || { emoji: "\ud83d\udcac", label: cat };
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {/* Category header */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">{config.emoji}</span>
                  <span className="font-sans text-[9px] font-semibold tracking-[1px] text-white/20 uppercase">{config.label}</span>
                </div>

                {/* Memory items */}
                <div className="flex flex-col gap-1">
                  {items.map((pref) => {
                    const isConfirmed = pref.source === "user" || pref.confidence >= 0.9;
                    const isDeleting = deleting === pref.id;
                    return (
                      <motion.div
                        key={pref.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: isDeleting ? 0.3 : 1, x: 0, scale: isDeleting ? 0.95 : 1 }}
                        exit={{ opacity: 0, x: 8, height: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="group flex items-center gap-2 px-2.5 py-1.5"
                        style={{
                          backgroundColor: isConfirmed ? "rgba(74,222,128,0.05)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isConfirmed ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)"}`,
                        }}
                      >
                        {/* Confidence dot */}
                        <div
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: isConfirmed ? "#4ade80" : "rgba(255,255,255,0.15)",
                            boxShadow: isConfirmed ? "0 0 4px rgba(74,222,128,0.3)" : "none",
                          }}
                        />

                        {/* Memory text */}
                        <span className="flex-1 min-w-0 truncate font-sans text-[11px] text-white/50">
                          {pref.value}
                        </span>

                        {/* Confirm button (for unconfirmed) */}
                        {!isConfirmed && (
                          <button
                            onClick={() => handleConfirm(pref.id)}
                            className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 active:scale-90"
                            style={{ backgroundColor: "rgba(74,222,128,0.12)" }}
                            title="Confirm this is correct"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(pref.id)}
                          className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 active:scale-90"
                          style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
                          title="Delete this memory"
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Privacy note */}
      <p className="mt-2.5 font-sans text-[9px] text-white/12 leading-relaxed">
        Memories are learned from your conversations. Tap the × to delete any memory.
      </p>
    </div>
  );
}
