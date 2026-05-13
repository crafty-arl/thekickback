"use client";

import { useEffect, useState } from "react";

interface LoopHealth {
  venue_id: string;
  venue_name: string | null;
  checkins_7d: number;
  active_guests_7d: number;
  returns_7d: number;
  unprompted_returns_7d: number;
  chat_cost_usd_7d: number;
  redemptions_7d: number;
  vibe_drops_7d: number;
  chat_messages_7d: number;
  chat_action_clicks_7d: number;
  chat_cost_per_action_usd_7d: number | null;
  chat_action_rate_7d: number | null;
}

interface Props {
  venueId: string;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

// Phase 1 deliverable: surfaces "is the loop holding without prompting?"
// for each hub. Six numbers. No charts, no tooltips. Owners read this in 5s.
export function LoopHealthPanel({ venueId }: Props) {
  const [health, setHealth] = useState<LoopHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/loop-health?venueId=${venueId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.health) setHealth(data.health);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  if (loading || !health) {
    return (
      <div className="rounded-2xl bg-white p-4 border border-black/5">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Check-ins", value: String(health.checkins_7d), color: "#0F172A" },
    { label: "Vibe drops", value: String(health.vibe_drops_7d), color: "#F97316" },
    { label: "Active guests", value: String(health.active_guests_7d), color: "#0F172A" },
    { label: "Returns", value: String(health.returns_7d), color: "#0F172A" },
    {
      label: "% unprompted",
      value: pct(health.unprompted_returns_7d, health.returns_7d),
      color: "#16a34a",
    },
    { label: "Redemptions", value: String(health.redemptions_7d), color: "#0F172A" },
    {
      label: "Chat cost",
      value: fmtUsd(Number(health.chat_cost_usd_7d)),
      color: "#8B5CF6",
    },
    {
      label: "$ / action",
      value:
        health.chat_cost_per_action_usd_7d == null
          ? "—"
          : fmtUsd(Number(health.chat_cost_per_action_usd_7d)),
      color: "#8B5CF6",
    },
    {
      label: "Chat → action",
      value:
        health.chat_action_rate_7d == null
          ? "—"
          : `${Math.round(Number(health.chat_action_rate_7d) * 100)}%`,
      color: "#16a34a",
    },
  ];

  return (
    <div className="rounded-2xl bg-white p-4 border border-black/5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-sans text-[15px] font-semibold text-gray-700">
          Loop health
        </h3>
        <span className="font-sans text-[11px] text-gray-300">last 7 days</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p
              className="font-mono text-[20px] font-bold tracking-tight"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className="font-sans text-[11px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>
      {health.returns_7d === 0 && health.checkins_7d > 0 && (
        <p className="mt-3 font-sans text-[11px] text-gray-400">
          No returns yet — every check-in this week is a first visit.
        </p>
      )}
    </div>
  );
}
