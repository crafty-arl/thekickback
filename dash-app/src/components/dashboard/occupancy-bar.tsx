import { VenueStats } from "@/lib/dashboard";

export function OccupancyBar({ stats }: { stats: VenueStats }) {
  const pct = Math.round((stats.currentOccupancy / stats.capacity) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
          OCCUPANCY
        </span>
        <span className="font-sans text-sm font-semibold text-black">
          {stats.currentOccupancy} / {stats.capacity}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 90 ? "bg-red-400" : pct >= 65 ? "bg-orange" : pct >= 35 ? "bg-yellow-400" : "bg-green-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-black/35">
          {pct}% full
        </span>
        <span className="font-sans text-xs text-black/35">
          Peak hour: {stats.peakHour}
        </span>
      </div>
    </div>
  );
}
