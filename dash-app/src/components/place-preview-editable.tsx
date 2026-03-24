"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlaceData } from "@/components/place-preview";

interface Offering {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  description?: string;
  recurring?: boolean;
  interval?: string | null;
  perks?: string[];
  starts_at?: string;
  ends_at?: string;
}

interface XpAction {
  label: string;
  points: number;
}

interface XpMilestone {
  name: string;
  threshold: number;
}

interface EditablePlacePreviewProps {
  data: PlaceData;
  venueId: string;
  offerings: Offering[];
  galleryImages: { id: string; image_url: string }[];
  xpActions?: XpAction[];
  xpMilestones?: XpMilestone[];
  onFieldSave: (field: string, value: unknown) => Promise<void>;
  onPhotoUpload: (file: File) => Promise<void>;
  onSectionEdited: (key: string) => void;
  onOfferingTap?: (offering: Offering) => void;
}

type EditingSection = "name" | "tagline" | "color" | "hours" | "description" | "photos" | "offerings" | null;

const COLOR_SWATCHES = [
  "#F97316", "#EF4444", "#4ADE80", "#8B5CF6", "#F59E0B", "#EC4899", "#3B82F6", "#06B6D4",
];

const TYPE_ICONS: Record<string, string> = {
  membership: "👑",
  booth_hold: "🪑",
  space_rental: "🏠",
  event_ticket: "🎟️",
  event: "🎟️",
  service: "✂️",
  reservation: "📅",
  custom: "✦",
};

function formatPrice(cents: number, recurring?: boolean, interval?: string | null): string {
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  if (recurring) return `$${dollars}/${interval === "year" ? "yr" : "mo"}`;
  return `$${dollars}`;
}

export function PlacePreviewEditable({
  data,
  venueId,
  offerings,
  galleryImages,
  xpActions,
  xpMilestones,
  onFieldSave,
  onPhotoUpload,
  onSectionEdited,
  onOfferingTap,
}: EditablePlacePreviewProps) {
  const [editing, setEditing] = useState<EditingSection>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeColor = data.themeColor || "#F97316";

  const startEdit = (section: EditingSection, currentValue?: string) => {
    setEditing(section);
    setEditValue(currentValue || "");
  };

  const saveField = async (field: string, value: unknown, checklistKey: string) => {
    setSaving(true);
    try {
      await onFieldSave(field, value);
      onSectionEdited(checklistKey);
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      await onPhotoUpload(file);
      onSectionEdited("photos");
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  // Edit icon overlay
  const EditIcon = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full opacity-60 transition hover:opacity-100"
      style={{ backgroundColor: `${themeColor}e6` }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );

  // Inline edit form
  const InlineForm = ({ onSave, onCancel, children }: { onSave: () => void; onCancel: () => void; children: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="rounded-xl p-3"
      style={{ backgroundColor: `${themeColor}0f`, border: `1px solid ${themeColor}26` }}
    >
      {children}
      <div className="mt-2 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium text-white/40"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );

  const membership = offerings.find((o) => o.type === "membership");
  const otherOfferings = offerings.filter((o) => o.type !== "membership" && o.type !== "event");
  const events = offerings.filter((o) => o.type === "event");

  return (
    <div className="flex h-full">
      <div
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: "#000" }}
      >
        <div className="h-full overflow-y-auto no-scrollbar">

          {/* ═══ HERO — matches slug page: 280px, radial gradient, name at bottom ═══ */}
          <div className="group relative" style={{ height: 280 }}>
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(ellipse at 50% 30%, ${themeColor}40 0%, transparent 60%), linear-gradient(to bottom, ${themeColor}15 0%, #000 100%)` }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)" }}
            />

            {/* Gallery thumbnails in top-right (if available) */}
            {galleryImages.length > 0 && (
              <div className="absolute right-3 top-10 z-[2] flex gap-1">
                {galleryImages.slice(0, 3).map((img) => (
                  <div key={img.id} className="h-8 w-8 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Venue identity — positioned at bottom like slug page */}
            <div className="absolute inset-x-0 bottom-0 z-[2] px-5 pb-6">
              <h1 className="font-sans text-[28px] font-bold leading-tight tracking-tight text-white">
                {data.name || "Your Place"}
              </h1>
              {data.tagline && (
                <p className="mt-1.5 font-sans text-[14px] leading-relaxed text-white/50">{data.tagline}</p>
              )}
              {(data.type || data.address) && (
                <p className="mt-1.5 font-sans text-[12px] text-white/30">
                  {data.type && <span className="capitalize">{data.type}</span>}
                  {data.type && data.address && " · "}
                  {data.address}
                </p>
              )}
            </div>

            <EditIcon onClick={() => startEdit("name", data.name)} />
          </div>

          {/* Inline edit: Name */}
          <AnimatePresence>
            {editing === "name" && (
              <div className="px-5 py-2">
                <InlineForm
                  onSave={() => saveField("name_tagline", { name: editValue, tagline: data.tagline }, "branding")}
                  onCancel={() => setEditing(null)}
                >
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Place name"
                    className="w-full rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* Spacer */}
          <div className="h-2" />

          {/* ═══ QUICK INFO ROW — horizontal scroll, matches slug page ═══ */}
          <div className="flex gap-2.5 overflow-x-auto px-5 py-4 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Hours card — tap to edit */}
            <div
              className="group relative shrink-0 cursor-pointer px-5 py-3.5 transition-colors duration-150 hover:border-white/10"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)", minWidth: 140 }}
              onClick={() => startEdit("hours", data.hours)}
            >
              <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25 mb-2">HOURS</p>
              <p className="font-sans text-[11px] text-white/50">{data.hours || "Tap to set hours..."}</p>
              <EditIcon onClick={() => startEdit("hours", data.hours)} />
            </div>

            {/* Location card */}
            {data.address && (
              <div
                className="shrink-0 flex items-center gap-3.5 px-5 py-3.5"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)", minWidth: 140 }}
              >
                <div className="flex h-9 w-9 items-center justify-center" style={{ backgroundColor: `${themeColor}20` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <div>
                  <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">LOCATION</p>
                  <p className="font-sans text-[12px] text-white/50 mt-0.5">{data.address}</p>
                </div>
              </div>
            )}

            {/* Theme color card — tap to edit */}
            <div
              className="group relative shrink-0 flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors duration-150 hover:border-white/10"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)", minWidth: 100 }}
              onClick={() => startEdit("color", themeColor)}
            >
              <div className="h-6 w-6 rounded-full" style={{ backgroundColor: themeColor, boxShadow: `0 0 12px ${themeColor}40` }} />
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">THEME</p>
                <p className="font-sans text-[11px] text-white/40 mt-0.5">{themeColor}</p>
              </div>
            </div>
          </div>

          {/* Inline edit: Hours */}
          <AnimatePresence>
            {editing === "hours" && (
              <div className="px-5 py-2">
                <InlineForm
                  onSave={() => saveField("hours", editValue, "hours")}
                  onCancel={() => setEditing(null)}
                >
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="e.g. Mon-Fri 9am-5pm, Sat 10am-3pm"
                    className="w-full rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* Inline edit: Color */}
          <AnimatePresence>
            {editing === "color" && (
              <div className="px-5 py-2">
                <InlineForm
                  onSave={() => saveField("theme_color", editValue, "branding")}
                  onCancel={() => setEditing(null)}
                >
                  <div className="flex flex-wrap gap-2">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditValue(c)}
                        className="h-8 w-8 rounded-full transition"
                        style={{
                          backgroundColor: c,
                          border: editValue === c ? "2px solid white" : "2px solid transparent",
                          transform: editValue === c ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* ═══ DESCRIPTION — matches slug page: 14px, leading-[1.7] ═══ */}
          <div className="group relative px-5 pb-5">
            <div
              className="cursor-pointer rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]"
              onClick={() => startEdit("description", data.description)}
            >
              <p className="font-sans text-[14px] leading-[1.7] text-white/50">
                {data.description || "Tap to add a description..."}
              </p>
            </div>
            <EditIcon onClick={() => startEdit("description", data.description)} />
          </div>

          {/* Inline edit: Description */}
          <AnimatePresence>
            {editing === "description" && (
              <div className="px-5 py-2">
                <InlineForm
                  onSave={() => saveField("description", editValue, "branding")}
                  onCancel={() => setEditing(null)}
                >
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Describe your place..."
                    rows={3}
                    className="w-full resize-none rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* Inline edit: Tagline */}
          <AnimatePresence>
            {editing === "tagline" && (
              <div className="px-5 py-2">
                <InlineForm
                  onSave={() => saveField("tagline", editValue, "branding")}
                  onCancel={() => setEditing(null)}
                >
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Your tagline"
                    className="w-full rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* ═══ GALLERY — horizontal strip matching slug page ═══ */}
          <div className="group relative px-5 pb-6">
            <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">GALLERY</p>
            {galleryImages.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                {galleryImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative shrink-0 overflow-hidden"
                    style={{ width: 148, height: 105, border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)" }} />
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: 148, height: 105, backgroundColor: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" className="mb-1">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 text-center transition hover:border-white/10"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-1">
                  <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
                <p className="font-sans text-[11px] text-white/25">Tap to upload photos</p>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* ═══ EVENTS — matches slug page event cards ═══ */}
          {events.length > 0 && (
            <div className="px-5 pb-6">
              <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">UPCOMING EVENTS</p>
              <div className="flex flex-col gap-3.5">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onOfferingTap?.(event)}
                    className="w-full overflow-hidden text-left transition-colors duration-150 active:scale-[0.98]"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: `1px solid ${themeColor}10` }}
                  >
                    <div className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-[14px]">🎟️</span>
                        <h3 className="font-sans text-[15px] font-bold text-white/90">{event.name}</h3>
                      </div>
                      {event.starts_at && (
                        <p className="font-sans text-[11px] text-white/50 mt-0.5">
                          {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}
                          {new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {event.ends_at && ` – ${new Date(event.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                        </p>
                      )}
                      {event.description && (
                        <p className="font-sans text-[12px] leading-relaxed text-white/40 line-clamp-2">{event.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {event.price_cents > 0 && (
                          <span className="font-mono text-[12px] font-bold" style={{ color: themeColor }}>{formatPrice(event.price_cents, false, null)}</span>
                        )}
                        {event.price_cents === 0 && (
                          <span className="font-sans text-[11px] font-semibold" style={{ color: "#4ade80" }}>Free</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ OFFERINGS — matches slug page: membership hero + 2-col grid ═══ */}
          {(offerings.length > 0 || true) && (
            <div className="group relative px-5 pb-6">
              {offerings.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {/* Membership card — hero treatment matching slug page */}
                  {membership && (
                    <div
                      className="relative overflow-hidden border px-5 py-5"
                      style={{
                        borderColor: `${themeColor}25`,
                        background: `linear-gradient(180deg, ${themeColor}12 0%, ${themeColor}04 100%)`,
                      }}
                    >
                      <div className="absolute -right-8 -top-8 h-24 w-24 blur-3xl" style={{ backgroundColor: `${themeColor}20` }} />
                      <div className="relative">
                        <div className="flex items-center gap-2">
                          <span className="text-[18px]">👑</span>
                          <h3 className="font-sans text-[15px] font-bold text-white">{membership.name}</h3>
                        </div>
                        {membership.description && (
                          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/40">{membership.description}</p>
                        )}
                        {membership.perks && membership.perks.length > 0 && (
                          <div className="mt-3.5 flex flex-col gap-2">
                            {membership.perks.map((perk) => (
                              <div key={perk} className="flex items-center gap-2">
                                <div className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: themeColor }} />
                                <span className="font-sans text-[12px] text-white/50">{perk}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => onOfferingTap?.(membership)}
                          className="mt-5 flex w-full items-center justify-center gap-2 py-3 font-sans text-[14px] font-bold text-black transition-colors duration-150 active:scale-[0.97]"
                          style={{ backgroundColor: themeColor }}
                        >
                          Join — {formatPrice(membership.price_cents, membership.recurring, membership.interval)}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Other offerings — 2-col grid matching slug page */}
                  {otherOfferings.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {otherOfferings.map((o) => (
                        <div
                          key={o.id}
                          className="flex flex-col justify-between border px-5 py-4"
                          style={{
                            borderColor: "rgba(255,255,255,0.04)",
                            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                          }}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px]">{TYPE_ICONS[o.type] || "✦"}</span>
                              <h4 className="font-sans text-[13px] font-semibold text-white/80">{o.name}</h4>
                            </div>
                            {o.description && (
                              <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-white/30">{o.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onOfferingTap?.(o)}
                            className="mt-3.5 flex w-full items-center justify-center py-2.5 font-sans text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
                            style={{
                              backgroundColor: `${themeColor}20`,
                              color: themeColor,
                              border: `1px solid ${themeColor}30`,
                            }}
                          >
                            {formatPrice(o.price_cents, o.recurring, o.interval)}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit offerings link */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSectionEdited("offerings")}
                      className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black"
                      style={{ backgroundColor: "#4ADE80" }}
                    >
                      Looks good
                    </button>
                    <a
                      href="/settings#offerings"
                      className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium text-white/40"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    >
                      Edit in settings
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">OFFERINGS</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="border px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)" }}>
                        <div className="h-3 w-16 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                        <div className="mt-2 h-2 w-10 rounded" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                        <div className="mt-4 h-7 w-full rounded" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ XP & LOYALTY ═══ */}
          {((xpActions && xpActions.length > 0) || (xpMilestones && xpMilestones.length > 0)) && (
            <div className="px-5 pb-6">
              <p className="mb-3.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">XP &amp; LOYALTY</p>
              {xpActions && xpActions.length > 0 && (
                <>
                  {xpActions.slice(0, 4).map((a, i) => (
                    <div
                      key={i}
                      className="mb-1.5 flex items-center justify-between px-3 py-2"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span className="font-sans text-[12px] text-white/70">{a.label}</span>
                      <span className="font-sans text-[11px] font-medium text-green-400/70">+{a.points} XP</span>
                    </div>
                  ))}
                  {xpActions.length > 4 && (
                    <p className="mt-1 text-center font-sans text-[10px] text-white/20">+{xpActions.length - 4} more actions</p>
                  )}
                </>
              )}
              {xpMilestones && xpMilestones.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 font-sans text-[10px] font-semibold text-white/15">MILESTONES</p>
                  {xpMilestones.map((m, i) => (
                    <div
                      key={i}
                      className="mb-1 flex items-center justify-between px-3 py-1.5"
                      style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                    >
                      <span className="font-sans text-[11px] text-white/50">{m.name}</span>
                      <span className="font-sans text-[10px] text-white/25">{m.threshold} XP</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onSectionEdited("xp")}
                  className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black"
                  style={{ backgroundColor: "#4ADE80" }}
                >
                  Looks good
                </button>
                <a
                  href="/settings#xp"
                  className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium text-white/40"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  Edit in settings
                </a>
              </div>
            </div>
          )}

          {/* Bottom spacer for dock */}
          <div className="h-24" />
        </div>

        {/* ═══ CHAT DOCK — fixed bottom, matches slug page dock styling ═══ */}
        <div
          className="absolute inset-x-0 bottom-0 z-10"
          style={{ paddingBottom: 0 }}
        >
          <div
            className="mx-3 mb-2 flex items-center gap-2.5 px-4"
            style={{
              height: 56,
              backgroundColor: "rgba(12, 12, 14, 0.88)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <motion.div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: themeColor }}
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="whitespace-nowrap font-sans text-[13px] font-semibold text-white/90">
                {data.name || "Your Place"}
              </span>
            </div>
            <p className="min-w-0 flex-1 font-sans text-[13px] text-white/25 truncate">Ask anything...</p>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              style={{ backgroundColor: themeColor, boxShadow: `0 2px 10px ${themeColor}40` }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          </div>

          {/* Slug URL */}
          <div className="flex items-center justify-center py-3 border-t border-white/[0.06]">
            <span className="font-mono text-xs text-white/20">join.thekickback.net/{data.slug || "your-place"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
