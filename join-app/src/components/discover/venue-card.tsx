import { Venue, getVibeColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";

export function VenueCard({ venue }: { venue: Venue }) {
  const pct = getOccupancyPercent(venue);

  return (
    <div className="group flex flex-col gap-4  border border-black/5 bg-white p-5 transition-shadow hover:shadow-lg sm:p-6">
      {/* Top row: category + vibe */}
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-black/[0.04] px-3 py-1 font-sans text-[11px] font-medium tracking-wide text-black/50">
          {venue.category.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${getVibeColor(venue.vibe)}`} />
          <span className="font-sans text-xs font-medium text-black/50">
            {getVibeLabel(venue.vibe)}
          </span>
        </div>
      </div>

      {/* Name + neighborhood */}
      <div className="flex flex-col gap-1">
        <h3 className="font-sans text-xl font-semibold tracking-tight text-black">
          {venue.name}
        </h3>
        <span className="font-sans text-sm text-black/45">{venue.neighborhood}</span>
      </div>

      {/* Description */}
      <p className="font-sans text-sm leading-relaxed text-black/60">
        {venue.description}
      </p>

      {/* Occupancy bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[11px] font-medium text-black/40">
            {venue.occupancy} / {venue.capacity} people
          </span>
          <span className="font-sans text-[11px] font-medium text-black/40">
            {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 90 ? "bg-red-400/80" : pct >= 65 ? "bg-orange" : pct >= 35 ? "bg-yellow-400/80" : "bg-green-400/80"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {venue.tags.map((tag) => (
          <span
            key={tag}
            className=" border border-black/[0.06] px-2 py-0.5 font-sans text-[11px] text-black/45"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer: hours + CTA */}
      <div className="flex items-center justify-between border-t border-black/5 pt-4">
        <span className="font-sans text-xs text-black/40">{venue.hours}</span>
        <div className="flex items-center gap-2">
          {venue.memberOnly && (
            <span className=" bg-black px-2 py-0.5 font-sans text-[10px] font-medium tracking-wide text-white/70">
              MEMBERS
            </span>
          )}
          <span className=" bg-black px-4 py-2 font-mono text-xs font-medium text-orange transition-colors group-hover:bg-black/90">
            Chat
          </span>
        </div>
      </div>
    </div>
  );
}
