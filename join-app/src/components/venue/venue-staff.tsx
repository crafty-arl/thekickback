"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export interface StaffMember {
    id: string;
    display_name: string;
    role_title: string | null;
    avatar_url: string | null;
    bio: string | null;
    specialties: string[];
    schedule: { day: string; start: string; end: string }[];
}

interface Props {
    staff: StaffMember[];
    themeColor?: string;
    offeringsByStaff?: Record<string, string[]>;
}

export function VenueStaff({ staff, themeColor = "#F97316", offeringsByStaff = {} }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = staff.find((s) => s.id === selectedId);

    if (!staff || staff.length === 0) return null;

    return (
        <>
            {/* Section header */}
            <div>
                <p
                    className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px]"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                >
                    THE TEAM
                </p>

                {/* Horizontal scrolling staff strip */}
                <div
                    className="flex gap-3.5 overflow-x-auto pb-2"
                    style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
                >
                    {staff.map((member) => (
                        <motion.button
                            key={member.id}
                            onClick={() => setSelectedId(member.id)}
                            whileTap={{ scale: 0.95 }}
                            className="flex shrink-0 flex-col items-center gap-2.5 transition-colors duration-150"
                            style={{ width: 72 }}
                        >
                            {/* Avatar */}
                            <div
                                className="relative flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full"
                                style={{
                                    border: `2px solid ${selectedId === member.id ? themeColor : "rgba(255,255,255,0.1)"}`,
                                    backgroundColor: "rgba(255,255,255,0.06)",
                                }}
                            >
                                {member.avatar_url ? (
                                    <Image
                                        src={member.avatar_url}
                                        alt={member.display_name}
                                        fill
                                        className="object-cover"
                                        sizes="56px"
                                    />
                                ) : (
                                    <span className="text-[20px] font-bold" style={{ color: themeColor }}>
                                        {member.display_name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Name */}
                            <div className="w-full text-center">
                                <p className="truncate font-sans text-[11px] font-medium text-white/70">
                                    {member.display_name.split(" ")[0]}
                                </p>
                                {member.role_title && (
                                    <p className="truncate font-sans text-[9px] text-white/30">
                                        {member.role_title}
                                    </p>
                                )}
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Staff detail sheet */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="overflow-hidden"
                    >
                        <div
                            className="px-5 py-4"
                            style={{
                                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                                border: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            {/* Header row */}
                            <div className="flex items-start gap-3.5">
                                {/* Avatar */}
                                <div
                                    className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                    style={{
                                        border: `2px solid ${themeColor}`,
                                        backgroundColor: "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    {selected.avatar_url ? (
                                        <Image
                                            src={selected.avatar_url}
                                            alt={selected.display_name}
                                            fill
                                            className="object-cover"
                                            sizes="48px"
                                        />
                                    ) : (
                                        <span className="text-[16px] font-bold" style={{ color: themeColor }}>
                                            {selected.display_name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                    <p className="font-sans text-[14px] font-semibold text-white">
                                        {selected.display_name}
                                    </p>
                                    {selected.role_title && (
                                        <p className="font-sans text-[12px]" style={{ color: themeColor }}>
                                            {selected.role_title}
                                        </p>
                                    )}
                                </div>

                                {/* Close */}
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className="flex h-7 w-7 items-center justify-center transition-colors duration-150 hover:bg-white/[0.08]"
                                    style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                >
                                    <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.4)"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    >
                                        <path d="M18 6 6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Bio */}
                            {selected.bio && (
                                <p className="mt-3.5 font-sans text-[12px] leading-[1.6] text-white/40">
                                    {selected.bio}
                                </p>
                            )}

                            {/* Specialties */}
                            {selected.specialties && selected.specialties.length > 0 && (
                                <div className="mt-3.5 flex flex-wrap gap-2">
                                    {selected.specialties.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-3 py-1 font-sans text-[10px] font-medium"
                                            style={{
                                                backgroundColor: `${themeColor}15`,
                                                color: themeColor,
                                                border: `1px solid ${themeColor}30`,
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Schedule (if provided) */}
                            {selected.schedule && selected.schedule.length > 0 && (
                                <div className="mt-4">
                                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/20">
                                        SCHEDULE
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {selected.schedule.map((slot, i) => (
                                            <span
                                                key={i}
                                                className="px-2.5 py-1 font-sans text-[10px] text-white/40"
                                                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                                            >
                                                {slot.day} {slot.start}–{slot.end}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Services this staff member provides */}
                            {offeringsByStaff[selected.id] && offeringsByStaff[selected.id].length > 0 && (
                                <div className="mt-4">
                                    <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/20">
                                        SERVICES
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {offeringsByStaff[selected.id].map((name) => (
                                            <span
                                                key={name}
                                                className="px-2 py-1 font-sans text-[10px] font-medium"
                                                style={{
                                                    backgroundColor: `${themeColor}10`,
                                                    color: `${themeColor}`,
                                                    border: `1px solid ${themeColor}25`,
                                                }}
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hide scrollbar */}
            <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
        </>
    );
}
