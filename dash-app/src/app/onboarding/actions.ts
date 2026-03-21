"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

  // Send notification emails via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const from = "theKickBack <hub@thekickback.net>";
    const adminEmail = "carl@craftthefuture.xyz";
    const ownerEmail = user.email;

    const sendEmail = (to: string, subject: string, html: string) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html }),
      }).catch((err) => console.error(`Email to ${to} failed:`, err));

    // Email to admin
    sendEmail(adminEmail, `New hub submitted for review: ${venueName}`,
      `<h2>New Hub Submission</h2>
<p><strong>${venueName}</strong> was submitted for review by ${ownerEmail}.</p>
<p><a href="https://dash.thekickback.net/root">Review in admin dashboard</a></p>`);

    // Email to owner
    if (ownerEmail) {
      sendEmail(ownerEmail, `${venueName} is under review`,
        `<h2>Your hub is under review</h2>
<p>We received your submission for <strong>${venueName}</strong> and it's now being reviewed.</p>
<p>You'll receive an email once it's approved. In the meantime, you can continue editing your hub from the <a href="https://dash.thekickback.net">dashboard</a>.</p>
<p style="color:#666;">— theKickBack team</p>`);
    }
  } else {
    console.log("RESEND_API_KEY not set — skipping review emails");
  }

  return { ok: true };
}
