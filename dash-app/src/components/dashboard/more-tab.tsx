"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Sub-components ─────────────────────────────────────────────────

function MoreMenuItem({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-gray-50"
      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <span className="text-[18px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-medium text-gray-700">{label}</p>
        <p className="font-sans text-[11px] text-gray-400">{desc}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ─── Types ──────────────────────────────────────────────────────────

interface MoreTabProps {
  offeringsState: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }[];
  initialXpActions?: { label: string; points: number }[];
  initialXpMilestones?: { name: string; threshold: number }[];
  user: { id: string; email: string };
}

// ─── Component ──────────────────────────────────────────────────────

export function MoreTab({
  offeringsState,
  initialXpActions,
  initialXpMilestones,
  user,
}: MoreTabProps) {
  const [seeding, setSeeding] = useState(false);

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
    <div className="p-4 lg:p-6 space-y-3">
      {/* Offerings */}
      <Sheet>
        <SheetTrigger
          render={
            <MoreMenuItem
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
              label="Offerings"
              desc={`${offeringsState.length} active offerings`}
            />
          }
        />
        <SheetContent side="right" className="w-full sm:max-w-md bg-white border-gray-200">
          <SheetHeader>
            <SheetTitle className="text-gray-900">Offerings</SheetTitle>
            <SheetDescription className="text-gray-400">Manage your products, services, and memberships</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {offeringsState.length === 0 ? (
              <p className="text-center py-8 font-sans text-[13px] text-gray-400">No offerings yet</p>
            ) : (
              offeringsState.map((o) => (
                <div key={o.id} className="rounded-xl bg-gray-50 px-4 py-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[13px] font-medium text-gray-700">{o.name}</span>
                    <span className="font-mono text-[12px] text-gray-400">{fmtCents(o.price_cents)}</span>
                  </div>
                  <p className="mt-0.5 font-sans text-[11px] text-gray-400">{o.type}{o.description ? ` — ${o.description}` : ""}</p>
                </div>
              ))
            )}
            <Link
              href="/settings#offerings"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
              style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.2)" }}
            >
              Edit in Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Staff */}
      <Sheet>
        <SheetTrigger
          render={
            <MoreMenuItem
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>}
              label="Staff Management"
              desc="Manage your team members"
            />
          }
        />
        <SheetContent side="right" className="w-full sm:max-w-md bg-white border-gray-200">
          <SheetHeader>
            <SheetTitle className="text-gray-900">Staff Management</SheetTitle>
            <SheetDescription className="text-gray-400">Add and manage your team</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Link
              href="/settings#staff"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
              style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              Manage Staff in Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Knowledge */}
      <Sheet>
        <SheetTrigger
          render={
            <MoreMenuItem
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>}
              label="AI Knowledge Base"
              desc="Teach your AI about your venue"
            />
          }
        />
        <SheetContent side="right" className="w-full sm:max-w-md bg-white border-gray-200">
          <SheetHeader>
            <SheetTitle className="text-gray-900">AI Knowledge Base</SheetTitle>
            <SheetDescription className="text-gray-400">Add info your AI should know about your venue</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Link
              href="/settings#knowledge"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
              style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              Edit Knowledge in Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* XP & Loyalty */}
      <Sheet>
        <SheetTrigger
          render={
            <MoreMenuItem
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
              label="XP & Loyalty"
              desc={`${initialXpActions?.length || 0} actions, ${initialXpMilestones?.length || 0} milestones`}
            />
          }
        />
        <SheetContent side="right" className="w-full sm:max-w-md bg-white border-gray-200">
          <SheetHeader>
            <SheetTitle className="text-gray-900">XP & Loyalty</SheetTitle>
            <SheetDescription className="text-gray-400">Configure how guests earn and redeem points</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {/* XP Actions */}
            {initialXpActions && initialXpActions.length > 0 && (
              <div>
                <p className="mb-2 font-sans text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</p>
                {initialXpActions.map((a, i) => (
                  <div key={i} className="mb-1.5 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <span className="font-sans text-[13px] text-gray-600">{a.label}</span>
                    <span className="font-sans text-[12px] font-medium text-green-600">+{a.points} XP</span>
                  </div>
                ))}
              </div>
            )}
            {/* Milestones */}
            {initialXpMilestones && initialXpMilestones.length > 0 && (
              <div>
                <p className="mb-2 font-sans text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Milestones</p>
                {initialXpMilestones.map((m, i) => (
                  <div key={i} className="mb-1.5 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <span className="font-sans text-[13px] text-gray-500">{m.name}</span>
                    <span className="font-sans text-[11px] text-gray-400">{m.threshold} XP</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/settings#xp"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition"
              style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              Edit XP in Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Account section */}
      <div
        className="rounded-xl bg-white px-4 py-4 space-y-3"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <p className="font-sans text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Account</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-[13px] text-gray-600">{user.email}</p>
            <p className="font-sans text-[11px] text-gray-400">Owner</p>
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Seed Demo (sandbox-only visual indicator) */}
      <div
        className="rounded-xl px-4 py-4"
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

      {/* Full settings link */}
      <Link
        href="/settings"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-200 py-3 font-sans text-[13px] font-medium text-gray-400 transition hover:text-gray-600"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        All Settings
      </Link>
    </div>
  );
}
