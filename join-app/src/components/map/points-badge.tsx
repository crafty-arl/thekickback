"use client";

import { useState, useEffect } from "react";

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
}

const TIER_CONFIG: Record<string, { color: string; next: string; threshold: number }> = {
  explorer: { color: "#94a3b8", next: "Regular", threshold: 500 },
  regular: { color: "#4ade80", next: "Member", threshold: 1500 },
  member: { color: "#f97316", next: "VIP", threshold: 5000 },
  vip: { color: "#a78bfa", next: "", threshold: Infinity },
};

const CATEGORY_EMOJI: Record<string, string> = {
  drink: "☕",
  food: "🍔",
  access: "🔑",
  experience: "✨",
  merch: "🎁",
  other: "🎯",
};

interface PointsBadgeProps {
  userId: string | null;
  venueId: string;
  vibeColor: string;
  expanded: boolean;
}

export function PointsBadge({ userId, venueId, vibeColor, expanded }: PointsBadgeProps) {
  const [data, setData] = useState<PointsData | null>(null);
  const [showPerks, setShowPerks] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/points?userId=${userId}&venueId=${venueId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [userId, venueId]);

  if (!data || !userId) return null;

  const { balance, perks, challenges } = data;
  const tier = TIER_CONFIG[balance.tier] || TIER_CONFIG.explorer;
  const nextThreshold = tier.threshold;
  const progress = tier.next
    ? Math.min((balance.total_earned / nextThreshold) * 100, 100)
    : 100;

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

      {/* Progress bar */}
      {tier.next && (
        <div style={{ margin: "0 12px 8px", padding: "0 0" }}>
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
                width: `${progress}%`,
                borderRadius: 2,
                backgroundColor: tier.color,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 3,
              fontSize: 9,
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <span>{balance.total_earned.toLocaleString()} earned</span>
            <span>{nextThreshold.toLocaleString()} for {tier.next}</span>
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
              🔥 {balance.current_streak}wk streak
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
              📍 {balance.venues_visited} venues
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
                  {CATEGORY_EMOJI[perk.category] || "🎯"}
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
              <span style={{ fontSize: 12 }}>🎯</span>
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
