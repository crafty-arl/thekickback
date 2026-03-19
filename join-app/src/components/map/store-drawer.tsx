"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    type Venue,
    getVibeHexColor,
    getVibeLabel,
    getOccupancyPercent,
} from "@/lib/venues";

interface StoreDrawerProps {
    venues: Venue[];
    onClose: () => void;
    onVenueSelect: (venue: Venue) => void;
    userLocation?: { latitude: number; longitude: number } | null;
}

type FilterId = "all" | "nearby" | "trending" | "quiet" | "poppin" | "members";

const FILTERS: { id: FilterId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "nearby", label: "Nearby" },
    { id: "trending", label: "Trending" },
    { id: "quiet", label: "Quiet" },
    { id: "poppin", label: "Poppin" },
    { id: "members", label: "Members Only" },
];

const ACCENT = "#a78bfa";

function getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 3959; // miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function StoreDrawer({
    venues,
    onClose,
    onVenueSelect,
    userLocation,
}: StoreDrawerProps) {
    const [filter, setFilter] = useState<FilterId>("all");
    const [search, setSearch] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const filteredVenues = useMemo(() => {
        let result = [...venues];

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (v) =>
                    v.name.toLowerCase().includes(q) ||
                    v.neighborhood.toLowerCase().includes(q) ||
                    v.category.toLowerCase().includes(q) ||
                    v.tags.some((t) => t.toLowerCase().includes(q))
            );
        }

        // Category filter
        switch (filter) {
            case "nearby":
                if (userLocation) {
                    result = result
                        .map((v) => ({
                            venue: v,
                            dist: getDistance(
                                userLocation.latitude,
                                userLocation.longitude,
                                v.latitude,
                                v.longitude
                            ),
                        }))
                        .sort((a, b) => a.dist - b.dist)
                        .map((x) => x.venue);
                }
                break;
            case "trending":
                result.sort(
                    (a, b) => getOccupancyPercent(b) - getOccupancyPercent(a)
                );
                break;
            case "quiet":
                result = result.filter((v) => v.vibe === "quiet");
                break;
            case "poppin":
                result = result.filter(
                    (v) => v.vibe === "busy" || v.vibe === "lit" || v.vibe === "packed"
                );
                break;
            case "members":
                result = result.filter((v) => v.memberOnly);
                break;
        }

        return result;
    }, [venues, filter, search, userLocation]);

    return (
        <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed inset-0 z-[70] flex flex-col"
            style={{
                background: "rgba(8, 8, 10, 0.97)",
                backdropFilter: "blur(60px) saturate(1.5)",
                WebkitBackdropFilter: "blur(60px) saturate(1.5)",
            }}
        >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
                <div
                    className="h-1 w-10 rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4">
                <h1 className="font-sans text-[26px] font-bold text-white tracking-tight">
                    Explore
                </h1>
                <motion.button
                    onClick={onClose}
                    whileTap={{ scale: 0.85 }}
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="opacity-50"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </motion.button>
            </div>

            {/* Filter rail */}
            <div
                className="flex gap-2 overflow-x-auto px-5 pb-3"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                {FILTERS.map((f) => (
                    <motion.button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        whileTap={{ scale: 0.95 }}
                        className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-semibold transition-colors"
                        style={
                            filter === f.id
                                ? {
                                    backgroundColor: ACCENT,
                                    color: "#000",
                                    boxShadow: `0 2px 12px ${ACCENT}40`,
                                }
                                : {
                                    backgroundColor: "rgba(255,255,255,0.04)",
                                    color: "rgba(255,255,255,0.45)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                }
                        }
                    >
                        {f.label}
                    </motion.button>
                ))}
            </div>

            {/* Search bar */}
            <div className="px-5 pb-3">
                <div
                    className="flex items-center gap-2.5 rounded-xl px-3.5"
                    style={{
                        height: 42,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search venues..."
                        autoComplete="off"
                        autoCorrect="off"
                        className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/70 placeholder:text-white/25 focus:outline-none"
                    />
                    <AnimatePresence>
                        {search && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => setSearch("")}
                                className="flex h-5 w-5 items-center justify-center rounded-full"
                                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                            >
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Venue count */}
            <div className="px-5 pb-2">
                <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">
                    {filteredVenues.length} VENUE
                    {filteredVenues.length !== 1 ? "S" : ""}
                </span>
            </div>

            {/* Venue list */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))]"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                <div className="flex flex-col gap-2.5">
                    <AnimatePresence mode="popLayout">
                        {filteredVenues.map((venue, i) => {
                            const vibeColor = getVibeHexColor(venue.vibe);
                            const pct = getOccupancyPercent(venue);
                            const themeColor = venue.themeColor || vibeColor;

                            return (
                                <motion.button
                                    key={venue.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{
                                        type: "spring",
                                        damping: 25,
                                        stiffness: 300,
                                        delay: Math.min(i * 0.04, 0.3),
                                    }}
                                    onClick={() => onVenueSelect(venue)}
                                    className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors active:scale-[0.98]"
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    {/* Avatar */}
                                    <div
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)`,
                                            border: `1.5px solid ${themeColor}35`,
                                        }}
                                    >
                                        <span
                                            className="font-sans text-[15px] font-bold"
                                            style={{ color: themeColor }}
                                        >
                                            {venue.name[0]}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate font-sans text-[14px] font-semibold text-white/85">
                                                {venue.name}
                                            </p>
                                            {venue.claimed && (
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill={ACCENT}
                                                    className="shrink-0"
                                                >
                                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                            )}
                                        </div>
                                        <p className="truncate font-sans text-[11px] text-white/30">
                                            {venue.neighborhood || venue.category}
                                        </p>
                                        {/* Tags */}
                                        {venue.tags.length > 0 && (
                                            <div className="mt-1 flex gap-1 overflow-hidden">
                                                {venue.tags.slice(0, 3).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[9px] font-medium text-white/25"
                                                        style={{
                                                            backgroundColor: "rgba(255,255,255,0.04)",
                                                            border: "1px solid rgba(255,255,255,0.06)",
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side — vibe + occupancy */}
                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div
                                                className="h-2 w-2 rounded-full"
                                                style={{
                                                    backgroundColor: vibeColor,
                                                    boxShadow: `0 0 6px ${vibeColor}50`,
                                                }}
                                            />
                                            <span
                                                className="font-sans text-[10px] font-medium"
                                                style={{ color: vibeColor }}
                                            >
                                                {getVibeLabel(venue.vibe)}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[11px] font-medium text-white/25">
                                            {venue.occupancy}/{venue.capacity}
                                        </span>
                                        {/* Tiny occupancy bar */}
                                        <div
                                            className="h-1 w-12 overflow-hidden rounded-full"
                                            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                                        >
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor:
                                                        pct >= 90
                                                            ? "#f87171"
                                                            : pct >= 65
                                                                ? "#f97316"
                                                                : pct >= 35
                                                                    ? "#facc15"
                                                                    : "#4ade80",
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Chevron */}
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.15)"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="shrink-0"
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>

                    {/* Empty state */}
                    {filteredVenues.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-16"
                        >
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <p className="mt-3 font-sans text-[13px] text-white/25">
                                No venues match your search
                            </p>
                            <button
                                onClick={() => {
                                    setSearch("");
                                    setFilter("all");
                                }}
                                className="mt-2 font-sans text-[12px] font-medium"
                                style={{ color: ACCENT }}
                            >
                                Clear filters
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
