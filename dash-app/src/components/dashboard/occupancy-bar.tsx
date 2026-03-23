import { VenueStats } from "@/lib/dashboard";

export function ActiveSessionsBar({ stats }: { stats: VenueStats }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
          CHECKED IN
        </span>
        <span className="font-sans text-sm font-semibold text-black">
          {stats.currentOccupancy}
        </span>
      </div>
    </div>
  );
}
