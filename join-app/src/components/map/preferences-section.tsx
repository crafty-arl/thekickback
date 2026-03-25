"use client";

import { useState, useEffect } from "react";

export function PreferencesSection() {
  const [memory, setMemory] = useState("");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => { setMemory(d.memory || ""); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: draft }),
      });
      if (res.ok) {
        setMemory(draft);
        setEditing(false);
      }
    } finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", { method: "DELETE" });
      if (res.ok) { setMemory(""); setEditing(false); setExpanded(false); }
    } finally { setSaving(false); }
  };

  if (!loaded) return null;

  // Count how many sections have content
  const sections = memory.split(/^## /m).filter(Boolean);
  const lineCount = memory.split("\n").length;
  const isLong = lineCount > 6;

  return (
    <div className="rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11px] font-semibold text-white/40">Memory</span>
          {memory && sections.length > 1 && (
            <span className="font-sans text-[9px] text-white/15">{sections.length} sections</span>
          )}
        </div>
        {memory && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDraft(memory); setEditing(true); }}
              className="font-sans text-[10px] font-medium text-white/25 hover:text-white/40 transition"
            >
              Edit
            </button>
            <button
              onClick={clear}
              disabled={saving}
              className="font-sans text-[10px] font-medium text-red-400/30 hover:text-red-400/50 transition disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={12}
              autoFocus
              className="w-full resize-y rounded-lg px-3 py-2 font-sans text-[11px] leading-relaxed text-white/80 placeholder:text-white/15 outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 120 }}
              placeholder={"## Identity\n- Name, role, etc.\n\n## Preferences\n- Diet: ...\n- Drinks: ...\n- Vibe: ...\n\n## Places\n- Favorites, want to try\n\n## Orders & Habits\n- Usual orders at specific places\n\n## Notes\n- Anything else"}
            />
            <div className="flex items-center justify-between">
              <span className="font-sans text-[9px] text-white/15">{draft.length}/2000</span>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                  {saving ? "..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 font-sans text-[11px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : memory ? (
          <div>
            <div className={`font-sans text-[11px] leading-relaxed text-white/35 whitespace-pre-line ${!expanded && isLong ? "max-h-[120px] overflow-hidden" : ""}`}
              style={!expanded && isLong ? { maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" } : undefined}
            >
              {memory}
            </div>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 font-sans text-[10px] font-medium transition"
                style={{ color: "#F97316" }}
              >
                {expanded ? "Show less" : `Show all (${lineCount} lines)`}
              </button>
            )}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">
            As you chat, the AI builds a detailed memory of your preferences — diet, drinks, favorite places, usual orders, vibes. You can also edit this manually.
          </p>
        )}
      </div>
    </div>
  );
}
