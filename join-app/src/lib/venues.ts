export type VibeLevel = "quiet" | "moderate" | "busy" | "lit";
export type VenueCategory = "cafe" | "rooftop" | "bar" | "lounge" | "cowork" | "restaurant";

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  neighborhood: string;
  vibe: VibeLevel;
  occupancy: number;
  capacity: number;
  description: string;
  tags: string[];
  hours: string;
  memberOnly: boolean;
  textNumber: string;
  latitude: number;
  longitude: number;
}

export const VENUE_CATEGORIES: { value: VenueCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cafe", label: "Cafes" },
  { value: "rooftop", label: "Rooftops" },
  { value: "bar", label: "Bars" },
  { value: "lounge", label: "Lounges" },
  { value: "cowork", label: "Cowork" },
  { value: "restaurant", label: "Restaurants" },
];

// Austin, TX center
export const MAP_CENTER = { latitude: 30.267, longitude: -97.743 } as const;
export const MAP_DEFAULT_ZOOM = 13;

export const MOCK_VENUES: Venue[] = [
  {
    id: "the-rooftop",
    name: "The Rooftop",
    category: "rooftop",
    neighborhood: "Downtown",
    vibe: "moderate",
    occupancy: 28,
    capacity: 60,
    description: "Open-air rooftop with city views. Great for groups and evening hangs.",
    tags: ["outdoor", "views", "cocktails", "groups"],
    hours: "4 PM – 12 AM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2672,
    longitude: -97.7431,
  },
  {
    id: "daily-grind",
    name: "Daily Grind",
    category: "cafe",
    neighborhood: "Midtown",
    vibe: "quiet",
    occupancy: 8,
    capacity: 30,
    description: "Calm coffee spot with fast Wi-Fi. Perfect for deep work and solo sessions.",
    tags: ["wifi", "coffee", "quiet", "solo"],
    hours: "7 AM – 6 PM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2740,
    longitude: -97.7407,
  },
  {
    id: "study-loft",
    name: "Study Loft",
    category: "cowork",
    neighborhood: "University District",
    vibe: "moderate",
    occupancy: 14,
    capacity: 40,
    description: "Community study space with bookable rooms and a quiet floor.",
    tags: ["study", "wifi", "rooms", "quiet"],
    hours: "8 AM – 10 PM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2849,
    longitude: -97.7341,
  },
  {
    id: "north-house",
    name: "North House",
    category: "lounge",
    neighborhood: "Northside",
    vibe: "busy",
    occupancy: 45,
    capacity: 50,
    description: "Members-only lounge with curated music, cocktails, and a fireplace corner.",
    tags: ["members", "cocktails", "music", "fireplace"],
    hours: "6 PM – 2 AM",
    memberOnly: true,
    textNumber: "+18777804236",
    latitude: 30.2950,
    longitude: -97.7420,
  },
  {
    id: "late-shift",
    name: "Late Shift",
    category: "bar",
    neighborhood: "East End",
    vibe: "lit",
    occupancy: 52,
    capacity: 55,
    description: "Late-night bar with DJs on weekends. Gets packed after 11.",
    tags: ["dj", "late-night", "dancing", "drinks"],
    hours: "8 PM – 3 AM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2615,
    longitude: -97.7260,
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    category: "restaurant",
    neighborhood: "Waterfront",
    vibe: "moderate",
    occupancy: 22,
    capacity: 45,
    description: "Farm-to-table restaurant with sunset views. Reservations via text.",
    tags: ["dinner", "views", "date-night", "seasonal"],
    hours: "5 PM – 11 PM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2555,
    longitude: -97.7480,
  },
  {
    id: "the-den",
    name: "The Den",
    category: "lounge",
    neighborhood: "Downtown",
    vibe: "quiet",
    occupancy: 6,
    capacity: 25,
    description: "Speakeasy-style lounge. Low lights, good whiskey, no rush.",
    tags: ["speakeasy", "whiskey", "intimate", "chill"],
    hours: "7 PM – 1 AM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2695,
    longitude: -97.7505,
  },
  {
    id: "commons",
    name: "The Commons",
    category: "cowork",
    neighborhood: "Midtown",
    vibe: "busy",
    occupancy: 35,
    capacity: 50,
    description: "Open coworking floor with standing desks, pods, and a coffee bar.",
    tags: ["cowork", "wifi", "standing-desks", "coffee"],
    hours: "6 AM – 9 PM",
    memberOnly: false,
    textNumber: "+18777804236",
    latitude: 30.2780,
    longitude: -97.7380,
  },
];

export function getVibeColor(vibe: VibeLevel): string {
  switch (vibe) {
    case "quiet": return "bg-green-400/80";
    case "moderate": return "bg-yellow-400/80";
    case "busy": return "bg-orange";
    case "lit": return "bg-red-400/80";
  }
}

export function getVibeHexColor(vibe: VibeLevel): string {
  switch (vibe) {
    case "quiet": return "#4ade80";
    case "moderate": return "#facc15";
    case "busy": return "#f97316";
    case "lit": return "#f87171";
  }
}

export function getVibeLabel(vibe: VibeLevel): string {
  switch (vibe) {
    case "quiet": return "Quiet";
    case "moderate": return "Moderate";
    case "busy": return "Busy";
    case "lit": return "Lit";
  }
}

export function getOccupancyPercent(venue: Venue): number {
  return Math.round((venue.occupancy / venue.capacity) * 100);
}
