import { VenueRequest } from "@/lib/dashboard";

const TYPE_ICONS: Record<string, string> = {
  booth: "B",
  order: "O",
  service: "S",
  question: "?",
  other: "~",
};

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

export function RequestFeed({ requests }: { requests: VenueRequest[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/40">
          REQUESTS
        </span>
        <span className="font-sans text-xs text-black/35">
          {requests.filter((r) => r.status === "pending").length} pending
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {requests.length === 0 && (
          <p className="py-4 text-center font-sans text-sm text-black/30">
            No requests yet.
          </p>
        )}
        {requests.map((r) => {
          const identifier = r.profiles.email || r.profiles.phone;

          return (
            <div
              key={r.id}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 ${r.status === "pending"
                  ? "bg-orange/[0.06] border border-orange/10"
                  : r.status === "accepted"
                    ? "bg-yellow-50 border border-yellow-200/30"
                    : "bg-black/[0.02] border border-black/[0.04]"
                }`}
            >
              {/* Type badge */}
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${r.status === "pending" ? "bg-orange/20 text-orange" : "bg-black/[0.06] text-black/30"
                }`}>
                {TYPE_ICONS[r.type] || "~"}
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-black/50">
                    {maskIdentifier(identifier)}
                  </span>
                  <span className="font-sans text-[11px] text-black/30">
                    {timeAgo(r.created_at)}
                  </span>
                </div>
                <p className="font-sans text-sm text-black/70">{r.body}</p>
              </div>

              {/* Status */}
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-sans text-[11px] font-medium tracking-wide ${r.status === "pending"
                  ? "bg-orange text-black"
                  : r.status === "accepted"
                    ? "bg-yellow-400/50 text-yellow-900"
                    : "bg-black/[0.06] text-black/30"
                }`}>
                {r.status.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
