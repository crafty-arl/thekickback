"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface VenueFormData {
  name: string;
  type: string;
  address: string;
  maxOccupancy: number;
  hours: string;
  tagline: string;
}

export async function createVenue(formData: VenueFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Geocode address
  let lat = null;
  let lng = null;
  let neighborhood = "";
  if (formData.address) {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.address)}&format=json&limit=1`,
        { headers: { "User-Agent": "theKickBack/1.0" } }
      );
      if (geoRes.ok) {
        const geo = await geoRes.json() as { lat: string; lon: string; display_name: string }[];
        if (geo.length > 0) {
          lat = parseFloat(geo[0].lat);
          lng = parseFloat(geo[0].lon);
          const parts = geo[0].display_name.split(",");
          neighborhood = parts.length > 1 ? parts[1].trim() : "";
        }
      }
    } catch { /* geocoding is best-effort */ }
  }

  // Theme color based on type
  const themeColors: Record<string, string> = {
    bar: "#F97316", club: "#F97316",
    cafe: "#4ADE80", coworking: "#4ADE80",
    restaurant: "#EF4444",
    lounge: "#8B5CF6",
  };
  const themeColor = themeColors[formData.type] || "#F97316";

  // Create venue
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .insert({
      name: formData.name,
      state: "active",
      occupancy: 0,
      max_occupancy: formData.maxOccupancy || 100,
      vibe: "quiet",
      type: formData.type || "venue",
      address: formData.address || null,
      neighborhood: neighborhood || null,
      lat,
      lng,
      rules: [],
    })
    .select("id")
    .single();

  if (venueError) return { error: venueError.message };

  // Link user as owner
  await supabase.from("venue_owners").insert({
    user_id: user.id,
    venue_id: venue.id,
    role: "owner",
  });

  // Create venue page
  const slug = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await supabase.from("venue_pages").insert({
    venue_id: venue.id,
    slug,
    tagline: formData.tagline || null,
    description: null,
    theme_color: themeColor,
    published: false,
    review_status: "pending",
    hours: formData.hours ? [{ day: "Daily", open: formData.hours, close: "" }] : [],
    menu_sections: [],
  });

  redirect("/");
}
