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

// ─── Manage row icons (simple SVGs) ────────────────────────────────

function OfferingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function XpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Manage row ────────────────────────────────────────────────────

function ManageRow({
  icon,
  label,
  desc,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-b border-black/5 py-3 px-4 flex items-center gap-3 hover:bg-black/[0.02] transition"
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-medium text-gray-700">{label}</p>
        <p className="font-sans text-[11px] text-gray-400">{desc}</p>
      </div>
      <ChevronRight />
    </Link>
  );
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
      {/* Main scrollable column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* 1. Setup progress bar */}
        {checklistPercent < 100 && (
          <div
            className="shrink-0 mx-4 mt-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-[11px] font-semibold text-gray-500">Setup Progress</span>
              <span className="font-sans text-[11px] font-bold" style={{ color: "#F97316" }}>
                {checklistPercent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${checklistPercent}%`, backgroundColor: "#F97316" }}
              />
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* 2. PlacePreviewEditable — phone mockup hub editor */}
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

          {/* 3. Manage section */}
          <div className="px-4 pt-2 pb-1">
            <p className="font-sans text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Manage
            </p>
          </div>

          <div className="mx-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <ManageRow
              icon={<OfferingsIcon />}
              label="Offerings"
              desc={`${offeringsState.length} offering${offeringsState.length !== 1 ? "s" : ""}`}
              href="/settings#offerings"
            />
            <ManageRow
              icon={<KnowledgeIcon />}
              label="AI Knowledge"
              desc="Teach your AI"
              href="/settings#knowledge"
            />
            <ManageRow
              icon={<StaffIcon />}
              label="Staff"
              desc="Team members"
              href="/settings#staff"
            />
            <ManageRow
              icon={<XpIcon />}
              label="XP & Loyalty"
              desc="Rewards program"
              href="/settings#xp"
            />
            <ManageRow
              icon={<GalleryIcon />}
              label="Gallery"
              desc="Photos & media"
              href="/settings#gallery"
            />
          </div>

          {/* 4. Account section */}
          <div className="px-4 pt-6 pb-1">
            <p className="font-sans text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Account
            </p>
          </div>

          <div
            className="mx-4 rounded-xl px-4 py-4"
            style={{ border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-[13px] text-gray-600">{user.email}</p>
                <p className="font-sans text-[11px] text-gray-400">Owner</p>
              </div>
              <SignOutButton />
            </div>
          </div>

          {/* 5. Seed demo button (sandbox / localhost only) */}
          {showSeed && (
            <div
              className="mx-4 mt-3 rounded-xl px-4 py-4"
              style={{ backgroundColor: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.1)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sans text-[13px] font-medium text-yellow-600">Seed Demo Data</p>
                  <p className="font-sans text-[11px] text-yellow-500/60">Populate sandbox with sample data</p>
                </div>
                <button
                  onClick={handleSeedDemo}
                  disabled={seeding}
                  className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold text-black transition active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: "#FACC15" }}
                >
                  {seeding ? "Seeding..." : "Seed"}
                </button>
              </div>
            </div>
          )}

          {/* Bottom spacing */}
          <div className="h-6" />
        </div>
      </div>

      {/* 6. Desktop preview — live iframe */}
      <div
        className="hidden lg:flex w-[420px] shrink-0 items-center justify-center bg-gray-50"
        style={{ borderLeft: "1px solid rgba(0,0,0,0.08)" }}
      >
        {hubData.slug ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="overflow-hidden rounded-[32px]"
              style={{ width: 375, height: 680, border: "2px solid rgba(0,0,0,0.08)" }}
            >
              <iframe
                src={`https://join.thekickback.net/${hubData.slug}`}
                className="h-full w-full"
                style={{ border: "none", background: "#fff" }}
                title="Hub Preview"
              />
            </div>
            <span className="font-mono text-[10px] text-gray-300">
              join.thekickback.net/{hubData.slug}
            </span>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-sans text-[14px] text-gray-400">Preview will appear here</p>
            <p className="mt-1 font-sans text-[12px] text-gray-300">Complete setup to see your live page</p>
          </div>
        )}
      </div>
    </div>
  );
}
