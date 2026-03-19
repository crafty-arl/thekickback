"use client";

import { useState } from "react";
import Link from "next/link";
import { approveVenue, rejectVenue, unpublishVenue } from "./actions";

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
        max_occupancy: number;
    };
}

interface Stats {
    totalVenues: number;
    pendingVenues: number;
    publishedVenues: number;
    totalMembers: number;
    totalSessions: number;
    totalKnowledge: number;
    totalOfferings: number;
}

interface Props {
    pages: VenuePage[];
    stats: Stats;
}

export function RootClient({ pages, stats }: Props) {
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [acting, setActing] = useState<string | null>(null);

    const filtered = filter === "all" ? pages : pages.filter((p) => p.review_status === filter);

    async function handleApprove(id: string) {
        setActing(id);
        await approveVenue(id);
        setActing(null);
    }

    async function handleReject(id: string) {
        setActing(id);
        await rejectVenue(id);
        setActing(null);
    }

    async function handleUnpublish(id: string) {
        setActing(id);
        await unpublishVenue(id);
        setActing(null);
    }

    return (
        <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
            {/* Header */}
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
                    <StatBox label="Members" value={stats.totalMembers} />
                    <StatBox label="Sessions" value={stats.totalSessions} />
                    <StatBox label="Knowledge" value={stats.totalKnowledge} />
                    <StatBox label="Offerings" value={stats.totalOfferings} />
                </div>

                {/* Filters */}
                <div className="mb-4 flex items-center gap-2">
                    <h2 className="flex-1 font-sans text-[16px] font-semibold text-white">Venues</h2>
                    {(["all", "pending", "approved", "rejected"] as const).map((f) => {
                        const count = f === "all" ? pages.length : pages.filter((p) => p.review_status === f).length;
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
                    {filtered.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-4 rounded-xl border p-4"
                            style={{
                                borderColor: p.review_status === "pending" ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)",
                                backgroundColor: p.review_status === "pending" ? "rgba(249,115,22,0.04)" : "rgba(255,255,255,0.02)",
                            }}
                        >
                            {/* Color dot */}
                            <div className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: p.theme_color || "#F97316" }} />

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-sans text-[14px] font-semibold text-white">{p.venues?.name || p.slug}</p>
                                    <span
                                        className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider"
                                        style={{
                                            backgroundColor:
                                                p.review_status === "approved" ? "rgba(74,222,128,0.15)" :
                                                    p.review_status === "rejected" ? "rgba(239,68,68,0.15)" :
                                                        "rgba(249,115,22,0.15)",
                                            color:
                                                p.review_status === "approved" ? "#4ADE80" :
                                                    p.review_status === "rejected" ? "#EF4444" :
                                                        "#F97316",
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
                                    {p.venues?.address && <span className="font-sans text-[11px] text-white/15 hidden sm:inline">{p.venues.address}</span>}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 items-center gap-2">
                                {p.review_status !== "approved" && (
                                    <button
                                        onClick={() => handleApprove(p.id)}
                                        disabled={acting === p.id}
                                        className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold transition active:scale-95"
                                        style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }}
                                    >
                                        {acting === p.id ? "..." : "Approve"}
                                    </button>
                                )}
                                {p.review_status !== "rejected" && !p.published && (
                                    <button
                                        onClick={() => handleReject(p.id)}
                                        disabled={acting === p.id}
                                        className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition active:scale-95"
                                        style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}
                                    >
                                        {acting === p.id ? "..." : "Reject"}
                                    </button>
                                )}
                                {p.published && (
                                    <button
                                        onClick={() => handleUnpublish(p.id)}
                                        disabled={acting === p.id}
                                        className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition active:scale-95"
                                        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                                    >
                                        {acting === p.id ? "..." : "Unpublish"}
                                    </button>
                                )}
                                <a
                                    href={`https://join.thekickback.net/${p.slug}`}
                                    target="_blank"
                                    className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium"
                                    style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}
                                >
                                    Preview
                                </a>
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
