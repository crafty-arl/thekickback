import { fetchApprovedVenues } from "@/lib/fetch-venues";
import { fetchDiscoveryVenues } from "@/lib/fetch-discovery";
import { JoinPageClient } from "@/components/join-page-client";
import type { Venue } from "@/lib/venues";

export default async function JoinPage() {
  // Fetch approved Supabase venues and Foursquare discovery venues in parallel
  const [venueData, discoveryVenues] = await Promise.all([
    fetchApprovedVenues(),
    fetchDiscoveryVenues(),
  ]);

  // Map server data to the client Venue interface (these are claimed)
  const claimedVenues: Venue[] = venueData.map((v) => ({
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
    claimed: true,
  }));

  // Deduplicate: remove discovery venues that match a claimed venue by name
  const claimedNames = new Set(claimedVenues.map((v) => v.name.toLowerCase()));
  const uniqueDiscovery = discoveryVenues.filter(
    (v) => !claimedNames.has(v.name.toLowerCase())
  );

  // Claimed venues first, then discovery
  const allVenues = [...claimedVenues, ...uniqueDiscovery];

  return <JoinPageClient venues={allVenues} />;
}
