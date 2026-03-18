import { VenueRequest } from "@/lib/dashboard";

const TYPE_ICONS: Record<string, string> = {
  booth: "B",
  order: "O",
  question: "?",
  other: "~",
};

export function RequestFeed({ requests }: { requests: VenueRequest[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
          REQUESTS
        </span>
        <span className="font-sans text-xs text-black/35">
          {requests.filter((r) => r.status === "pending").length} pending
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
              r.status === "pending"
                ? "bg-orange/[0.06] border border-orange/10"
                : r.status === "accepted"
                  ? "bg-yellow-50 border border-yellow-200/30"
                  : "bg-black/[0.02] border border-black/[0.04]"
            }`}
          >
            {/* Type badge */}
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
              r.status === "pending" ? "bg-orange/20 text-orange" : "bg-black/[0.06] text-black/30"
            }`}>
              {TYPE_ICONS[r.type]}
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-black/50">{r.guestPhone}</span>
                <span className="font-sans text-[10px] text-black/30">{r.createdAt}</span>
              </div>
              <p className="font-sans text-sm text-black/70">{r.message}</p>
            </div>

            {/* Status */}
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-sans text-[10px] font-medium tracking-wide ${
              r.status === "pending"
                ? "bg-orange text-black"
                : r.status === "accepted"
                  ? "bg-yellow-400/50 text-yellow-900"
                  : "bg-black/[0.06] text-black/30"
            }`}>
              {r.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
