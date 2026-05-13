"use client";

import { useEffect, useState } from "react";
import type { VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";

interface PointsPanelProps {
  venueId: string;
  perks: VenuePerk[];
  redemptions: PerkRedemption[];
  multipliers: VenueMultiplier[];
  leaderboard: PointLeaderboardEntry[];
  pointsIssuedToday: number;
  perksRedeemedToday: number;
}

interface LedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  reason_copy: string;
  reference_id: string | null;
  created_at: string;
  guest_label: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  drink: "#4ade80",
  food: "#facc15",
  access: "#f97316",
  experience: "#a78bfa",
  merch: "#60a5fa",
  other: "#94a3b8",
};

const TIER_COLORS: Record<string, string> = {
  explorer: "#94a3b8",
  regular: "#4ade80",
  member: "#f97316",
  vip: "#a78bfa",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PointsPanel({
  venueId,
  perks,
  redemptions,
  multipliers,
  leaderboard,
  pointsIssuedToday,
  perksRedeemedToday,
}: PointsPanelProps) {
  const activeMultiplier = multipliers.find(
    (m) => m.active && new Date(m.starts_at) <= new Date() && new Date(m.ends_at) >= new Date()
  );

  // Phase 3: "Why this customer got these" drawer — owner self-service for
  // points defensibility. Click a redemption row to load that user's ledger
  // at this venue.
  const [openRedemption, setOpenRedemption] = useState<PerkRedemption | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);

  useEffect(() => {
    if (!openRedemption) return;
    let cancelled = false;
    setEntriesLoading(true);
    setEntries(null);
    fetch(
      `/api/points/ledger?venueId=${encodeURIComponent(venueId)}&userId=${encodeURIComponent(
        openRedemption.user_id,
      )}&limit=50`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
      })
      .catch(() => !cancelled && setEntries([]))
      .finally(() => !cancelled && setEntriesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [openRedemption, venueId]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-4">
          <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/35">POINTS ISSUED TODAY</span>
          <span className="font-sans text-2xl font-bold tracking-tight text-orange">{pointsIssuedToday.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-4">
          <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/35">PERKS REDEEMED</span>
          <span className="font-sans text-2xl font-bold tracking-tight text-black">{perksRedeemedToday}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-4">
          <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/35">ACTIVE PERKS</span>
          <span className="font-sans text-2xl font-bold tracking-tight text-black">{perks.filter((p) => p.active).length}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-4">
          <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/35">MULTIPLIER</span>
          <span className="font-sans text-2xl font-bold tracking-tight" style={{ color: activeMultiplier ? "#f97316" : "#00000030" }}>
            {activeMultiplier ? `${activeMultiplier.multiplier}x` : "—"}
          </span>
          {activeMultiplier && (
            <span className="font-sans text-xs text-black/40">{activeMultiplier.reason}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Perks + Redemptions */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Perks catalog */}
          <div className="rounded-2xl border border-black/5 bg-white p-5">
            <div className="flex items-center justify-between pb-4">
              <h3 className="font-sans text-sm font-bold tracking-tight text-black">Venue Perks</h3>
              <span className="font-sans text-[11px] font-medium tracking-[1.5px] text-black/30">
                {perks.length} TOTAL
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {perks.length === 0 && (
                <p className="py-4 text-center font-sans text-sm text-black/30">No perks created yet.</p>
              )}
              {perks.map((perk) => (
                <div
                  key={perk.id}
                  className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${CATEGORY_COLORS[perk.category] || CATEGORY_COLORS.other}15` }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[perk.category] || CATEGORY_COLORS.other }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="font-sans text-sm font-semibold text-black">{perk.name}</span>
                    {perk.description && (
                      <span className="font-sans text-xs text-black/40">{perk.description}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-sm font-bold text-orange">{perk.point_cost} pts</span>
                    {perk.inventory !== null && (
                      <span className="font-sans text-[11px] text-black/30">{perk.inventory} left</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent redemptions */}
          <div className="rounded-2xl border border-black/5 bg-white p-5">
            <div className="flex items-center justify-between pb-4">
              <h3 className="font-sans text-sm font-bold tracking-tight text-black">Recent Redemptions</h3>
            </div>
            <div className="flex flex-col gap-2">
              {redemptions.length === 0 && (
                <p className="py-4 text-center font-sans text-sm text-black/30">No redemptions yet.</p>
              )}
              {redemptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setOpenRedemption(r)}
                  className="flex w-full items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3 text-left transition hover:bg-[#F4F4F4]"
                  title="Why these points?"
                >
                  <div className="flex flex-1 flex-col">
                    <span className="font-sans text-sm font-semibold text-black">
                      {r.venue_perks?.name || "Perk"}
                    </span>
                    <span className="font-sans text-xs text-black/40">
                      {r.profiles?.display_name || r.profiles?.email || r.profiles?.phone || "Guest"} · {formatTime(r.created_at)}
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor:
                        r.status === "fulfilled" ? "#4ade8015" :
                        r.status === "pending" ? "#facc1515" :
                        r.status === "expired" ? "#f8717115" : "#f9731615",
                      color:
                        r.status === "fulfilled" ? "#4ade80" :
                        r.status === "pending" ? "#facc15" :
                        r.status === "expired" ? "#f87171" : "#f97316",
                    }}
                  >
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Phase 3: Why-these-points drawer (fixed overlay) */}
        {openRedemption && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            onClick={() => setOpenRedemption(null)}
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              <div className="flex items-start justify-between pb-2">
                <div>
                  <h3 className="font-sans text-base font-bold text-black">
                    Why these points
                  </h3>
                  <p className="font-sans text-xs text-black/50">
                    {openRedemption.profiles?.display_name ||
                      openRedemption.profiles?.email ||
                      openRedemption.profiles?.phone ||
                      "Guest"}{" "}
                    · {openRedemption.venue_perks?.name || "Perk"} ·{" "}
                    {formatTime(openRedemption.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setOpenRedemption(null)}
                  className="rounded-full p-1 text-black/40 hover:bg-black/[0.05]"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {entriesLoading && (
                  <p className="py-6 text-center font-sans text-sm text-black/30">
                    Loading ledger…
                  </p>
                )}
                {!entriesLoading && entries && entries.length === 0 && (
                  <p className="py-6 text-center font-sans text-sm text-black/30">
                    No ledger entries for this guest at this venue.
                  </p>
                )}
                {!entriesLoading &&
                  entries?.map((e) => {
                    const earned = e.amount > 0;
                    return (
                      <div
                        key={e.id}
                        className="flex items-center justify-between rounded-lg bg-[#FAFAFA] px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="font-sans text-sm font-semibold text-black">
                            {e.reason_copy}
                          </span>
                          <span className="font-sans text-[11px] text-black/40">
                            {formatTime(e.created_at)}
                          </span>
                        </div>
                        <span
                          className="font-mono text-sm font-bold"
                          style={{ color: earned ? "#16a34a" : "#f87171" }}
                        >
                          {earned ? "+" : ""}
                          {e.amount}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Right: Leaderboard */}
        <div className="w-full lg:w-[340px]">
          <div className="rounded-2xl border border-black/5 bg-white p-5">
            <div className="flex items-center justify-between pb-4">
              <h3 className="font-sans text-sm font-bold tracking-tight text-black">Top Earners</h3>
              <span className="font-sans text-[11px] font-medium tracking-[1.5px] text-black/30">
                AT YOUR VENUE
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {leaderboard.length === 0 && (
                <p className="py-4 text-center font-sans text-sm text-black/30">No activity yet.</p>
              )}
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3"
                >
                  <span className="w-5 font-mono text-xs font-bold text-black/25">{i + 1}</span>
                  <div className="flex flex-1 flex-col">
                    <span className="font-sans text-sm font-semibold text-black">
                      {entry.profiles?.display_name || entry.profiles?.email || entry.profiles?.phone || "Guest"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${TIER_COLORS[entry.tier] || TIER_COLORS.explorer}15`,
                          color: TIER_COLORS[entry.tier] || TIER_COLORS.explorer,
                        }}
                      >
                        {entry.tier}
                      </span>
                      {entry.current_streak > 0 && (
                        <span className="font-sans text-[11px] text-black/30">
                          {entry.current_streak}wk streak
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-orange">
                    {entry.total_earned.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
