import { GuestSession } from "@/lib/dashboard";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function maskIdentifier(id: string): string {
  if (id.includes("@")) {
    const [local, domain] = id.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (id.length > 6) {
    return `***-***-${id.slice(-4)}`;
  }
  return id;
}

export function GuestTable({ sessions }: { sessions: GuestSession[] }) {
  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5">
      <div className="flex items-center justify-between bg-[#FAFAFA] px-5 py-3">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
          ACTIVE SESSIONS
        </span>
        <span className="font-sans text-xs text-black/35">
          {activeCount} in venue
        </span>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {sessions.length === 0 && (
          <div className="px-5 py-6 text-center font-sans text-sm text-black/30">
            No active sessions right now.
          </div>
        )}
        {sessions.map((s) => {
          const identifier = s.profiles.email || s.profiles.phone;
          const displayName = s.profiles.display_name;
          const isMember = false; // Will be enhanced later with membership join

          return (
            <div
              key={s.id}
              className={`flex items-center gap-4 px-5 py-3 ${s.status !== "active" ? "opacity-40" : ""}`}
            >
              {/* Status dot */}
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.status === "active"
                    ? "bg-green-400/80"
                    : "bg-black/15"
                  }`}
              />

              {/* Identifier + type */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-mono text-sm text-black">
                  {displayName || maskIdentifier(identifier)}
                </span>
                <span className={`rounded-md px-2 py-0.5 font-sans text-[10px] font-medium tracking-wide ${isMember
                    ? "bg-orange/10 text-orange"
                    : "bg-black/[0.04] text-black/40"
                  }`}>
                  {isMember ? "MEMBER" : "GUEST"}
                </span>
              </div>

              {/* Time in */}
              <span className="hidden font-sans text-xs text-black/35 md:block">
                {timeAgo(s.started_at)}
              </span>

              {/* Status badge */}
              <span className="rounded-md bg-black px-2.5 py-1 font-mono text-[11px] font-medium text-orange">
                {s.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
