const VENUE_THREADS = [
  { name: "Daily Grind", lastText: "Quiet · 8 people · good for focus", status: "quiet" },
  { name: "The Rooftop", lastText: "Busy · 28 people · booth 4 held for you", status: "busy" },
  { name: "Study Loft", lastText: "Moderate · 14 people · 2 groups", status: "moderate" },
  { name: "North House", lastText: "Members only tonight · text MEMBERSHIP", status: "members" },
  { name: "Late Shift", lastText: "Opening at 8 PM · text NOTIFY to get pinged", status: "closed" },
];

export function Venues() {
  return (
    <section id="venues" className="flex flex-col gap-8 py-14">
      {/* Text */}
      <div className="flex flex-col gap-4">
        <span className="font-sans text-[11px] font-medium tracking-[2.4px] text-black/45">
          YOUR VENUE THREADS
        </span>
        <h2 className="font-display text-[42px] font-semibold leading-[1.05] tracking-[-1.5px] text-black">
          Every venue is a conversation.
        </h2>
        <p className="max-w-2xl font-sans text-base leading-[1.6] text-black/65">
          Your message inbox becomes a live dashboard of every venue you&apos;ve
          entered. Each thread is an open channel. Text STATUS to any of them
          anytime.
        </p>
      </div>

      {/* Venue Thread List */}
      <div className="overflow-hidden rounded-[32px] bg-black p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            ACTIVE THREADS
          </span>
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            5 VENUES
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {VENUE_THREADS.map((venue) => (
            <div
              key={venue.name}
              className="flex items-center gap-4 rounded-2xl bg-white/[0.04] px-5 py-4 transition-colors hover:bg-white/[0.07]"
            >
              {/* Status dot */}
              <div
                className={`h-3 w-3 shrink-0 rounded-full ${
                  venue.status === "busy"
                    ? "bg-orange shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                    : venue.status === "quiet"
                      ? "bg-green-400/80"
                      : venue.status === "moderate"
                        ? "bg-yellow-400/80"
                        : venue.status === "members"
                          ? "bg-white/40"
                          : "bg-white/15"
                }`}
              />

              {/* Venue info */}
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-sans text-sm font-semibold text-white">
                  {venue.name}
                </span>
                <span className="font-sans text-xs text-white/45">
                  {venue.lastText}
                </span>
              </div>

              {/* Text action */}
              <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 font-mono text-xs font-medium text-white/50">
                text status
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
