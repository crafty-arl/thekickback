import { fetchApprovedVenues } from "@/lib/fetch-venues";
import { JoinPageClient } from "@/components/join-page-client";
import type { Venue } from "@/lib/venues";

export default async function JoinPage() {
  const venueData = await fetchApprovedVenues();

  // Map server data to the client Venue interface
  const venues: Venue[] = venueData.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    category: v.category,
    neighborhood: v.neighborhood,
    vibe: v.vibe as Venue["vibe"],
    occupancy: v.occupancy,
    capacity: v.capacity,
    description: v.description,
    tags: v.tags,
    hours: v.hours,
    memberOnly: v.memberOnly,
    textNumber: v.textNumber,
    latitude: v.latitude,
    longitude: v.longitude,
    themeColor: v.themeColor,
  }));

  return <JoinPageClient venues={venues} />;
}
