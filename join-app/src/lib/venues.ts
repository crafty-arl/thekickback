export type VibeLevel = "quiet" | "moderate" | "busy" | "lit" | "packed";
export type VenueCategory = string;

export interface Venue {
  id: string;
  name: string;
  slug?: string;
  category: VenueCategory;
  neighborhood: string;
  vibe: VibeLevel;
  occupancy: number;
  capacity: number;
  description: string;
  tagline?: string;
  address?: string;
  tags: string[];
  hours: string;
  memberOnly: boolean;
  textNumber: string;
  latitude: number;
  longitude: number;
  themeColor?: string;
  heroImage?: string | null;
  logo?: string | null;
  claimed?: boolean;
  isEventPin?: boolean;
  parentVenueId?: string;
  eventName?: string;
  eventDate?: string;
  locationMode?: "fixed" | "mobile" | "virtual";
}

export const VENUE_CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cafe", label: "Cafes" },
  { value: "rooftop", label: "Rooftops" },
  { value: "bar", label: "Bars" },
  { value: "lounge", label: "Lounges" },
  { value: "cowork", label: "Cowork" },
  { value: "coworking", label: "Cowork" },
  { value: "restaurant", label: "Restaurants" },
  { value: "club", label: "Clubs" },
  { value: "barbershop", label: "Barbershops" },
  { value: "nail_salon", label: "Nail Salons" },
  { value: "group", label: "Groups" },
  { value: "community", label: "Communities" },
  { value: "league", label: "Leagues" },
  { value: "org", label: "Orgs" },
  { value: "artist", label: "Artists" },
  { value: "musician", label: "Musicians" },
  { value: "creator", label: "Creators" },
  { value: "event", label: "Events" },
  { value: "venue", label: "All Hubs" },
];

// Austin, TX center
export const MAP_CENTER = { latitude: 30.267, longitude: -97.743 } as const;
export const MAP_DEFAULT_ZOOM = 13;

export function getVibeColor(vibe: VibeLevel | string): string {
  switch (vibe) {
    case "quiet": return "bg-green-400/80";
    case "moderate": return "bg-yellow-400/80";
    case "busy": return "bg-orange";
    case "lit":
    case "packed": return "bg-red-400/80";
    default: return "bg-gray-400/80";
  }
}

export function getVibeHexColor(vibe: VibeLevel | string): string {
  switch (vibe) {
    case "quiet": return "#4ade80";
    case "moderate": return "#facc15";
    case "busy": return "#f97316";
    case "lit":
    case "packed": return "#f87171";
    default: return "#9ca3af";
  }
}

export function getVibeLabel(vibe: VibeLevel | string): string {
  switch (vibe) {
    case "quiet": return "Quiet";
    case "moderate": return "Moderate";
    case "busy": return "Busy";
    case "lit": return "Lit";
    case "packed": return "Packed";
    default: return vibe.charAt(0).toUpperCase() + vibe.slice(1);
  }
}

export function getOccupancyPercent(venue: Venue): number {
  if (!venue.capacity) return 0;
  return Math.round((venue.occupancy / venue.capacity) * 100);
}
