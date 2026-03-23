export const dynamic = "force-dynamic";

import { fetchApprovedVenues } from "@/lib/fetch-venues";
import { fetchDiscoveryVenues } from "@/lib/fetch-discovery";
import { JoinPageClient } from "@/components/join-page-client";
import type { Venue } from "@/lib/venues";

export default async function HomePage() {
  const [venueData, discoveryVenues] = await Promise.all([
    fetchApprovedVenues(),
    fetchDiscoveryVenues(),
  ]);

  const claimedVenues: Venue[] = venueData.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    category: v.category,
    neighborhood: v.neighborhood,
    vibe: v.vibe as Venue["vibe"],
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

  const claimedNames = new Set(claimedVenues.map((v) => v.name.toLowerCase()));
  const uniqueDiscovery = discoveryVenues.filter(
    (v) => !claimedNames.has(v.name.toLowerCase())
  );

  const allVenues = [...claimedVenues, ...uniqueDiscovery];

  return <JoinPageClient venues={allVenues} />;
}
