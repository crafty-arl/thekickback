"use client";

import { useState, useEffect } from "react";

export function PreferencesSection() {
  const [memory, setMemory] = useState("");
  const [editing, setEditing] = useState(false);
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
      if (res.ok) { setMemory(""); setEditing(false); }
    } finally { setSaving(false); }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-sans text-[11px] font-semibold text-white/40">Memory</span>
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
              maxLength={500}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg px-3 py-2 font-sans text-[12px] text-white/80 placeholder:text-white/15 outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              placeholder="What should the AI remember about you?"
            />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                {saving ? "..." : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 font-sans text-[11px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : memory ? (
          <p className="font-sans text-[11px] leading-relaxed text-white/35 whitespace-pre-line">{memory}</p>
        ) : (
          <p className="font-sans text-[11px] text-white/20">
            As you chat, the AI learns what you like — vibes, orders, preferences. You can also edit this manually.
          </p>
        )}
      </div>
    </div>
  );
}
