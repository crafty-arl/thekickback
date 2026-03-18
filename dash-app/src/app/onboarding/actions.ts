"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface VenueFormData {
  name: string;
  category: string;
  address: string;
  neighborhood: string;
  maxOccupancy: number;
  openTime: string;
  closeTime: string;
  tagline: string;
  description: string;
  vibe: string;
}

export async function createVenue(formData: VenueFormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Create the venue
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .insert({
      name: formData.name,
      state: "active",
      occupancy: 0,
      max_occupancy: formData.maxOccupancy || 100,
      vibe: mapVibe(formData.vibe),
      rules: [],
    })
    .select("id")
    .single();

  if (venueError) {
    return { error: venueError.message };
  }

  // Link the user as owner
  const { error: ownerError } = await supabase.from("venue_owners").insert({
    user_id: user.id,
    venue_id: venue.id,
    role: "owner",
  });

  if (ownerError) {
    return { error: ownerError.message };
  }

  // Create a venue page with defaults
  const slug = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await supabase.from("venue_pages").insert({
    venue_id: venue.id,
    slug,
    tagline: formData.tagline || null,
    description: formData.description || null,
    theme_color: "#F97316",
    published: false,
    hours:
      formData.openTime && formData.closeTime
        ? [
            {
              day: "Mon-Sun",
              open: formData.openTime,
              close: formData.closeTime,
            },
          ]
        : [],
  });

  redirect("/");
}

function mapVibe(vibe: string): string {
  const vibeMap: Record<string, string> = {
    chill: "quiet",
    energetic: "busy",
    upscale: "moderate",
    casual: "quiet",
    creative: "moderate",
  };
  return vibeMap[vibe] || "quiet";
}
