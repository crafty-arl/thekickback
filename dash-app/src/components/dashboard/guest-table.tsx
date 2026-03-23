import { GuestSession } from "@/lib/dashboard";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function maskIdentifier(id: string): string {
  if (id.includes("@")) {
    const [local, domain] = id.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (id.length > 6) return `***-***-${id.slice(-4)}`;
  return id;
}

// Score tier config — what the venue owner sees at a glance
const SCORE_TIERS: { min: number; label: string; color: string; bg: string }[] = [
  { min: 5000, label: "VIP", color: "#a78bfa", bg: "#a78bfa15" },
  { min: 1500, label: "Regular", color: "#F97316", bg: "#F9731615" },
  { min: 500, label: "Known", color: "#facc15", bg: "#facc1515" },
  { min: 1, label: "New", color: "#4ade80", bg: "#4ade8015" },
  { min: 0, label: "First time", color: "#94a3b8", bg: "#94a3b815" },
];

function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

export function GuestTable({ sessions }: { sessions: GuestSession[] }) {
  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{activeCount}</p>
          <p className="font-sans text-[13px] text-black/40">In venue now</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-orange-500">
            {sessions.filter((s) => (s.venue_visits || 0) > 1).length}
          </p>
          <p className="font-sans text-[13px] text-black/40">Returning</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-violet-400">
            {sessions.filter((s) => s.is_member).length}
          </p>
          <p className="font-sans text-[13px] text-black/40">Members</p>
        </div>
      </div>

      {/* Guest cards */}
      {sessions.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white px-6 py-12 text-center">
          <p className="text-[32px]">👋</p>
          <p className="mt-2 font-sans text-[15px] font-medium text-black/40">No one checked in right now</p>
          <p className="mt-1 font-sans text-[13px] text-black/25">Guests show up here when they scan your QR code</p>
        </div>
      )}

      {sessions.map((s) => {
        const identifier = s.profiles.email || s.profiles.phone;
        const displayName = s.profiles.display_name;
        const score = s.kickback_score || 0;
        const tier = getScoreTier(score);
        const venueXp = s.venue_xp || 0;
        const visits = s.venue_visits || 0;
        const isMember = s.is_member || false;

        return (
          <div
            key={s.id}
            className="overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-black/10"
          >
            <div className="flex items-center gap-4 px-5 py-4">
              {/* Avatar with score ring */}
              <div className="relative">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full font-sans text-[15px] font-bold"
                  style={{ backgroundColor: tier.bg, color: tier.color, border: `2px solid ${tier.color}` }}
                >
                  {(displayName || identifier).charAt(0).toUpperCase()}
                </div>
                {s.status === "active" && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-400" />
                )}
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[14px] font-semibold text-black/80 truncate">
                    {displayName || maskIdentifier(identifier)}
                  </span>
                  {isMember && (
                    <span className="rounded-full bg-orange-500/[0.08] px-2 py-0.5 font-sans text-[11px] font-bold tracking-wider text-orange-500">
                      MEMBER
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3">
                  <span className="font-sans text-[12px] text-black/35">
                    {visits === 0 ? "First visit" : visits === 1 ? "1 visit" : `${visits} visits`}
                  </span>
                  <span className="font-sans text-[12px] text-black/35">
                    {timeAgo(s.started_at)} in
                  </span>
                </div>
              </div>

              {/* Score + tier */}
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[16px] font-bold" style={{ color: tier.color }}>
                    {score.toLocaleString()}
                  </span>
                  <span className="font-sans text-[11px] text-black/25">KB</span>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold"
                  style={{ backgroundColor: tier.bg, color: tier.color }}
                >
                  {tier.label}
                </span>
              </div>
            </div>

            {/* XP bar at this venue */}
            {venueXp > 0 && (
              <div className="flex items-center gap-3 border-t border-black/[0.04] px-5 py-2">
                <span className="font-sans text-xs text-black/30">Venue XP</span>
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(venueXp / 20, 100)}%`,
                        backgroundColor: tier.color,
                      }}
                    />
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold" style={{ color: tier.color }}>
                  {venueXp} XP
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
