"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlacePreviewEditable } from "@/components/place-preview-editable";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import type { PlaceData } from "@/components/place-preview";

// ─── Types ──────────────────────────────────────────────────────────

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
  user: { id: string; email: string };
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
  user,
}: HubTabProps) {
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

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main column — the editable preview IS the page */}
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

        {/* Editable venue preview — tap any section to edit inline */}
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

          {/* Quick links — minimal row under the preview */}
          <div className="mx-4 mt-2 mb-1">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <Link
                href="/settings#offerings"
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] transition"
              >
                Offerings ({offeringsState.length})
              </Link>
              <Link
                href="/settings#knowledge"
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] transition"
              >
                AI Knowledge
              </Link>
              <Link
                href="/settings#staff"
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] transition"
              >
                Staff
              </Link>
              <Link
                href="/settings#xp"
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] transition"
              >
                XP & Loyalty
              </Link>
              <Link
                href="/settings#gallery"
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] transition"
              >
                Gallery
              </Link>
            </div>
          </div>

          {/* Account + seed — compact footer */}
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
      <div
        className="hidden lg:flex w-[420px] shrink-0 items-center justify-center bg-gray-50 border-l border-black/[0.08]"
      >
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
    </div>
  );
}
