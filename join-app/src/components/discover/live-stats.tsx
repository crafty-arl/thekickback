import { Venue } from "@/lib/venues";

export function LiveStats({ venues }: { venues: Venue[] }) {
  const totalPeople = venues.reduce((sum, v) => sum + v.occupancy, 0);
  const openVenues = venues.filter((v) => !v.memberOnly).length;
  const quietSpots = venues.filter((v) => v.vibe === "quiet").length;

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4">
      <div className="flex items-center gap-2 rounded-full border border-black/5 px-4 py-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
        <span className="font-sans text-sm text-black/55">
          <strong className="text-black">{venues.length}</strong> venues live
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-black/5 px-4 py-2">
        <span className="font-sans text-sm text-black/55">
          <strong className="text-black">{totalPeople}</strong> people out right now
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-black/5 px-4 py-2">
        <span className="font-sans text-sm text-black/55">
          <strong className="text-black">{openVenues}</strong> open to everyone
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-black/5 px-4 py-2">
        <span className="font-sans text-sm text-black/55">
          <strong className="text-black">{quietSpots}</strong> quiet spots
        </span>
      </div>
    </div>
  );
}
