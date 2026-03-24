"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { updateVenue } from "@/app/settings/actions";

// ─── Types ───────────────────────────────────────────────────────

interface SettingsVenueDrawerProps {
    venueId: string;
    initialData: {
        address?: string;
        type?: string;
        max_occupancy?: number;
        vibe?: string;
        rules?: string[];
        check_in_radius_meters?: number;
    };
    onClose: () => void;
    onVenueChange?: (data: { address?: string; type?: string }) => void;
}

const VENUE_TYPES = [
    "cafe", "bar", "restaurant", "coworking", "salon", "gym", "club", "studio", "shop", "gallery", "lounge", "other",
];

const VIBE_OPTIONS = ["quiet", "moderate", "busy", "packed"];

// ─── Component ───────────────────────────────────────────────────

export function SettingsVenueDrawer({
    venueId,
    initialData,
    onClose,
    onVenueChange,
}: SettingsVenueDrawerProps) {
    const [address, setAddress] = useState(initialData.address || "");
    const [venueType, setVenueType] = useState(initialData.type || "");
    const [capacity, setCapacity] = useState(initialData.max_occupancy ? String(initialData.max_occupancy) : "");
    const [vibe, setVibe] = useState(initialData.vibe || "");
    const [rules, setRules] = useState((initialData.rules || []).join("\n"));
    const [radius, setRadius] = useState(String(initialData.check_in_radius_meters ?? 150));
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    async function handleSave() {
        setSaving(true);
        setMsg("");

        const payload: Record<string, unknown> = {};
        if (address.trim()) payload.address = address.trim();
        if (venueType) payload.type = venueType;
        if (capacity) payload.max_occupancy = parseInt(capacity);
        if (vibe) payload.vibe = vibe;
        if (rules.trim()) payload.rules = rules.split("\n").map((r) => r.trim()).filter(Boolean);
        if (radius) payload.check_in_radius_meters = parseInt(radius);

        const result = await updateVenue(venueId, payload as Parameters<typeof updateVenue>[1]);
        if (result.error) {
            setMsg(result.error);
        } else {
            setMsg("Saved!");
            onVenueChange?.({ address: address.trim() || undefined, type: venueType || undefined });
            setTimeout(() => setMsg(""), 2000);
        }
        setSaving(false);
    }

    return (
        <>
            <motion.div
                key="venue-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/30"
            />
            <motion.div
                key="venue-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="font-sans text-[16px] font-bold text-gray-900">Venue Details</p>
                        <p className="font-sans text-[12px] text-gray-400">Location, type, capacity, and rules</p>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-5">
                    {/* Address */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-1.5 block">Address</label>
                        <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="123 Main St, City, State"
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                    </div>

                    {/* Venue type */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-2 block">Venue type</label>
                        <div className="flex flex-wrap gap-2">
                            {VENUE_TYPES.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setVenueType(t)}
                                    className={`rounded-lg border px-3 py-1.5 font-sans text-[12px] font-medium capitalize transition active:scale-95 ${
                                        venueType === t
                                            ? "border-orange-300 bg-orange-50 text-orange-600"
                                            : "border-black/[0.06] bg-white text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Capacity */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-1.5 block">Capacity</label>
                        <input
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            placeholder="Max number of guests"
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                    </div>

                    {/* Vibe */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-2 block">Vibe</label>
                        <div className="flex gap-2">
                            {VIBE_OPTIONS.map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setVibe(v)}
                                    className={`flex-1 rounded-lg border py-2 font-sans text-[12px] font-medium capitalize transition active:scale-95 ${
                                        vibe === v
                                            ? "border-orange-300 bg-orange-50 text-orange-600"
                                            : "border-black/[0.06] bg-white text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rules */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-1.5 block">Rules (one per line)</label>
                        <textarea
                            value={rules}
                            onChange={(e) => setRules(e.target.value)}
                            placeholder={"No outside food\nShoes required\nBe kind"}
                            rows={4}
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
                        />
                    </div>

                    {/* GPS check-in radius */}
                    <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500 mb-1.5 block">GPS check-in radius (meters)</label>
                        <input
                            value={radius}
                            onChange={(e) => setRadius(e.target.value)}
                            placeholder="150"
                            type="number"
                            min="10"
                            max="5000"
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                        <p className="font-sans text-[11px] text-gray-400 mt-1">Guests must be within this distance to check in via GPS</p>
                    </div>

                    {/* Status message */}
                    {msg && (
                        <p className="font-sans text-[13px] text-center" style={{ color: msg.includes("Saved") ? "#16A34A" : "#EF4444" }}>{msg}</p>
                    )}
                </div>

                {/* Save button */}
                <div className="shrink-0 border-t border-gray-100 px-5 py-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full rounded-xl bg-orange-500 py-3 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Details"}
                    </button>
                </div>
            </motion.div>
        </>
    );
}
