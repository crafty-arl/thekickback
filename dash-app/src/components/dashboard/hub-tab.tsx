"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { PlacePreviewEditable } from "@/components/place-preview-editable";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { SettingsOfferingsDrawer } from "@/components/dashboard/settings-offerings-drawer";
import { SettingsKnowledgeDrawer } from "@/components/dashboard/settings-knowledge-drawer";
import { SettingsStaffDrawer } from "@/components/dashboard/settings-staff-drawer";
import { SettingsXpDrawer } from "@/components/dashboard/settings-xp-drawer";
import type { PlaceData } from "@/components/place-preview";

// ─── Types ──────────────────────────────────────────────────────────

type SettingsDrawer = "offerings" | "knowledge" | "staff" | "xp" | null;

interface HubTabProps {
  hubData: PlaceData;
  venueId: string;
  offeringsState: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }[];
  galleryImages: { id: string; image_url: string }[];
  initialXpActions?: { label: string; points: number }[];
  initialXpMilestones?: { name: string; threshold: number }[];
  checklistPercent: number;
  onFieldSave: (field: string, value: unknown) => Promise<void>;
  onPhotoUpload: (file: File) => Promise<void>;
  onSectionEdited: (key: string) => void;
  onOfferingTap: (offering: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }) => void;
  onOfferingsChange?: (offerings: HubTabProps["offeringsState"]) => void;
  user: { id: string; email: string };
  // Optional data for drawers — passed from parent if available
  initialStaff?: { id: string; display_name: string | null; role_title: string | null; avatar_url: string | null; bio: string | null; specialties: string[] | null; visible: boolean; schedule: unknown }[];
  initialKnowledge?: { id: string; content: string; category: string; created_at: string }[];
  initialAiLimits?: { enabled: boolean; free_messages_per_day: number; require_membership: boolean; gate_message: string } | null;
}

// ─── Component ─────────────────────────────────────────────────────

export function HubTab({
  hubData,
  venueId,
  offeringsState,
  galleryImages,
  initialXpActions,
  initialXpMilestones,
  checklistPercent,
  onFieldSave,
  onPhotoUpload,
  onSectionEdited,
  onOfferingTap,
  onOfferingsChange,
  user,
  initialStaff,
  initialKnowledge,
  initialAiLimits,
}: HubTabProps) {
  const [activeDrawer, setActiveDrawer] = useState<SettingsDrawer>(null);
  const [seeding, setSeeding] = useState(false);
  const [showSeed, setShowSeed] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setShowSeed(host.includes("localhost") || host.includes("sandbox"));
  }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed-demo", { method: "POST" });
      window.location.reload();
    } catch {
      setSeeding(false);
    }
  };

  const pillClass = "shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] active:scale-95 transition cursor-pointer";

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Setup progress */}
        {checklistPercent < 100 && (
          <div className="shrink-0 mx-4 mt-3 rounded-xl bg-orange-500/[0.06] border border-orange-500/[0.12] px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-[11px] font-semibold text-gray-500">Setup Progress</span>
              <span className="font-sans text-[11px] font-bold text-orange-500">{checklistPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
                style={{ width: `${checklistPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Editable venue preview */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <PlacePreviewEditable
            data={hubData}
            venueId={venueId}
            offerings={offeringsState}
            galleryImages={galleryImages}
            xpActions={initialXpActions}
            xpMilestones={initialXpMilestones}
            onFieldSave={onFieldSave}
            onPhotoUpload={onPhotoUpload}
            onSectionEdited={onSectionEdited}
            onOfferingTap={onOfferingTap}
          />

          {/* Quick-open pills — open drawers instead of navigating */}
          <div className="mx-4 mt-2 mb-1">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <button onClick={() => setActiveDrawer("offerings")} className={pillClass}>
                Offerings ({offeringsState.length})
              </button>
              <button onClick={() => setActiveDrawer("knowledge")} className={pillClass}>
                AI Knowledge
              </button>
              <button onClick={() => setActiveDrawer("staff")} className={pillClass}>
                Staff
              </button>
              <button onClick={() => setActiveDrawer("xp")} className={pillClass}>
                XP & Loyalty
              </button>
            </div>
          </div>

          {/* Account footer */}
          <div className="mx-4 mt-2 mb-4 flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-4 py-3">
            <div>
              <p className="font-sans text-[13px] text-gray-600">{user.email}</p>
              <p className="font-sans text-[11px] text-gray-400">Owner</p>
            </div>
            <div className="flex items-center gap-2">
              {showSeed && (
                <button
                  onClick={handleSeedDemo}
                  disabled={seeding}
                  className="rounded-lg bg-yellow-400 px-3 py-1.5 font-sans text-[11px] font-bold text-black transition active:scale-95 disabled:opacity-50"
                >
                  {seeding ? "..." : "Seed"}
                </button>
              )}
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: live iframe preview */}
      <div className="hidden lg:flex w-[420px] shrink-0 items-center justify-center bg-gray-50 border-l border-black/[0.08]">
        {hubData.slug ? (
          <div className="flex flex-col items-center gap-3">
            <div className="overflow-hidden rounded-[32px] border-2 border-black/[0.08]" style={{ width: 375, height: 680 }}>
              <iframe
                src={`https://join.thekickback.net/${hubData.slug}`}
                className="h-full w-full border-none bg-white"
                title="Hub Preview"
              />
            </div>
            <span className="font-mono text-[10px] text-gray-300">
              join.thekickback.net/{hubData.slug}
            </span>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-sans text-sm text-gray-400">Preview will appear here</p>
            <p className="mt-1 font-sans text-xs text-gray-300">Complete setup to see your live page</p>
          </div>
        )}
      </div>

      {/* ─── Settings Drawers ───────────────────────────────────── */}
      <AnimatePresence>
        {activeDrawer === "offerings" && (
          <SettingsOfferingsDrawer
            venueId={venueId}
            initialOfferings={offeringsState}
            onClose={() => setActiveDrawer(null)}
            onOfferingsChange={(updated) => onOfferingsChange?.(updated.map(o => ({ id: o.id, name: o.name, type: o.type, price_cents: o.price_cents, description: o.description || undefined })))}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDrawer === "knowledge" && (
          <SettingsKnowledgeDrawer
            venueId={venueId}
            onClose={() => setActiveDrawer(null)}
            initialKnowledge={initialKnowledge}
            initialAiLimits={initialAiLimits}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDrawer === "staff" && (
          <SettingsStaffDrawer
            venueId={venueId}
            initialStaff={initialStaff || []}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDrawer === "xp" && (
          <SettingsXpDrawer
            venueId={venueId}
            initialXpActions={initialXpActions || []}
            initialXpMilestones={initialXpMilestones || []}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
