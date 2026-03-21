"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { sendEmail, wrap } from "@/lib/email";

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

  // Use service client to bypass RLS for venue creation
  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

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
    barbershop: "#F59E0B",
    nail_salon: "#EC4899",
  };
  const themeColor = themeColors[formData.type] || "#F97316";

  const slug = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // 1. Create venue
  const { data: venue, error: venueError } = await service
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

  if (venueError) return { error: `Venue: ${venueError.message}` };

  // 2. Link user as owner
  const { error: ownerError } = await service.from("venue_owners").insert({
    user_id: user.id,
    venue_id: venue.id,
    role: "owner",
  });

  if (ownerError) return { error: `Owner: ${ownerError.message}` };

  // 3. Create venue page
  const { error: pageError } = await service.from("venue_pages").insert({
    venue_id: venue.id,
    slug,
    tagline: formData.tagline || null,
    description: null,
    theme_color: themeColor,
    published: false,
    review_status: "draft",
    hours: formData.hours ? [{ day: "Daily", open: formData.hours, close: "" }] : [],
    menu_sections: [],
  });

  if (pageError) return { error: `Page: ${pageError.message}` };

  redirect("/");
}

export async function getOnboardingState() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) return { hasVenue: false };

  const venueId = ownership.venue_id;

  const { data: venue } = await service
    .from("venues")
    .select("id, name, type, address, neighborhood, max_occupancy")
    .eq("id", venueId)
    .single();

  const { data: page } = await service
    .from("venue_pages")
    .select("slug, tagline, description, theme_color, hours, review_status, onboarding_checklist, hero_image")
    .eq("venue_id", venueId)
    .single();

  const { data: offerings } = await service
    .from("venue_offerings")
    .select("id, name, type, price_cents, description")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order");

  const { data: gallery } = await service
    .from("venue_gallery")
    .select("id, image_url, caption")
    .eq("venue_id", venueId)
    .order("sort_order");

  const { data: stripeAccount } = await service
    .from("venue_stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("venue_id", venueId)
    .single();

  return {
    hasVenue: true,
    venueId,
    venue,
    page,
    offerings: offerings || [],
    gallery: gallery || [],
    checklist: page?.onboarding_checklist || null,
    reviewStatus: page?.review_status,
    stripeConnected: stripeAccount?.charges_enabled || false,
  };
}

export async function submitHubForReview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Find the user's venue
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, venues(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) return { error: "No hub found" };

  const venueName = (ownership.venues as unknown as { name: string })?.name || "Your hub";

  // Update review status to pending
  const { error } = await service
    .from("venue_pages")
    .update({ review_status: "pending" })
    .eq("venue_id", ownership.venue_id);

  if (error) return { error: error.message };

  // Send notification emails
  const adminEmail = "carl@craftthefuture.xyz";
  const ownerEmail = user.email;

  sendEmail(adminEmail, `New hub submitted: ${venueName}`, wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">New Hub Submission</h2>
    <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.5;">
      <strong style="color:#fff;">${venueName}</strong> was submitted for review by ${ownerEmail}.
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="https://dash.thekickback.net/root" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">Review Now</a>
    </div>
  `));

  if (ownerEmail) {
    sendEmail(ownerEmail, `${venueName} is under review`, wrap(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;margin-bottom:8px;">&#128065;</div>
        <h1 style="margin:0;font-size:24px;color:#fff;">We're on it.</h1>
      </div>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.5;">
        <strong style="color:#fff;">${venueName}</strong> is now under review. You'll get an email as soon as it's approved.
      </p>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;">
        In the meantime, keep editing from your <a href="https://dash.thekickback.net" style="color:#F97316;text-decoration:none;">dashboard</a>.
      </p>
    `));
  }

  return { ok: true };
}
