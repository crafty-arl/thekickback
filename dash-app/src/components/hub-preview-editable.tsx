"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HubData } from "@/components/hub-preview";

interface Offering {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  description?: string;
}

interface EditableHubPreviewProps {
  data: HubData;
  venueId: string;
  offerings: Offering[];
  galleryImages: { id: string; image_url: string }[];
  onFieldSave: (field: string, value: unknown) => Promise<void>;
  onPhotoUpload: (file: File) => Promise<void>;
  onSectionEdited: (key: string) => void;
}

type EditingSection = "name" | "tagline" | "color" | "hours" | "description" | "photos" | "offerings" | null;

const COLOR_SWATCHES = [
  "#F97316", "#EF4444", "#4ADE80", "#8B5CF6", "#F59E0B", "#EC4899", "#3B82F6", "#06B6D4",
];

export function HubPreviewEditable({
  data,
  venueId,
  offerings,
  galleryImages,
  onFieldSave,
  onPhotoUpload,
  onSectionEdited,
}: EditableHubPreviewProps) {
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
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
      style={{ backgroundColor: "rgba(249,115,22,0.9)" }}
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
      style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}
    >
      {children}
      <div className="mt-2 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-bold text-black disabled:opacity-50"
          style={{ backgroundColor: "#F97316" }}
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

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="relative w-[375px] overflow-hidden rounded-[40px] border-[3px]"
        style={{ height: 720, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#0A0A0A" }}
      >
        {/* Phone notch */}
        <div className="absolute left-1/2 top-0 z-10 h-7 w-32 -translate-x-1/2 rounded-b-2xl" style={{ backgroundColor: "#0A0A0A" }} />

        <div className="h-full overflow-y-auto pt-10 no-scrollbar">
          {/* Hero — name, tagline, type, address */}
          <div className="group relative">
            <div
              className="relative flex h-48 items-end p-5"
              style={{ background: `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}08 50%, rgba(0,0,0,0.8) 100%)` }}
            >
              {/* Gallery thumbnails */}
              {galleryImages.length > 0 && (
                <div className="absolute right-3 top-10 flex gap-1">
                  {galleryImages.slice(0, 3).map((img) => (
                    <div key={img.id} className="h-8 w-8 overflow-hidden rounded-md" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h2 className="font-sans text-[22px] font-bold text-white">{data.name || "Your Hub"}</h2>
                {data.tagline && (
                  <p className="mt-1 font-sans text-[13px] italic text-white/40">&ldquo;{data.tagline}&rdquo;</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {data.type && (
                    <span className="rounded-md px-2 py-0.5 font-sans text-[10px] font-medium capitalize text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {data.type}
                    </span>
                  )}
                  {data.address && <span className="font-sans text-[10px] text-white/25">{data.address}</span>}
                </div>
              </div>
            </div>
            <EditIcon onClick={() => startEdit("name", data.name)} />
          </div>

          {/* Inline edit: Name/Tagline */}
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
                    placeholder="Hub name"
                    className="w-full rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* Tagline edit */}
          <div className="group relative px-5 py-2">
            <button
              onClick={() => startEdit("tagline", data.tagline)}
              className="w-full text-left rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]"
            >
              <p className="font-sans text-[10px] font-semibold text-white/20">TAGLINE</p>
              <p className="font-sans text-[12px] text-white/50">{data.tagline || "Tap to add a tagline..."}</p>
            </button>
          </div>

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

          {/* Theme color */}
          <div className="group relative px-5 py-2">
            <button
              onClick={() => startEdit("color", themeColor)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
            >
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: themeColor }} />
              <p className="font-sans text-[10px] font-semibold text-white/20">THEME COLOR</p>
            </button>
          </div>

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

          {/* Hours */}
          <div className="group relative">
            <div
              className="mx-5 rounded-xl p-3 cursor-pointer transition hover:border-orange/20"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onClick={() => startEdit("hours", data.hours)}
            >
              <p className="font-sans text-[10px] font-semibold tracking-wide text-white/25">HOURS</p>
              <p className="mt-1 font-sans text-[12px] text-white/50">{data.hours || "Tap to set hours..."}</p>
            </div>
            <EditIcon onClick={() => startEdit("hours", data.hours)} />
          </div>

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

          {/* Description */}
          <div className="group relative px-5 py-3">
            <div
              className="cursor-pointer rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]"
              onClick={() => startEdit("description", data.description)}
            >
              <p className="font-sans text-[13px] leading-relaxed text-white/50">
                {data.description || "Tap to add a description..."}
              </p>
            </div>
            <EditIcon onClick={() => startEdit("description", data.description)} />
          </div>

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
                    placeholder="Describe your hub..."
                    rows={3}
                    className="w-full resize-none rounded-lg px-3 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    autoFocus
                  />
                </InlineForm>
              </div>
            )}
          </AnimatePresence>

          {/* Photos */}
          <div className="group relative px-5 py-3">
            <p className="mb-2 font-sans text-[10px] font-semibold tracking-[2px] text-white/20">PHOTOS</p>
            {galleryImages.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {galleryImages.map((img) => (
                  <div key={img.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl p-4 text-center transition hover:border-orange/20"
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

          {/* Offerings */}
          <div className="group relative px-5 py-3">
            <p className="mb-2 font-sans text-[10px] font-semibold tracking-[2px] text-white/20">WHAT WE OFFER</p>
            {offerings.length > 0 ? (
              offerings.slice(0, 4).map((o) => (
                <div
                  key={o.id}
                  className="mb-2 rounded-xl p-3"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] font-medium text-white/70">{o.name}</span>
                    <span className="font-sans text-[11px] text-white/30">${(o.price_cents / 100).toFixed(2)}</span>
                  </div>
                  {o.description && (
                    <p className="mt-1 font-sans text-[10px] text-white/25">{o.description}</p>
                  )}
                </div>
              ))
            ) : (
              [1, 2, 3].map((i) => (
                <div key={i} className="mb-2 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="h-3 w-24 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                  <div className="mt-2 h-2 w-16 rounded" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                </div>
              ))
            )}
            {offerings.length > 4 && (
              <p className="mt-1 text-center font-sans text-[10px] text-white/20">+{offerings.length - 4} more</p>
            )}
          </div>

          {/* Chat preview dock */}
          <div className="mx-5 mb-5 rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${themeColor}20` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="flex-1 font-sans text-[12px] text-white/50">Ask about {data.name || "this hub"}...</p>
            </div>
          </div>
        </div>

        {/* URL bar */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center py-2"
          style={{ backgroundColor: "rgba(10,10,10,0.95)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="font-mono text-[10px] text-white/20">join.thekickback.net/{data.slug || "your-hub"}</span>
        </div>
      </div>
    </div>
  );
}
