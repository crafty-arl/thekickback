import { GuestSession } from "@/lib/dashboard";

export function GuestTable({ sessions }: { sessions: GuestSession[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5">
      <div className="flex items-center justify-between bg-[#FAFAFA] px-5 py-3">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
          ACTIVE SESSIONS
        </span>
        <span className="font-sans text-xs text-black/35">
          {sessions.filter((s) => s.status !== "left").length} in venue
        </span>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-4 px-5 py-3 ${s.status === "left" ? "opacity-40" : ""}`}
          >
            {/* Status dot */}
            <div
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                s.status === "active"
                  ? "bg-green-400/80"
                  : s.status === "held"
                    ? "bg-yellow-400/80"
                    : "bg-black/15"
              }`}
            />

            {/* Phone + type */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="font-mono text-sm text-black">{s.phone}</span>
              <span className={`rounded-md px-2 py-0.5 font-sans text-[10px] font-medium tracking-wide ${
                s.type === "member"
                  ? "bg-orange/10 text-orange"
                  : "bg-black/[0.04] text-black/40"
              }`}>
                {s.type.toUpperCase()}
              </span>
            </div>

            {/* Location */}
            <span className="hidden font-sans text-sm text-black/50 md:block">{s.location}</span>

            {/* Entered at */}
            <span className="hidden font-sans text-xs text-black/35 lg:block">{s.enteredAt}</span>

            {/* Last command */}
            <span className="rounded-md bg-black px-2.5 py-1 font-mono text-[11px] font-medium text-orange">
              {s.lastCommand}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
