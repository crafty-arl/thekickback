"use client";

import { useState, useEffect } from "react";
import { pointsReasonCopy } from "@/lib/points-copy";

interface HistoryEntry {
  id: string;
  amount: number;
  reason: string;
  venue_id: string | null;
  venues: { name: string } | null;
  created_at: string;
}

interface PointsData {
  balance: {
    balance: number;
    total_earned: number;
    tier: string;
    current_streak: number;
    venues_visited: number;
  };
  perks: Array<{
    id: string;
    name: string;
    description: string | null;
    point_cost: number;
    category: string;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    description: string;
    point_reward: number;
  }>;
  history?: HistoryEntry[];
}

const TIER_CONFIG: Record<string, { color: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", next: "Member", threshold: 1500 },
  member: { color: "#f97316", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", next: "", threshold: Infinity },
};

const CATEGORY_EMOJI: Record<string, string> = {
  drink: "\u2615",
  food: "\ud83c\udf54",
  access: "\ud83d\udd11",
  experience: "\u2728",
  merch: "\ud83c\udf81",
  other: "\ud83c\udfaf",
};

interface PointsBadgeProps {
  venueId: string;
  vibeColor: string;
  expanded: boolean;
}

export function PointsBadge({ venueId, vibeColor, expanded }: PointsBadgeProps) {
  const [data, setData] = useState<PointsData | null>(null);
  const [showPerks, setShowPerks] = useState(false);

  useEffect(() => {
    fetch(`/api/points?venueId=${venueId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, [venueId]);

  if (!data) return null;

  const { balance, perks, challenges, history = [] } = data;
  const tier = TIER_CONFIG[balance.tier] || TIER_CONFIG.explorer;

  // Phase 1: next-perk bridge — cheapest perk the user can't yet afford,
  // so the venue-local ladder is visible without expanding the full perks list.
  const nextPerk = [...perks]
    .sort((a, b) => a.point_cost - b.point_cost)
    .find((p) => p.point_cost > balance.balance) ?? null;
  const perkPct = nextPerk
    ? Math.max(0, Math.min(100, Math.round((balance.balance / nextPerk.point_cost) * 100)))
    : 100;

  // Phase 3: Recent points events with reason copy. Last 3 most-recent
  // earn/spend events. Replaces naked "+N pts" by always showing the why.
  const recentEvents = history.slice(0, 3);

  // Collapsed: just show points count
  if (!expanded) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 8,
          backgroundColor: `${tier.color}15`,
          fontSize: 10,
          fontWeight: 700,
          color: tier.color,
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        }}
      >
        {balance.balance.toLocaleString()} pts
      </div>
    );
  }

  // Expanded: full points section
  return (
    <div style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}>
      {/* Points bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          margin: "0 12px 8px",
          borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              backgroundColor: `${tier.color}18`,
              fontSize: 9,
              fontWeight: 700,
              color: tier.color,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {balance.tier}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
            {balance.balance.toLocaleString()}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>pts</span>
        </div>
        <button
          onClick={() => setShowPerks(!showPerks)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            backgroundColor: showPerks ? `${vibeColor}20` : "rgba(255,255,255,0.06)",
            border: `1px solid ${showPerks ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
            fontSize: 10,
            fontWeight: 600,
            color: showPerks ? vibeColor : "rgba(255,255,255,0.4)",
            cursor: "pointer",
          }}
        >
          {showPerks ? "Hide Perks" : "Perks"}
        </button>
      </div>

      {/* Phase 3: tier progress bar removed — perk bridge below is the single ladder */}

      {/* Next-perk bridge — venue-local ladder, always visible */}
      {nextPerk && !showPerks && (
        <div style={{ margin: "0 12px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11 }}>{CATEGORY_EMOJI[nextPerk.category] || "\u{1F3AF}"}</span>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{nextPerk.name}</span>
            </span>
            <span style={{ fontFamily: "monospace", color: vibeColor }}>
              {nextPerk.point_cost - balance.balance} to go
            </span>
          </div>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${perkPct}%`,
                borderRadius: 2,
                backgroundColor: vibeColor,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Streak + visits */}
      {(balance.current_streak > 0 || balance.venues_visited > 0) && (
        <div
          style={{
            display: "flex",
            gap: 6,
            margin: "0 12px 8px",
          }}
        >
          {balance.current_streak > 0 && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.04)",
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              &#x1f525; {balance.current_streak}wk streak
            </span>
          )}
          {balance.venues_visited > 0 && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.04)",
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              &#x1f4cd; {balance.venues_visited} venues
            </span>
          )}
        </div>
      )}

      {/* Perks list */}
      {showPerks && perks.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            margin: "0 12px 8px",
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {perks.map((perk) => {
            const canAfford = balance.balance >= perk.point_cost;
            return (
              <div
                key={perk.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  backgroundColor: canAfford ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${canAfford ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`,
                  opacity: canAfford ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {CATEGORY_EMOJI[perk.category] || "\ud83c\udfaf"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
                    {perk.name}
                  </div>
                  {perk.description && (
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                      {perk.description}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: canAfford ? vibeColor : "rgba(255,255,255,0.25)",
                    fontFamily: "monospace",
                  }}
                >
                  {perk.point_cost} pts
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Phase 3: Recent points feed with reason copy — no more naked +N */}
      {recentEvents.length > 0 && !showPerks && (
        <div style={{ margin: "0 12px 8px" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
              marginBottom: 4,
            }}
          >
            Recent
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {recentEvents.slice(0, 2).map((e) => {
              const earned = e.amount > 0;
              const venueName = e.venues?.name;
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 8px",
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: earned ? vibeColor : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {earned ? "+" : ""}{e.amount}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.55)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {pointsReasonCopy(e.reason)}
                      {venueName ? ` · ${venueName}` : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active challenges */}
      {challenges.length > 0 && !showPerks && (
        <div style={{ margin: "0 12px 4px" }}>
          {challenges.slice(0, 1).map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 10,
                backgroundColor: "rgba(249,115,22,0.06)",
                border: "1px solid rgba(249,115,22,0.1)",
              }}
            >
              <span style={{ fontSize: 12 }}>&#x1f3af;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#f97316" }}>{c.title}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{c.description}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: "monospace" }}>
                +{c.point_reward}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
