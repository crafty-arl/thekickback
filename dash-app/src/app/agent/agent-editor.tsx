"use client";

import { useState } from "react";
import { KBWordmark } from "@/components/kb-logo";
import Link from "next/link";
import { addKnowledge, deleteKnowledge } from "./actions";

const CATEGORIES = [
  { id: "menu", label: "Menu & Drinks", icon: "🍸", placeholder: "We serve craft cocktails, local beers on tap, and a full espresso bar. Our signature drink is the Rooftop Sunset — mezcal, grapefruit, agave." },
  { id: "hours", label: "Hours & Policies", icon: "🕐", placeholder: "Open Wednesday through Saturday, 4 PM to midnight. Kitchen closes at 11 PM. Reservations recommended for groups of 6+." },
  { id: "events", label: "Events & Specials", icon: "🎵", placeholder: "Live DJ every Friday 9 PM–12 AM. Happy hour Mon–Thu 4–6 PM, half off wells and drafts. Wine tasting first Saturday of every month." },
  { id: "location", label: "Location & Access", icon: "📍", placeholder: "Located on the 12th floor of the Meridian Building. Enter through the lobby, take the elevator to 12. Street parking available on Main St. Nearest lot is the Civic Center garage." },
  { id: "faq", label: "FAQ", icon: "❓", placeholder: "Yes, we have oat milk. No, we don't take reservations for the bar area. Dress code is smart casual, no flip flops or tank tops after 8 PM." },
  { id: "general", label: "Custom", icon: "📝", placeholder: "Add any other information your AI should know about your venue..." },
];

interface Knowledge {
  id: string;
  content: string;
  category: string;
  created_at: string;
}

interface Props {
  venueName: string;
  knowledge: Knowledge[];
}

export function AgentEditor({ venueName, knowledge }: Props) {
  const [activeCategory, setActiveCategory] = useState("menu");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory)!;
  const filteredKnowledge = knowledge.filter((k) => k.category === activeCategory);
  const totalEntries = knowledge.length;

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    setMsg("");
    const result = await addKnowledge(newContent, activeCategory);
    if (result.error) { setMsg(result.error); }
    else { setNewContent(""); setMsg("Added!"); setTimeout(() => setMsg(""), 2000); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteKnowledge(id);
    setDeleting(null);
  }

  return (
    <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
        <div className="flex items-center gap-3">
          <Link href="/"><KBWordmark height={18} /></Link>
          <div className="hidden h-4 w-px sm:block" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="hidden font-sans text-[13px] font-medium sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>AI Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>{totalEntries} entries</span>
          <Link href="/settings" className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Settings</Link>
          <Link href="/" className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-0 lg:gap-8">
        {/* Sidebar — desktop */}
        <nav className="sticky top-[57px] hidden h-fit w-52 shrink-0 flex-col gap-1 py-8 lg:flex">
          <p className="mb-3 px-3 font-sans text-[11px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.25)" }}>KNOWLEDGE CATEGORIES</p>
          {CATEGORIES.map((cat) => {
            const count = knowledge.filter((k) => k.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left transition"
                style={{
                  backgroundColor: activeCategory === cat.id ? "rgba(255,255,255,0.06)" : "transparent",
                  color: activeCategory === cat.id ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                <span className="flex items-center gap-2 font-sans text-[13px] font-medium">
                  <span>{cat.icon}</span> {cat.label}
                </span>
                {count > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main */}
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-0 lg:py-8">
          {/* Mobile category tabs */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden" style={{ WebkitOverflowScrolling: "touch" as const }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-medium"
                style={{
                  backgroundColor: activeCategory === cat.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                  color: activeCategory === cat.id ? "#F97316" : "rgba(255,255,255,0.35)",
                  border: `1px solid ${activeCategory === cat.id ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>

          {/* Header */}
          <div className="mb-6">
            <h1 className="font-sans text-[20px] font-bold text-white">{activeCat.icon} {activeCat.label}</h1>
            <p className="mt-1 font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Add knowledge that {venueName}&apos;s AI will use when answering guest questions.
            </p>
          </div>

          {/* Add new */}
          <div className="mb-6 rounded-2xl border p-4 sm:p-5" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={activeCat.placeholder}
              rows={4}
              className="mb-3 w-full resize-none rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/15 focus:outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            />
            <div className="flex items-center justify-between">
              <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                Write naturally. The AI will use this when guests ask related questions.
              </p>
              <button
                onClick={handleAdd}
                disabled={saving || !newContent.trim()}
                className="shrink-0 rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "#F97316" }}
              >
                {saving ? "Saving..." : "Add"}
              </button>
            </div>
            {msg && <p className="mt-2 font-sans text-[13px]" style={{ color: msg === "Added!" ? "#4ADE80" : "#EF4444" }}>{msg}</p>}
          </div>

          {/* Existing entries */}
          <div className="flex flex-col gap-3">
            {filteredKnowledge.length === 0 && (
              <p className="py-8 text-center font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                No entries in {activeCat.label} yet. Add one above.
              </p>
            )}
            {filteredKnowledge.map((k) => (
              <div key={k.id} className="group flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white/70">{k.content}</p>
                  <p className="mt-2 font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {new Date(k.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(k.id)}
                  disabled={deleting === k.id}
                  className="shrink-0 rounded-lg p-2 opacity-0 transition group-hover:opacity-100"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                >
                  {deleting === k.id ? (
                    <span className="font-sans text-[11px]" style={{ color: "#EF4444" }}>...</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
