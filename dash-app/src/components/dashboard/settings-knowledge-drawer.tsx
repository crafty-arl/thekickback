"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { addKnowledge, deleteKnowledge, updateAiLimits, getAiUsageStats } from "@/app/settings/actions";

// ─── Constants ──────────────────────────────────────────────────────

const KNOWLEDGE_CATEGORIES = [
    { id: "menu", label: "Menu & Drinks", icon: "🍸", placeholder: "We serve craft cocktails, local beers on tap, and a full espresso bar. Our signature drink is the Rooftop Sunset — mezcal, grapefruit, agave." },
    { id: "hours", label: "Hours & Policies", icon: "🕐", placeholder: "Open Wednesday through Saturday, 4 PM to midnight. Kitchen closes at 11 PM. Reservations recommended for groups of 6+." },
    { id: "events", label: "Events & Specials", icon: "🎵", placeholder: "Live DJ every Friday 9 PM–12 AM. Happy hour Mon–Thu 4–6 PM, half off wells and drafts." },
    { id: "location", label: "Location & Access", icon: "📍", placeholder: "Located on the 12th floor of the Meridian Building. Enter through the lobby, take the elevator to 12." },
    { id: "faq", label: "FAQ", icon: "❓", placeholder: "Yes, we have oat milk. No, we don't take reservations for the bar area. Dress code is smart casual." },
    { id: "general", label: "Custom", icon: "📝", placeholder: "Add any other information your AI should know about your venue..." },
];

// ─── Types ──────────────────────────────────────────────────────────

interface KnowledgeEntry {
    id: string;
    content: string;
    category: string;
    created_at: string;
}

interface AiLimits {
    free_messages_per_day: number;
    require_membership: boolean;
    gate_message: string;
}

interface UsageStats {
    todayMessages: number;
    todayGuests: number;
    weekMessages: number;
}

export interface SettingsKnowledgeDrawerProps {
    venueId: string;
    onClose: () => void;
    initialKnowledge?: KnowledgeEntry[];
    initialAiLimits?: AiLimits | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function SettingsKnowledgeDrawer({
    venueId,
    onClose,
    initialKnowledge = [],
    initialAiLimits = null,
}: SettingsKnowledgeDrawerProps) {
    // Knowledge state
    const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialKnowledge);
    const [activeCat, setActiveCat] = useState("menu");
    const [newContent, setNewContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [knowledgeMsg, setKnowledgeMsg] = useState("");

    // AI limits state
    const [limitsEnabled, setLimitsEnabled] = useState(initialAiLimits !== null);
    const [freeMessages, setFreeMessages] = useState(String(initialAiLimits?.free_messages_per_day ?? 10));
    const [requireMembership, setRequireMembership] = useState(initialAiLimits?.require_membership ?? false);
    const [gateMessage, setGateMessage] = useState(initialAiLimits?.gate_message ?? "You've used your free messages for today. Sign up to keep chatting!");
    const [savingLimits, setSavingLimits] = useState(false);
    const [limitsMsg, setLimitsMsg] = useState("");
    const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

    // Derived
    const activeCategory = KNOWLEDGE_CATEGORIES.find((c) => c.id === activeCat)!;
    const filtered = knowledge.filter((k) => k.category === activeCat);

    // Close on Escape
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    // ─── Handlers ───────────────────────────────────────────────────

    async function handleAdd() {
        if (!newContent.trim()) return;
        setSaving(true);
        setKnowledgeMsg("");
        const result = await addKnowledge(newContent, activeCat);
        if (result.error) {
            setKnowledgeMsg(result.error);
        } else {
            // Optimistically add to local state
            const entry: KnowledgeEntry = {
                id: crypto.randomUUID(),
                content: newContent.trim(),
                category: activeCat,
                created_at: new Date().toISOString(),
            };
            setKnowledge((prev) => [entry, ...prev]);
            setNewContent("");
            setKnowledgeMsg("Added!");
            setTimeout(() => setKnowledgeMsg(""), 2000);
        }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        setDeletingId(id);
        await deleteKnowledge(id);
        setKnowledge((prev) => prev.filter((k) => k.id !== id));
        setDeletingId(null);
    }

    async function handleSaveLimits() {
        setSavingLimits(true);
        setLimitsMsg("");
        const result = await updateAiLimits({
            free_messages_per_day: parseInt(freeMessages) || 10,
            require_membership: requireMembership,
            gate_message: gateMessage,
        });
        if (result.error) setLimitsMsg(result.error);
        else {
            setLimitsMsg("Saved!");
            setTimeout(() => setLimitsMsg(""), 2000);
        }
        setSavingLimits(false);
    }

    async function handleLoadStats() {
        const stats = await getAiUsageStats();
        if (!("error" in stats)) setUsageStats(stats);
    }

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <>
            {/* Backdrop */}
            <motion.div
                key="knowledge-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/30"
            />

            {/* Panel */}
            <motion.div
                key="knowledge-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="font-sans text-[16px] font-bold text-gray-900">AI Knowledge Base</p>
                        <p className="font-sans text-[12px] text-gray-400">{knowledge.length} entries across all categories</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                    {/* ── Category pills ── */}
                    <div className="flex flex-wrap gap-2">
                        {KNOWLEDGE_CATEGORIES.map((cat) => {
                            const count = knowledge.filter((k) => k.category === cat.id).length;
                            const isActive = activeCat === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCat(cat.id)}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition"
                                    style={{
                                        backgroundColor: isActive ? "rgba(249,115,22,0.12)" : "rgba(0,0,0,0.03)",
                                        color: isActive ? "#ea580c" : "#6b7280",
                                        border: `1px solid ${isActive ? "rgba(249,115,22,0.25)" : "rgba(0,0,0,0.06)"}`,
                                    }}
                                >
                                    <span>{cat.icon}</span> {cat.label}
                                    {count > 0 && (
                                        <span
                                            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                            style={{ backgroundColor: isActive ? "rgba(249,115,22,0.15)" : "rgba(0,0,0,0.06)", color: isActive ? "#ea580c" : "#9ca3af" }}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Add new entry ── */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                        <textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder={activeCategory.placeholder}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-sans text-[14px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                        />
                        <div className="mt-3 flex items-center justify-between">
                            <p className="font-sans text-[11px] text-gray-400">
                                Write like you're explaining to a friend.
                            </p>
                            <button
                                onClick={handleAdd}
                                disabled={saving || !newContent.trim()}
                                className="shrink-0 rounded-xl bg-orange-500 px-5 py-2 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-40 hover:bg-orange-600"
                            >
                                {saving ? "Saving..." : "Add"}
                            </button>
                        </div>
                        {knowledgeMsg && (
                            <p className="mt-2 font-sans text-[13px]" style={{ color: knowledgeMsg === "Added!" ? "#16a34a" : "#dc2626" }}>
                                {knowledgeMsg}
                            </p>
                        )}
                    </div>

                    {/* ── Existing entries ── */}
                    {filtered.length === 0 && (
                        <p className="py-6 text-center font-sans text-[13px] text-gray-300">
                            No entries in {activeCategory.label} yet.
                        </p>
                    )}
                    {filtered.map((k) => (
                        <div
                            key={k.id}
                            className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 transition hover:border-gray-200"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-gray-700">{k.content}</p>
                                <p className="mt-2 font-sans text-[11px] text-gray-300">
                                    {new Date(k.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(k.id)}
                                disabled={deletingId === k.id}
                                className="shrink-0 rounded-lg p-2 opacity-0 transition group-hover:opacity-100 hover:bg-red-50"
                            >
                                {deletingId === k.id ? (
                                    <span className="font-sans text-[11px] text-red-400">...</span>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    ))}

                    {/* ── Separator ── */}
                    <div className="border-t border-gray-100 pt-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-sans text-[14px] font-semibold text-gray-900">Chat Limits</h3>
                                <p className="font-sans text-[12px] text-gray-400">Control free AI messages before guests need to sign up.</p>
                            </div>
                            <button
                                onClick={() => setLimitsEnabled(!limitsEnabled)}
                                className="relative h-6 w-11 rounded-full transition"
                                style={{ backgroundColor: limitsEnabled ? "#f97316" : "#e5e7eb" }}
                            >
                                <div
                                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                                    style={{ left: limitsEnabled ? 22 : 2 }}
                                />
                            </button>
                        </div>

                        {limitsEnabled && (
                            <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                                {/* Free messages */}
                                <div>
                                    <label className="font-sans text-[12px] font-semibold text-gray-600">Free messages per day</label>
                                    <p className="mb-1.5 font-sans text-[11px] text-gray-400">After this many, guests see your gate message</p>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={freeMessages}
                                        onChange={(e) => setFreeMessages(e.target.value)}
                                        className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[14px] text-gray-800 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                                    />
                                </div>

                                {/* Members unlimited toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-sans text-[12px] font-semibold text-gray-600">Members get unlimited</p>
                                        <p className="font-sans text-[11px] text-gray-400">Guests with a membership skip the limit</p>
                                    </div>
                                    <button
                                        onClick={() => setRequireMembership(!requireMembership)}
                                        className="relative h-6 w-11 shrink-0 rounded-full transition"
                                        style={{ backgroundColor: requireMembership ? "#4ade80" : "#e5e7eb" }}
                                    >
                                        <div
                                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                                            style={{ left: requireMembership ? 22 : 2 }}
                                        />
                                    </button>
                                </div>

                                {/* Gate message */}
                                <div>
                                    <label className="font-sans text-[12px] font-semibold text-gray-600">Gate message</label>
                                    <p className="mb-1.5 font-sans text-[11px] text-gray-400">What guests see when they hit the limit</p>
                                    <textarea
                                        value={gateMessage}
                                        onChange={(e) => setGateMessage(e.target.value)}
                                        rows={2}
                                        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-sans text-[14px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                                        placeholder="You've used your free messages for today. Sign up to keep chatting!"
                                    />
                                </div>

                                {/* Actions row */}
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handleLoadStats}
                                        className="font-sans text-[11px] font-medium text-gray-400 underline transition hover:text-gray-600"
                                    >
                                        View today&apos;s usage
                                    </button>
                                    <button
                                        onClick={handleSaveLimits}
                                        disabled={savingLimits}
                                        className="rounded-lg bg-orange-500 px-4 py-2 font-sans text-[12px] font-semibold text-white transition active:scale-95 disabled:opacity-40 hover:bg-orange-600"
                                    >
                                        {savingLimits ? "Saving..." : "Save Limits"}
                                    </button>
                                </div>

                                {limitsMsg && (
                                    <p className="font-sans text-[12px] font-medium" style={{ color: limitsMsg === "Saved!" ? "#16a34a" : "#dc2626" }}>
                                        {limitsMsg}
                                    </p>
                                )}

                                {/* Usage stats */}
                                {usageStats && (
                                    <div className="flex gap-3">
                                        <div className="flex-1 rounded-lg border border-orange-100 bg-orange-50 p-3 text-center">
                                            <p className="font-mono text-[18px] font-bold text-orange-500">{usageStats.todayMessages}</p>
                                            <p className="font-sans text-[10px] text-gray-400">messages today</p>
                                        </div>
                                        <div className="flex-1 rounded-lg border border-green-100 bg-green-50 p-3 text-center">
                                            <p className="font-mono text-[18px] font-bold text-green-500">{usageStats.todayGuests}</p>
                                            <p className="font-sans text-[10px] text-gray-400">guests today</p>
                                        </div>
                                        <div className="flex-1 rounded-lg border border-violet-100 bg-violet-50 p-3 text-center">
                                            <p className="font-mono text-[18px] font-bold text-violet-500">{usageStats.weekMessages}</p>
                                            <p className="font-sans text-[10px] text-gray-400">this week</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
}
