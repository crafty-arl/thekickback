import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isSandbox } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getSupabase() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Milwaukee, WI center
const MKE_LAT = 43.039;
const MKE_LNG = -87.906;
const FSQ_API_BASE = "https://places-api.foursquare.com";

const VENUE_TEMPLATES: Record<string, { type: string; offerings: { type: string; name: string; description: string; price_cents: number; recurring: boolean; interval?: string; perks?: string[]; duration_minutes?: number }[] }> = {
  cafe: {
    type: "cafe",
    offerings: [
      { type: "product", name: "Drip Coffee", description: "House blend, any size", price_cents: 400, recurring: false },
      { type: "product", name: "Latte", description: "Espresso with steamed milk", price_cents: 550, recurring: false },
      { type: "product", name: "Pastry Box", description: "Pick any 2 pastries", price_cents: 800, recurring: false },
      { type: "membership", name: "Regular", description: "Free drip coffee daily, 10% off everything", price_cents: 2500, recurring: true, interval: "month", perks: ["Free drip coffee daily", "10% off food & drinks"] },
    ],
  },
  bar: {
    type: "bar",
    offerings: [
      { type: "product", name: "House Cocktail", description: "Bartender's choice — changes weekly", price_cents: 1400, recurring: false },
      { type: "product", name: "Beer Flight", description: "4 local taps, 5oz each", price_cents: 1200, recurring: false },
      { type: "reservation", name: "Booth Reservation", description: "Reserved booth, 2-hour hold", price_cents: 5000, recurring: false, duration_minutes: 120 },
      { type: "membership", name: "Bar Member", description: "Skip the line, tab priority", price_cents: 3000, recurring: true, interval: "month", perks: ["Skip the line", "Members-only happy hour"] },
    ],
  },
  restaurant: {
    type: "restaurant",
    offerings: [
      { type: "reservation", name: "Table for 2", description: "Indoor seating, 90-minute window", price_cents: 0, recurring: false, duration_minutes: 90 },
      { type: "reservation", name: "Table for 4-6", description: "Group seating, 2-hour window", price_cents: 0, recurring: false, duration_minutes: 120 },
      { type: "product", name: "Chef's Special", description: "Today's featured dish", price_cents: 2200, recurring: false },
      { type: "membership", name: "Dining Club", description: "Priority reservations, complimentary appetizer", price_cents: 5000, recurring: true, interval: "month", perks: ["Priority reservations", "Complimentary appetizer each visit"] },
    ],
  },
  lounge: {
    type: "lounge",
    offerings: [
      { type: "product", name: "Signature Cocktail", description: "House specialty craft cocktail", price_cents: 1600, recurring: false },
      { type: "reservation", name: "VIP Booth", description: "Premium seating for up to 6", price_cents: 10000, recurring: false, duration_minutes: 180 },
      { type: "membership", name: "VIP Member", description: "Priority access and exclusive events", price_cents: 5000, recurring: true, interval: "month", perks: ["Priority entry", "Exclusive events", "10% off drinks"] },
    ],
  },
  club: {
    type: "club",
    offerings: [
      { type: "product", name: "General Admission", description: "Entry to tonight's event", price_cents: 2000, recurring: false },
      { type: "reservation", name: "VIP Table", description: "Reserved table with bottle service", price_cents: 25000, recurring: false, duration_minutes: 240 },
      { type: "membership", name: "Nightlife Pass", description: "Skip the line, guest list for all events", price_cents: 7500, recurring: true, interval: "month", perks: ["Guest list access", "Skip the line", "1 free entry per week"] },
    ],
  },
};

interface FsqPlace {
  fsq_id: string;
  name: string;
  location?: { address?: string; locality?: string; region?: string; postcode?: string; formatted_address?: string };
  geocodes?: { main?: { latitude: number; longitude: number } };
  categories?: { name: string }[];
}

function mapCategory(categories?: { name: string }[]): string {
  if (!categories?.length) return "bar";
  const name = categories[0].name.toLowerCase();
  if (name.includes("coffee") || name.includes("cafe") || name.includes("tea") || name.includes("bakery")) return "cafe";
  if (name.includes("bar") || name.includes("pub") || name.includes("brewery") || name.includes("taproom")) return "bar";
  if (name.includes("restaurant") || name.includes("dining") || name.includes("grill") || name.includes("bistro")) return "restaurant";
  if (name.includes("lounge") || name.includes("cocktail")) return "lounge";
  if (name.includes("club") || name.includes("nightlife") || name.includes("dance")) return "club";
  return "bar";
}

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const VIBES = ["quiet", "moderate", "busy", "packed"];
const THEME_COLORS = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#EC4899", "#F59E0B", "#06B6D4"];
const FIRST_NAMES = ["Alex", "Jamie", "Morgan", "Casey", "Taylor", "Jordan", "Sam", "Riley", "Avery", "Quinn"];
const LAST_NAMES = ["Rivera", "Chen", "Johnson", "Williams", "Brown", "Kim", "Singh", "Garcia", "Lopez", "Lee"];
const CHAT_MSGS = [
  "What time does happy hour start?",
  "Do you have any gluten-free options?",
  "Is there live music tonight?",
  "Can I bring my dog?",
  "What's the Wi-Fi password?",
  "Do you take reservations for groups?",
  "What's the parking situation?",
  "Any specials today?",
  "Is there a dress code?",
  "How late are you open tonight?",
];
const AI_RESPONSES = [
  "Happy hour is 4-6 PM every weekday! Half off wells and drafts.",
  "Yes! We have several gluten-free items marked on our menu.",
  "We have live music every Friday and Saturday starting at 9 PM.",
  "Well-behaved dogs are welcome on our patio!",
  "Ask your server for the Wi-Fi password — it changes weekly.",
  "For groups of 6+, we recommend booking through our reservations tab.",
  "There's a parking lot behind the building, and street parking is free after 6 PM.",
  "Today's special is our Chef's seasonal creation — ask your server for details!",
  "Smart casual is the vibe here — no dress code, just come as you are.",
  "We're open until midnight tonight!",
];

async function fetchFsqPlaces(query: string, token: string): Promise<FsqPlace[]> {
  try {
    const params = new URLSearchParams({
      query,
      ll: `${MKE_LAT},${MKE_LNG}`,
      radius: "8000",
      limit: "10",
      sort: "POPULARITY",
      fields: "fsq_id,name,location,geocodes,categories",
    });
    const res = await fetch(`${FSQ_API_BASE}/v3/places/search?${params}`, {
      headers: { Authorization: token, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// POST /api/seed-demo — seed Milwaukee demo venues + activity
export async function POST() {
  const sandbox = await isSandbox();
  if (!sandbox) {
    return NextResponse.json({ error: "Seed demo is only available in sandbox mode" }, { status: 403 });
  }

  const supabase = getSupabase();

  const fsqToken = process.env.FOURSQUARE_SERVICE_TOKEN;
  if (!fsqToken) {
    return NextResponse.json({ error: "Foursquare API token not configured" }, { status: 503 });
  }

  // Check for existing seeded venues (idempotency)
  const { count } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("seeded", true);

  if ((count || 0) > 0) {
    return NextResponse.json({ error: "Demo data already seeded. Delete existing seeded venues first.", existing: count }, { status: 409 });
  }

  // Fetch venues from Foursquare
  const queries = ["bar", "cafe", "restaurant", "lounge", "nightclub"];
  const allPlaces: FsqPlace[] = [];
  const seen = new Set<string>();

  const results = await Promise.all(queries.map((q) => fetchFsqPlaces(q, fsqToken)));
  for (const places of results) {
    for (const p of places) {
      if (!seen.has(p.fsq_id)) {
        seen.add(p.fsq_id);
        allPlaces.push(p);
      }
    }
  }

  if (allPlaces.length === 0) {
    return NextResponse.json({ error: "No venues found from Foursquare" }, { status: 502 });
  }

  // Take up to 30, first 10 will be claimed
  const venues = allPlaces.slice(0, 30);
  const claimedCount = Math.min(10, venues.length);

  const seededVenueIds: string[] = [];
  const claimedVenueIds: string[] = [];

  for (let i = 0; i < venues.length; i++) {
    const p = venues[i];
    const isClaimed = i < claimedCount;
    const cat = mapCategory(p.categories);
    const slug = makeSlug(p.name) + "-mke";
    const lat = p.geocodes?.main?.latitude || MKE_LAT;
    const lng = p.geocodes?.main?.longitude || MKE_LNG;
    const addr = p.location?.formatted_address || p.location?.address || "Milwaukee, WI";

    const venueData: Record<string, unknown> = {
      name: p.name,
      slug,
      type: cat,
      state: "active",
      latitude: lat,
      longitude: lng,
      address: addr,
      neighborhood: p.location?.locality || "Milwaukee",
      vibe: VIBES[Math.floor(Math.random() * VIBES.length)],
      max_occupancy: 50 + Math.floor(Math.random() * 150),
      claimed: isClaimed,
      seeded: true,
      fsq_place_id: p.fsq_id,
    };

    const { data: newVenue, error } = await supabase
      .from("venues")
      .insert(venueData)
      .select("id")
      .single();

    if (error) {
      console.error(`Seed: failed to insert venue "${p.name}":`, error.message);
      continue;
    }

    seededVenueIds.push(newVenue.id);

    if (isClaimed) {
      claimedVenueIds.push(newVenue.id);

      // Create venue page
      const theme = THEME_COLORS[i % THEME_COLORS.length];
      await supabase.from("venue_pages").insert({
        venue_id: newVenue.id,
        slug,
        tagline: `Welcome to ${p.name}`,
        description: `${p.name} is a popular ${cat} in Milwaukee's ${p.location?.locality || "downtown"} neighborhood.`,
        theme_color: theme,
        hours: [
          { day: "Monday", open: "11:00 AM", close: "10:00 PM" },
          { day: "Tuesday", open: "11:00 AM", close: "10:00 PM" },
          { day: "Wednesday", open: "11:00 AM", close: "11:00 PM" },
          { day: "Thursday", open: "11:00 AM", close: "11:00 PM" },
          { day: "Friday", open: "11:00 AM", close: "12:00 AM" },
          { day: "Saturday", open: "10:00 AM", close: "12:00 AM" },
          { day: "Sunday", open: "10:00 AM", close: "9:00 PM" },
        ],
        menu_sections: [],
      });

      // Add offerings from template
      const template = VENUE_TEMPLATES[cat] || VENUE_TEMPLATES.bar;
      for (const o of template.offerings) {
        await supabase.from("venue_offerings").insert({
          venue_id: newVenue.id,
          type: o.type,
          name: o.name,
          description: o.description,
          price_cents: o.price_cents,
          recurring: o.recurring,
          interval: o.interval || null,
          perks: o.perks || [],
          duration_minutes: o.duration_minutes || null,
          active: true,
        });
      }

      // Add fake staff
      const staffCount = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < staffCount; s++) {
        const fname = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const lname = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        await supabase.from("venue_staff").insert({
          venue_id: newVenue.id,
          name: `${fname} ${lname}`,
          role: s === 0 ? "Manager" : ["Server", "Bartender", "Host", "Barista"][Math.floor(Math.random() * 4)],
          visible: true,
        });
      }

      // Add AI knowledge
      await supabase.from("venue_knowledge").insert({
        venue_id: newVenue.id,
        category: "general",
        content: `${p.name} is a ${cat} located at ${addr}. We're known for our welcoming atmosphere and quality service. This is a demo venue seeded for testing.`,
      });

      // Enable ghost AI
      await supabase.from("venues").update({ ghost_enabled: true }).eq("id", newVenue.id);
    }
  }

  // ─── Seed fake guest activity for claimed venues ─────────────────
  for (const venueId of claimedVenueIds) {
    // Fake chat messages
    const msgCount = 5 + Math.floor(Math.random() * 10);
    for (let m = 0; m < msgCount; m++) {
      const isGuest = m % 2 === 0;
      const body = isGuest
        ? CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)]
        : AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
      const hoursAgo = Math.floor(Math.random() * 72);
      const createdAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();

      await supabase.from("chat_messages").insert({
        venue_id: venueId,
        sender_phone: isGuest ? `+1414555${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}` : null,
        sender_type: isGuest ? "guest" : "ai",
        body,
        created_at: createdAt,
      });
    }

    // Fake bookings (test mode)
    const bookingCount = 2 + Math.floor(Math.random() * 4);
    for (let b = 0; b < bookingCount; b++) {
      const daysAhead = Math.floor(Math.random() * 14) - 3;
      const hour = 11 + Math.floor(Math.random() * 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + daysAhead);
      startDate.setHours(hour, 0, 0, 0);

      const fname = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lname = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

      await supabase.from("venue_bookings").insert({
        venue_id: venueId,
        offering_name: ["Table for 2", "Booth Reservation", "VIP Table", "Meeting Room"][Math.floor(Math.random() * 4)],
        guest_name: `${fname} ${lname}`,
        guest_email: `${fname.toLowerCase()}.${lname.toLowerCase()}@example.com`,
        cal_status: "confirmed",
        starts_at: startDate.toISOString(),
        ends_at: new Date(startDate.getTime() + 90 * 60000).toISOString(),
        duration_minutes: 90,
        mode: "test",
      });
    }

    // Fake wallet transactions (test mode)
    const txCount = 3 + Math.floor(Math.random() * 5);
    for (let t = 0; t < txCount; t++) {
      const hoursAgo = Math.floor(Math.random() * 168);
      const createdAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();
      const amountCents = [500, 1000, 1500, 2000, 2500, 3500, 5000][Math.floor(Math.random() * 7)];

      await supabase.from("wallet_transactions").insert({
        user_id: "00000000-0000-0000-0000-000000000000", // placeholder
        amount_cents: amountCents,
        description: ["Added funds", "Booth Reservation", "2x Latte", "VIP Table", "Beer Flight"][Math.floor(Math.random() * 5)],
        status: "completed",
        venue_id: venueId,
        mode: "test",
        created_at: createdAt,
      });
    }

    // Fake orders (test mode)
    const orderCount = 2 + Math.floor(Math.random() * 3);
    for (let o = 0; o < orderCount; o++) {
      const hoursAgo = Math.floor(Math.random() * 72);
      const createdAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();
      const totalCents = [1200, 2500, 3800, 5500, 8000][Math.floor(Math.random() * 5)];

      const { data: order } = await supabase.from("orders").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        venue_id: venueId,
        total_cents: totalCents,
        status: "completed",
        mode: "test",
        created_at: createdAt,
      }).select("id").single();

      if (order) {
        await supabase.from("order_items").insert({
          order_id: order.id,
          name: ["House Cocktail", "Drip Coffee", "Beer Flight", "Chef's Special", "Pastry Box"][Math.floor(Math.random() * 5)],
          quantity: 1 + Math.floor(Math.random() * 3),
          unit_price_cents: totalCents,
          mode: "test",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    seeded: seededVenueIds.length,
    claimed: claimedVenueIds.length,
    unclaimed: seededVenueIds.length - claimedVenueIds.length,
  });
}
