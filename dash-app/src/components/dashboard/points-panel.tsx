import type { VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";

interface PointsPanelProps {
  perks: VenuePerk[];
  redemptions: PerkRedemption[];
  multipliers: VenueMultiplier[];
  leaderboard: PointLeaderboardEntry[];
  pointsIssuedToday: number;
  perksRedeemedToday: number;
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
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3"
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
                </div>
              ))}
            </div>
          </div>
        </div>

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
