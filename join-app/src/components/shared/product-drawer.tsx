"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

/* ── Types ── */

export interface OfferingMeta {
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  type: string;
  recurring?: boolean;
  interval?: string | null;
  duration_minutes?: number | null;
  add_ons?: { name: string; price_cents: number }[] | null;
}

export interface ProductDrawerProps {
  offer: { id: string; name: string; price: number } | null;
  meta: OfferingMeta | null;
  theme: string;
  onClose: () => void;
  onAdd: () => void;
  onAddWithMeta: (metadata: { date: string; time: string; staffId?: string; staffName?: string }) => void;
  linkedStaff?: { id: string; name: string; avatar_url: string | null }[];
  venueId: string;
  user?: { id: string; email: string } | null;
}

/* ── Type icons ── */

export const TYPE_EMOJI: Record<string, string> = {
  membership: "👑", reservation: "🪑", service: "✂️", product: "☕",
  event: "🎟️", package: "📦", custom: "✦",
};

/* ── Date helpers for booking picker ── */

export function getBookingDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayNames[d.getDay()]} ${d.getDate()}`;
    dates.push({ label, value });
  }
  return dates;
}

/* ── Product Detail Drawer — slides in from left ── */

export function ProductDrawer({ offer, meta, theme, onClose, onAdd, onAddWithMeta, linkedStaff, venueId, user }: ProductDrawerProps) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null); // null = "Anyone"
  const [selectedDate, setSelectedDate] = useState<string>(getBookingDates()[0]?.value || "");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ staff: { id: string; name: string; avatar_url: string | null; slots: string[] }[]; anyone_slots: string[] } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Bookable = has duration, regardless of whether staff are linked
  const isBookable = meta && ["service", "reservation", "event"].includes(meta.type) && meta.duration_minutes;
  const hasStaff = linkedStaff && linkedStaff.length > 0;
  const dates = getBookingDates();

  // Fetch availability when offering/date/staff changes
  useEffect(() => {
    if (!isBookable || !offer) return;
    setSlotsLoading(true);
    setSelectedTime(null);
    setSlots(null);
    const params = new URLSearchParams({ offeringId: offer.id, date: selectedDate });
    if (selectedStaff) params.set("staffId", selectedStaff);
    fetch(`/api/availability?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSlots(data); })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [offer?.id, selectedDate, selectedStaff, isBookable]);

  if (!offer) return null;
  const price = offer.price / 100;
  const emoji = TYPE_EMOJI[meta?.type || "custom"] || "✦";

  // Get displayable time slots
  const displaySlots: string[] = (() => {
    if (!slots) return [];
    if (selectedStaff && hasStaff) {
      const staffSlots = slots.staff.find((s) => s.id === selectedStaff);
      return staffSlots?.slots || [];
    }
    return slots.anyone_slots || [];
  })();

  // Get the selected date label for cart metadata
  const selectedDateLabel = dates.find((d) => d.value === selectedDate)?.label || selectedDate;
  const selectedStaffName = hasStaff && selectedStaff
    ? linkedStaff!.find((s) => s.id === selectedStaff)?.name || null
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80]"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-y-0 right-0 z-[85] w-[85vw] max-w-sm flex flex-col overflow-y-auto"
        style={{
          background: "linear-gradient(to bottom, rgba(12,12,15,0.95) 0%, rgba(12,12,15,0.85) 100%)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Image or gradient hero */}
        <div className="relative shrink-0" style={{ height: meta?.image_url ? 220 : 140 }}>
          {meta?.image_url ? (
            <img src={meta.image_url} alt={offer.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme}30 0%, ${theme}08 100%)` }}>
              <span className="text-[48px]">{emoji}</span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(12,12,15,0.97) 100%)" }} />
          <button onClick={onClose} className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          {/* Type badge */}
          <div className="absolute bottom-4 left-4">
            <span className="px-2.5 py-1 font-sans text-[10px] font-bold tracking-wider" style={{ backgroundColor: `${theme}20`, color: theme, border: `1px solid ${theme}30` }}>
              {(meta?.type || "item").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-5 pt-5 pb-7">
          <h2 className="font-sans text-[22px] font-bold text-white">{offer.name}</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-bold" style={{ color: theme }}>
              ${price % 1 === 0 ? price : price.toFixed(2)}
            </span>
            {meta?.recurring && (
              <span className="font-sans text-[14px] text-white/30">/{meta.interval || "month"}</span>
            )}
          </div>

          {meta?.duration_minutes && (
            <div className="mt-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <span className="font-sans text-[13px] text-white/40">{meta.duration_minutes} minutes</span>
            </div>
          )}

          {meta?.description && (
            <p className="mt-4 font-sans text-[14px] leading-[1.7] text-white/50">{meta.description}</p>
          )}

          {/* ── Booking UI: always shown for bookable offerings ── */}
          {isBookable && (
            <>
              {/* Section header */}
              <div className="mt-5 flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="font-sans text-[13px] font-semibold" style={{ color: theme }}>Pick a date & time</span>
              </div>

              {/* Staff picker — only when staff linked */}
              {hasStaff && <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">CHOOSE STAFF</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {/* Anyone option */}
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    style={{ width: 56 }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        border: `2px solid ${selectedStaff === null ? theme : "rgba(255,255,255,0.1)"}`,
                        backgroundColor: selectedStaff === null ? `${theme}20` : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={selectedStaff === null ? theme : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span className="font-sans text-[10px] font-medium" style={{ color: selectedStaff === null ? theme : "rgba(255,255,255,0.5)" }}>Anyone</span>
                  </button>
                  {linkedStaff!.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaff(s.id)}
                      className="flex shrink-0 flex-col items-center gap-1.5"
                      style={{ width: 56 }}
                    >
                      <div
                        className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                        style={{
                          border: `2px solid ${selectedStaff === s.id ? theme : "rgba(255,255,255,0.1)"}`,
                          backgroundColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[14px] font-bold" style={{ color: selectedStaff === s.id ? theme : "rgba(255,255,255,0.4)" }}>
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="truncate w-full text-center font-sans text-[10px] font-medium" style={{ color: selectedStaff === s.id ? theme : "rgba(255,255,255,0.5)" }}>
                        {s.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>}

              {/* Date picker */}
              <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">DATE</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                  {dates.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDate(d.value)}
                      className="shrink-0 px-3 py-2 font-sans text-[12px] font-medium active:scale-95"
                      style={{
                        backgroundColor: selectedDate === d.value ? `${theme}20` : "rgba(255,255,255,0.04)",
                        color: selectedDate === d.value ? theme : "rgba(255,255,255,0.5)",
                        border: `1px solid ${selectedDate === d.value ? `${theme}40` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slot picker */}
              <div className="mt-4">
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">TIME</p>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: theme }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="font-sans text-[12px] text-white/30">Loading availability...</span>
                  </div>
                ) : displaySlots.length === 0 ? (
                  <div className="py-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="font-sans text-[12px] text-white/30">No slots available for this date</p>
                    <p className="mt-1 font-sans text-[10px] text-white/15">Try another day or staff member</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {displaySlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className="px-2.5 py-1.5 font-sans text-[11px] font-medium active:scale-95"
                        style={{
                          backgroundColor: selectedTime === slot ? `${theme}25` : "rgba(255,255,255,0.04)",
                          color: selectedTime === slot ? theme : "rgba(255,255,255,0.5)",
                          border: `1px solid ${selectedTime === slot ? `${theme}40` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Add-ons */}
          {meta?.add_ons && meta.add_ons.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">ADD-ONS</p>
              <div className="flex flex-col gap-1.5">
                {meta.add_ons.map((addon) => (
                  <div key={addon.name} className="flex items-center justify-between px-3.5 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="font-sans text-[13px] text-white/60">{addon.name}</span>
                    <span className="font-mono text-[13px] font-semibold" style={{ color: theme }}>+${(addon.price_cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action button */}
          {isBookable ? (
            !user ? (
              <a
                href="/login"
                className="mt-6 flex w-full items-center justify-center py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
                style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
              >
                Log in to book
              </a>
            ) : selectedTime ? (
              <button
                onClick={() => {
                  onAddWithMeta({
                    date: selectedDateLabel,
                    time: selectedTime!,
                    staffId: selectedStaff || undefined,
                    staffName: selectedStaffName || undefined,
                  });
                }}
                className="mt-6 w-full py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
                style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
              >
                Add to cart — {selectedDateLabel} {selectedTime}
              </button>
            ) : (
              <div
                className="mt-6 w-full py-3.5 text-center font-sans text-[14px] font-bold"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}
              >
                Pick a date & time above
              </div>
            )
          ) : (
            <button
              onClick={onAdd}
              className="mt-6 w-full py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
              style={{ backgroundColor: theme, boxShadow: `0 4px 20px ${theme}40` }}
            >
              Add to cart — ${price % 1 === 0 ? price : price.toFixed(2)}
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
