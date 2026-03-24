"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { PlacePreviewEditable } from "@/components/place-preview-editable";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { SettingsOfferingsDrawer } from "@/components/dashboard/settings-offerings-drawer";
import { SettingsKnowledgeDrawer } from "@/components/dashboard/settings-knowledge-drawer";
import { SettingsStaffDrawer } from "@/components/dashboard/settings-staff-drawer";
import { SettingsXpDrawer } from "@/components/dashboard/settings-xp-drawer";
import { SettingsMenuDrawer } from "@/components/dashboard/settings-menu-drawer";
import { SettingsHoursDrawer } from "@/components/dashboard/settings-hours-drawer";
import { SettingsVenueDrawer } from "@/components/dashboard/settings-venue-drawer";
import type { PlaceData } from "@/components/place-preview";
import type { ChecklistState } from "@/components/onboarding-checklist";

// ─── Types ──────────────────────────────────────────────────────────

type SettingsDrawer = "offerings" | "knowledge" | "staff" | "xp" | "menu" | "hours" | "venue" | null;

// Checklist items with labels and instructions
const CHECKLIST_ITEMS: { key: string; label: string; hint: string }[] = [
  { key: "basics", label: "Name & type", hint: "Tap the hero section above to set your venue name and type" },
  { key: "location", label: "Address", hint: "Add your address so guests can find you on the map" },
  { key: "hours", label: "Operating hours", hint: "Tap the hours card to set when you're open" },
  { key: "branding", label: "Tagline & theme", hint: "Add a tagline and pick a theme color that fits your vibe" },
  { key: "offerings", label: "Offerings", hint: "Add what you sell — menus, services, events, memberships" },
  { key: "knowledge", label: "AI knowledge", hint: "Teach your chatbot about your venue so it can answer questions" },
  { key: "photos", label: "Photos", hint: "Upload gallery images to show off your space" },
  { key: "xp", label: "XP & loyalty", hint: "Set up rewards to keep guests coming back" },
  { key: "stripe", label: "Payments", hint: "Connect Stripe to accept payments through the platform" },
];

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
  checklist?: ChecklistState;
  reviewStatus?: string;
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
  onPublish?: () => Promise<void>;
  onReset?: () => Promise<void>;
  user: { id: string; email: string };
  initialStaff?: { id: string; display_name: string | null; role_title: string | null; avatar_url: string | null; bio: string | null; specialties: string[] | null; visible: boolean; schedule: unknown }[];
  initialKnowledge?: { id: string; content: string; category: string; created_at: string }[];
  initialAiLimits?: { enabled: boolean; free_messages_per_day: number; require_membership: boolean; gate_message: string } | null;
  previewKey?: number;
  posProvider?: string | null;
  posConnectedAt?: string | null;
  initialMenuItems?: { id: string; category: string; name: string; description: string | null; price_cents: number; in_stock: boolean; inventory_count: number | null }[];
  initialHours?: { day: string; open: string; close: string }[] | null;
  initialVenueData?: { address?: string; type?: string; max_occupancy?: number; vibe?: string; rules?: string[]; check_in_radius_meters?: number };
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
  onPublish,
  onReset,
  user,
  initialStaff,
  initialKnowledge,
  initialAiLimits,
  previewKey,
  checklist,
  reviewStatus,
  posProvider: initialPosProvider,
  posConnectedAt: initialPosConnectedAt,
  initialMenuItems,
  initialHours,
  initialVenueData,
}: HubTabProps) {
  const [activeDrawer, setActiveDrawer] = useState<SettingsDrawer>(null);
  const [seeding, setSeeding] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [posProvider, setPosProvider] = useState(initialPosProvider || null);
  const [posConnectedAt, setPosConnectedAt] = useState(initialPosConnectedAt || null);
  const [posConnecting, setPosConnecting] = useState(false);
  const [posSyncing, setPosSyncing] = useState(false);
  const [posDisconnecting, setPosDisconnecting] = useState(false);
  const [posSyncResult, setPosSyncResult] = useState<string | null>(null);

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

  const handlePosConnect = async () => {
    setPosConnecting(true);
    try {
      const res = await fetch("/api/pos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      const data = await res.json();
      if (data.session_url) {
        window.location.href = data.session_url;
      }
    } catch {
      setPosConnecting(false);
    }
  };

  const handlePosSync = async () => {
    setPosSyncing(true);
    setPosSyncResult(null);
    try {
      const res = await fetch("/api/pos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      const data = await res.json();
      if (data.synced !== undefined) {
        setPosSyncResult(`Synced ${data.synced} items (${data.added} new, ${data.updated} updated)`);
        setTimeout(() => setPosSyncResult(null), 4000);
      }
    } finally {
      setPosSyncing(false);
    }
  };

  const handlePosDisconnect = async () => {
    setPosDisconnecting(true);
    try {
      await fetch("/api/pos/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      setPosProvider(null);
      setPosConnectedAt(null);
    } finally {
      setPosDisconnecting(false);
    }
  };

  // Detect ?pos=connected in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pos") === "connected") {
      handlePosSync();
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pillClass = "shrink-0 rounded-lg border border-black/[0.06] bg-white px-3 py-2 font-sans text-xs font-medium text-gray-500 hover:bg-black/[0.02] active:scale-95 transition cursor-pointer";

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Setup checklist + publish controls */}
        <div className="shrink-0 mx-4 mt-3 flex flex-col gap-2">
          {/* Progress bar + expand toggle */}
          {checklistPercent < 100 && (
            <button
              onClick={() => setShowChecklist(!showChecklist)}
              className="w-full rounded-xl bg-orange-500/[0.06] border border-orange-500/[0.12] px-4 py-3 text-left transition hover:bg-orange-500/[0.08]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-sans text-[12px] font-semibold text-gray-600">Setup — {checklistPercent}% complete</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${showChecklist ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-black/[0.06]">
                <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${checklistPercent}%` }} />
              </div>
            </button>
          )}

          {/* Expanded checklist items */}
          {showChecklist && checklistPercent < 100 && (
            <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
              {CHECKLIST_ITEMS.map((item, i) => {
                const done = checklist?.[item.key as keyof ChecklistState] ?? false;
                return (
                  <div
                    key={item.key}
                    className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""} ${done ? "opacity-50" : ""}`}
                  >
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-green-500" : "border-2 border-gray-200"}`}>
                      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-sans text-[13px] font-medium ${done ? "text-gray-400 line-through" : "text-gray-700"}`}>{item.label}</p>
                      {!done && <p className="font-sans text-[11px] text-gray-400 mt-0.5">{item.hint}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Publish / Draft controls */}
          <div className="flex gap-2">
            {reviewStatus !== "approved" && checklistPercent >= 100 && (
              <button
                onClick={async () => {
                  setPublishing(true);
                  try { await onPublish?.(); } finally { setPublishing(false); }
                }}
                disabled={publishing}
                className="flex-1 rounded-xl bg-orange-500 py-3 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish Hub"}
              </button>
            )}
            {reviewStatus === "approved" && (
              <button
                onClick={async () => {
                  setPublishing(true);
                  try { await onPublish?.(); } finally { setPublishing(false); }
                }}
                disabled={publishing}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 font-sans text-[13px] font-semibold text-red-500 transition active:scale-[0.98] disabled:opacity-50"
              >
                {publishing ? "..." : "Take Offline (Draft)"}
              </button>
            )}
            {reviewStatus === "pending" && (
              <div className="flex-1 rounded-xl border border-orange-200 bg-orange-50 py-3 text-center font-sans text-[13px] font-semibold text-orange-500">
                Under Review
              </div>
            )}
            {/* Reset hub */}
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 font-sans text-[13px] font-medium text-gray-400 transition hover:border-red-200 hover:text-red-400"
              >
                Reset
              </button>
            ) : (
              <button
                onClick={async () => {
                  setResetting(true);
                  try { await onReset?.(); } finally { setResetting(false); setConfirmReset(false); }
                }}
                disabled={resetting}
                className="shrink-0 rounded-xl border border-red-300 bg-red-500 px-4 py-3 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {resetting ? "..." : "Confirm Reset"}
              </button>
            )}
          </div>
        </div>

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
              <button onClick={() => setActiveDrawer("menu")} className={pillClass}>
                Menu
              </button>
              <button onClick={() => setActiveDrawer("hours")} className={pillClass}>
                Hours
              </button>
              <button onClick={() => setActiveDrawer("venue")} className={pillClass}>
                Venue Details
              </button>
            </div>
          </div>

          {/* POS Integration */}
          <div className="mx-4 mt-2">
            {!posProvider ? (
              <div className="rounded-xl border border-black/[0.06] bg-white p-4">
                <p className="font-sans text-[13px] font-semibold text-gray-700 mb-1">Connect your POS</p>
                <p className="font-sans text-[11px] text-gray-400 mb-3">Sync your product catalog from your point-of-sale system</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["Square", "Toast", "Clover", "Lightspeed", "Shopify"].map((name) => (
                    <span key={name} className="rounded-full bg-gray-50 border border-black/[0.04] px-2.5 py-1 font-sans text-[10px] font-medium text-gray-400">
                      {name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handlePosConnect}
                  disabled={posConnecting}
                  className="w-full rounded-xl bg-orange-500 py-2.5 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {posConnecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-black/[0.06] bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                    <p className="font-sans text-[13px] font-semibold text-gray-700">
                      Connected to {posProvider}
                    </p>
                  </div>
                  {posConnectedAt && (
                    <span className="font-sans text-[10px] text-gray-300">
                      Last sync {new Date(posConnectedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {posSyncResult && (
                  <p className="mb-2 font-sans text-[11px] text-green-600">{posSyncResult}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handlePosSync}
                    disabled={posSyncing}
                    className="flex-1 rounded-xl border border-orange-200 bg-orange-50 py-2 font-sans text-[12px] font-semibold text-orange-500 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {posSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                  <button
                    onClick={handlePosDisconnect}
                    disabled={posDisconnecting}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-sans text-[12px] font-medium text-gray-400 transition hover:border-red-200 hover:text-red-400 disabled:opacity-50"
                  >
                    {posDisconnecting ? "..." : "Disconnect"}
                  </button>
                </div>
              </div>
            )}
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
      {hubData.slug && (
        <div className="hidden lg:flex w-[420px] shrink-0 items-center justify-center bg-gray-50 border-l border-black/[0.08]">
          <div className="flex flex-col items-center gap-3">
            <div className="overflow-hidden rounded-[32px] border-2 border-black/[0.08]" style={{ width: 375, height: 680 }}>
              <iframe
                key={previewKey ?? 0}
                src={`https://join.thekickback.net/${hubData.slug}`}
                className="h-full w-full border-none bg-white"
                title="Hub Preview"
              />
            </div>
            <span className="font-mono text-[10px] text-gray-300">
              join.thekickback.net/{hubData.slug}
            </span>
          </div>
        </div>
      )}

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

      <AnimatePresence>
        {activeDrawer === "menu" && (
          <SettingsMenuDrawer
            venueId={venueId}
            initialMenuItems={initialMenuItems || []}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDrawer === "hours" && (
          <SettingsHoursDrawer
            venueId={venueId}
            initialHours={initialHours ?? null}
            onClose={() => setActiveDrawer(null)}
            onHoursChange={(text) => onFieldSave("hours", text)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDrawer === "venue" && (
          <SettingsVenueDrawer
            venueId={venueId}
            initialData={initialVenueData || {}}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
