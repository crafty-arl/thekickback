"use client";

import { useState } from "react";
import Link from "next/link";
import { rootSendOtp, rootVerifyOtp, approveVenue, rejectVenue, unpublishVenue, deleteVenue, updateAiConfig } from "./actions";

const DEFAULT_CHAT_MODELS = [
    { id: "openclaw", label: "OpenClaw (default)", provider: "openclaw" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", provider: "cloudflare" },
    { id: "@cf/meta/llama-3.2-3b-instruct", label: "Llama 3.2 3B", provider: "cloudflare" },
    { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", label: "DeepSeek R1 32B", provider: "cloudflare" },
];
const DEFAULT_ONBOARDING_MODELS = [
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", provider: "cloudflare" },
    { id: "@cf/meta/llama-3.2-3b-instruct", label: "Llama 3.2 3B", provider: "cloudflare" },
    { id: "openclaw", label: "OpenClaw", provider: "openclaw" },
];

interface VenuePage {
    id: string;
    slug: string;
    tagline: string | null;
    theme_color: string;
    review_status: string;
    published: boolean;
    created_at: string;
    venues: {
        id: string;
        name: string;
        type: string;
        address: string | null;
        neighborhood: string | null;
        lat: number | null;
        lng: number | null;
        max_occupancy: number;
    };
}

interface OrphanVenue {
    id: string;
    name: string;
    type: string;
    address: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    max_occupancy: number;
    state: string;
    vibe: string;
    occupancy: number;
    created_at: string;
}

interface Stats {
    totalVenues: number;
    pendingVenues: number;
    publishedVenues: number;
    orphanVenues: number;
    totalMembers: number;
    totalSessions: number;
    totalKnowledge: number;
    totalOfferings: number;
}

interface AiConfig {
    chat_model: string;
    chat_model_label: string;
    onboarding_model: string;
    onboarding_model_label: string;
    fallback_model: string;
    fallback_model_label: string;
    available_chat_models: { id: string; label: string; provider: string }[];
    available_onboarding_models: { id: string; label: string; provider: string }[];
}

interface Props {
    pages: VenuePage[];
    orphanVenues: OrphanVenue[];
    stats: Stats | null;
    authed: boolean;
    aiConfig?: AiConfig | null;
}

export function RootClient({ pages, orphanVenues, stats, authed, aiConfig }: Props) {
    // If not authed, show OTP gate
    if (!authed) return <OtpGate />;

    return <AdminDashboard pages={pages} orphanVenues={orphanVenues || []} stats={stats!} aiConfig={aiConfig || null} />;
}

// ─── OTP Gate ────────────────────────────────────────────────────

function OtpGate() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"email" | "verify">("email");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        const result = await rootSendOtp(email);
        if (result.error) { setError(result.error); setLoading(false); return; }
        setStep("verify");
        setLoading(false);
    }

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        const result = await rootVerifyOtp(email, otp);
        if (result?.error) { setError(result.error); setLoading(false); }
        // On success, server revalidates and page re-renders with authed=true
    }

    return (
        <main className="flex min-h-svh items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
            <div className="w-full max-w-sm px-6">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
                        <span className="text-[24px]">🔒</span>
                    </div>
                    <h1 className="font-sans text-[24px] font-bold text-white">Root Access</h1>
                    <p className="mt-1 font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {step === "email" ? "Enter your admin email to continue." : `Code sent to ${email}`}
                    </p>
                </div>

                {step === "email" ? (
                    <form onSubmit={handleSend} className="flex flex-col gap-4">
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@email.com"
                            autoFocus
                            className="rounded-xl border px-4 py-3.5 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                        />
                        {error && <p className="rounded-lg px-3 py-2 font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>}
                        <button type="submit" disabled={loading} className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-white active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: "#EF4444" }}>
                            {loading ? "Sending..." : "Send Code"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} className="flex flex-col gap-4">
                        <input
                            type="text"
                            required
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            autoFocus
                            className="rounded-xl border px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.3em] text-white placeholder:text-white/15 focus:outline-none"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                        />
                        {error && <p className="rounded-lg px-3 py-2 font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>}
                        <button type="submit" disabled={loading || otp.length < 6} className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-white active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: "#EF4444" }}>
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                        <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="font-sans text-[13px] active:opacity-60" style={{ color: "rgba(255,255,255,0.3)" }}>
                            Use a different email
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}

// ─── Admin Dashboard ─────────────────────────────────────────────

function AdminDashboard({ pages, orphanVenues, stats, aiConfig }: { pages: VenuePage[]; orphanVenues: OrphanVenue[]; stats: Stats; aiConfig: AiConfig | null }) {
    const [filter, setFilter] = useState<"all" | "draft" | "pending" | "approved" | "rejected" | "orphan">("all");
    const [acting, setActing] = useState<string | null>(null);
    const [showAiConfig, setShowAiConfig] = useState(false);
    const [savingAi, setSavingAi] = useState(false);
    const [chatModel, setChatModel] = useState({ id: aiConfig?.chat_model || "openclaw", label: aiConfig?.chat_model_label || "OpenClaw" });
    const [onboardingModel, setOnboardingModel] = useState({ id: aiConfig?.onboarding_model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: aiConfig?.onboarding_model_label || "Llama 3.3 70B" });
    const [fallbackModel, setFallbackModel] = useState({ id: aiConfig?.fallback_model || "@cf/meta/llama-3.2-3b-instruct", label: aiConfig?.fallback_model_label || "Llama 3.2 3B" });

    const filtered = filter === "all" ? pages : pages.filter((p) => p.review_status === filter);

    async function handleApprove(id: string) { setActing(id); await approveVenue(id); setActing(null); }
    async function handleReject(id: string) { setActing(id); await rejectVenue(id); setActing(null); }
    async function handleUnpublish(id: string) { setActing(id); await unpublishVenue(id); setActing(null); }
    async function handleDelete(pageId: string, venueId: string) {
        if (!confirm("Delete this hub and ALL its data? This cannot be undone.")) return;
        setActing(pageId);
        await deleteVenue(pageId, venueId);
        setActing(null);
    }

    return (
        <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
            <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/"><img src="/logo.png" alt="theKickBack" className="h-6 w-auto" /></Link>
                    <div className="hidden h-4 w-px sm:block" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                    <span className="font-sans text-[13px] font-bold" style={{ color: "#EF4444" }}>ROOT</span>
                </div>
                <Link href="/" className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Dashboard</Link>
            </header>

            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                {/* Stats */}
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatBox label="Venues" value={stats.totalVenues} />
                    <StatBox label="Pending" value={stats.pendingVenues} accent="#F97316" />
                    <StatBox label="Published" value={stats.publishedVenues} accent="#4ADE80" />
                    <StatBox label="No Page" value={stats.orphanVenues} accent="#EF4444" />
                    <StatBox label="Members" value={stats.totalMembers} />
                    <StatBox label="Sessions" value={stats.totalSessions} />
                    <StatBox label="Knowledge" value={stats.totalKnowledge} />
                    <StatBox label="Offerings" value={stats.totalOfferings} />
                </div>

                {/* AI Model Config */}
                <div className="mb-8 rounded-2xl border p-5" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-sans text-[16px] font-semibold text-white">AI Models</h2>
                            <p className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Change the AI model for chat, onboarding, and fallback</p>
                        </div>
                        <button onClick={() => setShowAiConfig(!showAiConfig)} className="font-sans text-[12px] text-white/40">
                            {showAiConfig ? "Hide" : "Configure"}
                        </button>
                    </div>

                    {/* Current models summary (always visible) */}
                    <div className="flex flex-wrap gap-3">
                        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                            <p className="font-sans text-[9px] font-bold tracking-wider text-white/25">CHAT</p>
                            <p className="font-sans text-[13px] font-medium text-white/70">{chatModel.label}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                            <p className="font-sans text-[9px] font-bold tracking-wider text-white/25">ONBOARDING</p>
                            <p className="font-sans text-[13px] font-medium text-white/70">{onboardingModel.label}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                            <p className="font-sans text-[9px] font-bold tracking-wider text-white/25">FALLBACK</p>
                            <p className="font-sans text-[13px] font-medium text-white/70">{fallbackModel.label}</p>
                        </div>
                    </div>

                    {/* Expanded config (when showAiConfig is true) */}
                    {showAiConfig && (
                        <div className="mt-4 flex flex-col gap-4 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            {/* Chat Model */}
                            <div>
                                <label className="mb-1.5 block font-sans text-[12px] font-semibold text-white/50">Chat Model (owner + guest chat)</label>
                                <div className="flex flex-wrap gap-2">
                                    {(aiConfig?.available_chat_models || DEFAULT_CHAT_MODELS).map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={async () => {
                                                setSavingAi(true);
                                                await updateAiConfig({ chat_model: m.id, chat_model_label: m.label });
                                                setChatModel(m);
                                                setSavingAi(false);
                                            }}
                                            disabled={savingAi}
                                            className="rounded-lg border px-3 py-2 font-sans text-[12px] font-medium transition active:scale-95"
                                            style={{
                                                backgroundColor: chatModel.id === m.id ? "rgba(249,115,22,0.15)" : "transparent",
                                                borderColor: chatModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.08)",
                                                color: chatModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.4)",
                                            }}
                                        >
                                            {m.label}
                                            <span className="ml-1 text-[9px] text-white/20">{m.provider}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Onboarding Model */}
                            <div>
                                <label className="mb-1.5 block font-sans text-[12px] font-semibold text-white/50">Onboarding Model (hub setup)</label>
                                <div className="flex flex-wrap gap-2">
                                    {(aiConfig?.available_onboarding_models || DEFAULT_ONBOARDING_MODELS).map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={async () => {
                                                setSavingAi(true);
                                                await updateAiConfig({ onboarding_model: m.id, onboarding_model_label: m.label });
                                                setOnboardingModel(m);
                                                setSavingAi(false);
                                            }}
                                            disabled={savingAi}
                                            className="rounded-lg border px-3 py-2 font-sans text-[12px] font-medium transition active:scale-95"
                                            style={{
                                                backgroundColor: onboardingModel.id === m.id ? "rgba(249,115,22,0.15)" : "transparent",
                                                borderColor: onboardingModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.08)",
                                                color: onboardingModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.4)",
                                            }}
                                        >
                                            {m.label}
                                            <span className="ml-1 text-[9px] text-white/20">{m.provider}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fallback Model */}
                            <div>
                                <label className="mb-1.5 block font-sans text-[12px] font-semibold text-white/50">Fallback Model (when primary fails)</label>
                                <div className="flex flex-wrap gap-2">
                                    {(aiConfig?.available_onboarding_models || DEFAULT_ONBOARDING_MODELS).map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={async () => {
                                                setSavingAi(true);
                                                await updateAiConfig({ fallback_model: m.id, fallback_model_label: m.label });
                                                setFallbackModel(m);
                                                setSavingAi(false);
                                            }}
                                            disabled={savingAi}
                                            className="rounded-lg border px-3 py-2 font-sans text-[12px] font-medium transition active:scale-95"
                                            style={{
                                                backgroundColor: fallbackModel.id === m.id ? "rgba(249,115,22,0.15)" : "transparent",
                                                borderColor: fallbackModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.08)",
                                                color: fallbackModel.id === m.id ? "#F97316" : "rgba(255,255,255,0.4)",
                                            }}
                                        >
                                            {m.label}
                                            <span className="ml-1 text-[9px] text-white/20">{m.provider}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="mb-4 flex items-center gap-2">
                    <h2 className="flex-1 font-sans text-[16px] font-semibold text-white">Venues</h2>
                    {(["all", "draft", "pending", "approved", "rejected", "orphan"] as const).map((f) => {
                        const count = f === "all" ? pages.length + orphanVenues.length
                            : f === "orphan" ? orphanVenues.length
                                : pages.filter((p) => p.review_status === f).length;
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium capitalize transition"
                                style={{
                                    backgroundColor: filter === f ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                                    color: filter === f ? "#fff" : "rgba(255,255,255,0.35)",
                                    border: `1px solid ${filter === f ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                                }}
                            >
                                {f} {count > 0 && <span className="ml-1 text-white/30">({count})</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Venue list */}
                <div className="flex flex-col gap-3">
                    {filtered.length === 0 && (
                        <p className="py-8 text-center font-sans text-[14px] text-white/30">No venues match this filter.</p>
                    )}
                    {filter !== "orphan" && filtered.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-4 rounded-xl border p-4"
                            style={{
                                borderColor: p.review_status === "pending" ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)",
                                backgroundColor: p.review_status === "pending" ? "rgba(249,115,22,0.04)" : "rgba(255,255,255,0.02)",
                            }}
                        >
                            <div className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: p.theme_color || "#F97316" }} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-sans text-[14px] font-semibold text-white">{p.venues?.name || p.slug}</p>
                                    <span
                                        className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider"
                                        style={{
                                            backgroundColor: p.review_status === "approved" ? "rgba(74,222,128,0.15)" : p.review_status === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)",
                                            color: p.review_status === "approved" ? "#4ADE80" : p.review_status === "rejected" ? "#EF4444" : "#F97316",
                                        }}
                                    >
                                        {p.review_status?.toUpperCase() || "PENDING"}
                                    </span>
                                    {p.published && (
                                        <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider" style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80" }}>LIVE</span>
                                    )}
                                </div>
                                <div className="mt-1 flex items-center gap-3">
                                    <span className="font-sans text-[12px] text-white/30">{p.slug}</span>
                                    {p.venues?.type && <span className="font-sans text-[11px] capitalize text-white/20">{p.venues.type}</span>}
                                    {p.venues?.address && <span className="font-sans text-[11px] text-white/15 truncate max-w-[200px]">{p.venues.address}</span>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {p.review_status !== "approved" && (
                                    <button onClick={() => handleApprove(p.id)} disabled={acting === p.id} className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold transition active:scale-95" style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                                        {acting === p.id ? "..." : "Approve"}
                                    </button>
                                )}
                                {p.review_status !== "rejected" && !p.published && (
                                    <button onClick={() => handleReject(p.id)} disabled={acting === p.id} className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition active:scale-95" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                                        {acting === p.id ? "..." : "Reject"}
                                    </button>
                                )}
                                {p.published && (
                                    <button onClick={() => handleUnpublish(p.id)} disabled={acting === p.id} className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition active:scale-95" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                                        {acting === p.id ? "..." : "Unpublish"}
                                    </button>
                                )}
                                <a href={`https://join.thekickback.net/${p.slug}`} target="_blank" className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>
                                    Preview
                                </a>
                                <button onClick={() => handleDelete(p.id, p.venues?.id)} disabled={acting === p.id || !p.venues?.id} className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium transition active:scale-95" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)" }}>
                                    {acting === p.id ? "..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Orphan venues — show when filter is 'all' or 'orphan' */}
                    {(filter === "all" || filter === "orphan") && orphanVenues.map((v) => (
                        <div
                            key={v.id}
                            className="flex items-center gap-4 rounded-xl border p-4"
                            style={{
                                borderColor: "rgba(239,68,68,0.2)",
                                backgroundColor: "rgba(239,68,68,0.04)",
                            }}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
                                <span className="text-[16px]">⚠️</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-sans text-[14px] font-semibold text-white">{v.name}</p>
                                    <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                                        NO PAGE
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-3">
                                    {v.type && <span className="font-sans text-[11px] capitalize text-white/20">{v.type}</span>}
                                    {v.address && <span className="font-sans text-[11px] text-white/15 truncate max-w-[200px]">{v.address}</span>}
                                    <span className="font-sans text-[11px] text-white/10">Venue exists but has no landing page</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <p className="font-mono text-[20px] font-bold" style={{ color: accent || "#fff" }}>{value}</p>
            <p className="font-sans text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
        </div>
    );
}
