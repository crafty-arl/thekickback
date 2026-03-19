"use client";

import { motion } from "framer-motion";

interface Offering {
    id: string;
    type: string;
    name: string;
    description: string | null;
    price_cents: number;
    recurring: boolean;
    interval: string | null;
    perks: string[];
    active: boolean;
}

interface Props {
    offerings: Offering[];
    themeColor: string;
    venueName: string;
}

const TYPE_ICONS: Record<string, string> = {
    membership: "👑",
    booth_hold: "🪑",
    space_rental: "🏠",
    event_ticket: "🎟️",
    custom: "✦",
};

function formatPrice(cents: number, recurring: boolean, interval: string | null): string {
    const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    if (recurring) return `$${dollars}/${interval === "year" ? "yr" : "mo"}`;
    return `$${dollars}`;
}

export function VenueOfferings({ offerings, themeColor, venueName }: Props) {
    const active = offerings.filter((o) => o.active);
    if (active.length === 0) return null;

    const membership = active.find((o) => o.type === "membership");
    const others = active.filter((o) => o.type !== "membership");

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col gap-3"
        >
            {/* Membership card — hero treatment */}
            {membership && (
                <div
                    className="relative overflow-hidden rounded-2xl border p-5"
                    style={{
                        borderColor: `${themeColor}40`,
                        background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
                    }}
                >
                    {/* Subtle glow */}
                    <div
                        className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl"
                        style={{ backgroundColor: `${themeColor}20` }}
                    />

                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <span className="text-[18px]">👑</span>
                            <h3 className="font-sans text-[15px] font-bold text-white">{membership.name}</h3>
                        </div>
                        {membership.description && (
                            <p className="mt-1 font-sans text-[13px] text-white/40">{membership.description}</p>
                        )}

                        {/* Perks */}
                        {membership.perks.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1.5">
                                {membership.perks.map((perk) => (
                                    <div key={perk} className="flex items-center gap-2">
                                        <div className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: themeColor }} />
                                        <span className="font-sans text-[12px] text-white/50">{perk}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CTA */}
                        <button
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[14px] font-bold text-black active:scale-[0.97]"
                            style={{ backgroundColor: themeColor }}
                        >
                            Join — {formatPrice(membership.price_cents, true, membership.interval)}
                        </button>
                    </div>
                </div>
            )}

            {/* One-time offerings grid */}
            {others.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    {others.map((o) => (
                        <div
                            key={o.id}
                            className="flex flex-col justify-between rounded-xl border p-4"
                            style={{
                                borderColor: "rgba(255,255,255,0.06)",
                                backgroundColor: "rgba(255,255,255,0.02)",
                            }}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[14px]">{TYPE_ICONS[o.type] || "✦"}</span>
                                    <h4 className="font-sans text-[13px] font-semibold text-white/80">{o.name}</h4>
                                </div>
                                {o.description && (
                                    <p className="mt-1 font-sans text-[11px] text-white/30">{o.description}</p>
                                )}
                            </div>
                            <button
                                className="mt-3 flex w-full items-center justify-center rounded-lg py-2 font-sans text-[12px] font-semibold active:scale-[0.97]"
                                style={{
                                    backgroundColor: `${themeColor}20`,
                                    color: themeColor,
                                    border: `1px solid ${themeColor}30`,
                                }}
                            >
                                {formatPrice(o.price_cents, false, null)}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
