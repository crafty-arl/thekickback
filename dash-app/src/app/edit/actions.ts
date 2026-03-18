"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const service = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function updateVenue(venueId: string, data: {
  name?: string;
  type?: string;
  address?: string;
  neighborhood?: string;
  max_occupancy?: number;
  vibe?: string;
  rules?: string[];
  lat?: number | null;
  lng?: number | null;
}) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: owner } = await service
    .from("venue_owners")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  if (!owner) return { error: "Not authorized" };

  // Geocode if address changed
  if (data.address) {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.address)}&format=json&limit=1`,
        { headers: { "User-Agent": "theKickBack/1.0" } }
      );
      if (geoRes.ok) {
        const geo = await geoRes.json() as { lat: string; lon: string; display_name: string }[];
        if (geo.length > 0) {
          data.lat = parseFloat(geo[0].lat);
          data.lng = parseFloat(geo[0].lon);
          const parts = geo[0].display_name.split(",");
          data.neighborhood = parts.length > 1 ? parts[1].trim() : data.neighborhood;
        }
      }
    } catch { /* best effort */ }
  }

  const { error } = await service.from("venues").update(data).eq("id", venueId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/edit");
  return { ok: true };
}

export async function updateVenuePage(venueId: string, data: {
  tagline?: string;
  description?: string;
  theme_color?: string;
  hours?: { day: string; open: string; close: string }[];
  menu_sections?: { name: string; items: string[] }[];
  slug?: string;
}) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: owner } = await service
    .from("venue_owners")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  if (!owner) return { error: "Not authorized" };

  const { error } = await service.from("venue_pages").update(data).eq("venue_id", venueId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/edit");
  return { ok: true };
}
