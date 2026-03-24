"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { updateVenuePage } from "@/app/settings/actions";

// ─── Types ───────────────────────────────────────────────────────

interface HoursEntry {
    day: string;
    open: string;
    close: string;
    closed: boolean;
}

interface SettingsHoursDrawerProps {
    venueId: string;
    initialHours: { day: string; open: string; close: string }[] | null;
    onClose: () => void;
    onHoursChange?: (hoursText: string) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parseTime12to24(t: string): string {
    if (!t) return "";
    // Already 24h format (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(t) && !t.includes("AM") && !t.includes("PM")) return t;
    const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return t;
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
}

function parseTime24to12(t: string): string {
    if (!t) return "";
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr);
    const m = mStr || "00";
    const period = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
}

function computeDisplayString(hours: HoursEntry[]): string {
    const open = hours.filter((h) => !h.closed && h.open && h.close);
    if (open.length === 0) return "Closed";

    // Group consecutive days with same hours
    const groups: { days: string[]; open: string; close: string }[] = [];
    for (const h of open) {
        const last = groups[groups.length - 1];
        if (last && last.open === h.open && last.close === h.close) {
            last.days.push(h.day);
        } else {
            groups.push({ days: [h.day], open: h.open, close: h.close });
        }
    }

    const shortDay = (d: string) => d.slice(0, 3);
    return groups.map((g) => {
        const dayRange = g.days.length === 1
            ? shortDay(g.days[0])
            : `${shortDay(g.days[0])}-${shortDay(g.days[g.days.length - 1])}`;
        const openStr = parseTime24to12(g.open).replace(":00 ", "").toLowerCase();
        const closeStr = parseTime24to12(g.close).replace(":00 ", "").toLowerCase();
        return `${dayRange} ${openStr}-${closeStr}`;
    }).join(", ");
}

// ─── Component ───────────────────────────────────────────────────

export function SettingsHoursDrawer({
    venueId,
    initialHours,
    onClose,
    onHoursChange,
}: SettingsHoursDrawerProps) {
    const [hours, setHours] = useState<HoursEntry[]>(() => {
        return DAYS.map((day) => {
            const existing = initialHours?.find((h) => h.day === day);
            if (existing) {
                return {
                    day,
                    open: parseTime12to24(existing.open),
                    close: parseTime12to24(existing.close),
                    closed: false,
                };
            }
            return { day, open: "", close: "", closed: true };
        });
    });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    function updateDay(index: number, field: keyof HoursEntry, value: string | boolean) {
        setHours((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
    }

    function applyToAll(sourceIndex: number) {
        const source = hours[sourceIndex];
        setHours((prev) =>
            prev.map((h) => ({
                ...h,
                open: source.open,
                close: source.close,
                closed: source.closed,
            }))
        );
    }

    async function handleSave() {
        setSaving(true);
        setMsg("");

        // Build the hours array for storage (12h format)
        const hoursData = hours
            .filter((h) => !h.closed && h.open && h.close)
            .map((h) => ({
                day: h.day,
                open: parseTime24to12(h.open),
                close: parseTime24to12(h.close),
            }));

        const result = await updateVenuePage(venueId, { hours: hoursData });
        if (result.error) {
            setMsg(result.error);
        } else {
            setMsg("Saved!");
            const display = computeDisplayString(hours);
            onHoursChange?.(display);
            setTimeout(() => setMsg(""), 2000);
        }
        setSaving(false);
    }

    return (
        <>
            <motion.div
                key="hours-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/30"
            />
            <motion.div
                key="hours-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="font-sans text-[16px] font-bold text-gray-900">Operating Hours</p>
                        <p className="font-sans text-[12px] text-gray-400">Set when your hub is open</p>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-3">
                    {hours.map((entry, i) => (
                        <div key={entry.day} className="rounded-xl border border-black/[0.06] bg-white px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-sans text-[13px] font-semibold text-gray-700 w-24">{entry.day}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => applyToAll(i)}
                                        className="font-sans text-[10px] text-orange-500 font-medium hover:underline"
                                    >
                                        Apply to all
                                    </button>
                                    <button
                                        onClick={() => updateDay(i, "closed", !entry.closed)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${entry.closed ? "bg-gray-200" : "bg-green-500"}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${entry.closed ? "translate-x-0.5" : "translate-x-[18px]"}`} />
                                    </button>
                                    <span className="font-sans text-[11px] text-gray-400 w-10">{entry.closed ? "Closed" : "Open"}</span>
                                </div>
                            </div>
                            {!entry.closed && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={entry.open}
                                        onChange={(e) => updateDay(i, "open", e.target.value)}
                                        className="flex-1 rounded-lg border border-black/[0.08] bg-gray-50 px-3 py-2 font-sans text-[13px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-300"
                                    />
                                    <span className="font-sans text-[12px] text-gray-400">to</span>
                                    <input
                                        type="time"
                                        value={entry.close}
                                        onChange={(e) => updateDay(i, "close", e.target.value)}
                                        className="flex-1 rounded-lg border border-black/[0.08] bg-gray-50 px-3 py-2 font-sans text-[13px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-300"
                                    />
                                </div>
                            )}
                        </div>
                    ))}

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
                        {saving ? "Saving..." : "Save Hours"}
                    </button>
                </div>
            </motion.div>
        </>
    );
}
