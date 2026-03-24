"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail, wrap } from "@/lib/email";
import { isSandbox } from "@/lib/stripe";

interface VenueFormData {
  name: string;
  type: string;
  address: string;
  description: string;
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

  let slug = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure slug is unique
  const { data: existing } = await service
    .from("venue_pages")
    .select("slug")
    .eq("slug", slug)
    .limit(1);
  if (existing && existing.length > 0) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 0. Ensure profile exists (FK requirement for venue_owners)
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingProfile) {
    await service.from("profiles").insert({
      id: user.id,
      email: user.email || null,
      phone: user.phone || user.email || user.id,
    });
  }

  // Determine sandbox or live mode
  const sandboxMode = await isSandbox();
  const mode = sandboxMode ? "test" : "live";

  // Delete existing venues for this user IN THIS MODE (allows regeneration)
  const { data: existingOwnerships } = await service
    .from("venue_owners")
    .select("venue_id, venues!inner(mode)")
    .eq("user_id", user.id)
    .eq("venues.mode", mode);

  if (existingOwnerships && existingOwnerships.length > 0) {
    for (const o of existingOwnerships) {
      const { error: delErr } = await service.from("venues").delete().eq("id", o.venue_id);
      if (delErr) console.error("Failed to delete venue", o.venue_id, delErr.message);
    }
  }

  // 1. Create venue
  const { data: venue, error: venueError } = await service
    .from("venues")
    .insert({
      name: formData.name,
      state: "active",
      max_occupancy: formData.maxOccupancy || 100,
      vibe: "quiet",
      type: formData.type || "venue",
      address: formData.address || null,
      neighborhood: neighborhood || null,
      lat,
      lng,
      rules: [],
      mode,
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
    description: formData.description || null,
    theme_color: themeColor,
    published: false,
    review_status: "draft",
    hours: formData.hours ? [{ day: "Daily", open: formData.hours, close: "" }] : [],
    menu_sections: [],
  });

  if (pageError) return { error: `Page: ${pageError.message}` };

  // 4. Generate offerings, XP, milestones, perks via AI
  try {
    const aiResult = await generateVenueSetup(venue.id, service);
    return { ok: true, venueId: venue.id, slug, ai: aiResult };
  } catch (err) {
    console.error("AI setup error:", err);
    return { ok: true, venueId: venue.id, slug, ai: { error: String(err) } };
  }
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

  const { data: xpActions } = await service
    .from("venue_xp_actions")
    .select("label, points")
    .eq("venue_id", venueId)
    .order("sort_order");

  const { data: xpMilestones } = await service
    .from("venue_xp_milestones")
    .select("name, threshold")
    .eq("venue_id", venueId)
    .order("sort_order");

  return {
    hasVenue: true,
    venueId,
    venue,
    page,
    offerings: offerings || [],
    gallery: gallery || [],
    xpActions: xpActions || [],
    xpMilestones: xpMilestones || [],
    checklist: page?.onboarding_checklist || null,
    reviewStatus: page?.review_status,
    stripeConnected: stripeAccount?.charges_enabled || false,
  };
}

export async function submitPlaceForReview() {
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

  if (!ownership) return { error: "No place found" };

  const venueName = (ownership.venues as unknown as { name: string })?.name || "Your place";

  // Update review status to pending
  const { error } = await service
    .from("venue_pages")
    .update({ review_status: "pending" })
    .eq("venue_id", ownership.venue_id);

  if (error) return { error: error.message };

  // Send notification emails
  const adminEmail = "carl@craftthefuture.xyz";
  const ownerEmail = user.email;

  sendEmail(adminEmail, `New place submitted: ${venueName}`, wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">New Place Submitted</h2>
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

// ─── AI auto-generation of offerings, XP, milestones, perks ─────────

const SETUP_PROMPT = `You are an AI that generates complete venue setup data. Given a venue's info, generate offerings, XP actions, milestones, and perks. Return ONLY valid JSON:
{"offerings":[{"type":"product|membership|reservation|service|event|package","name":"...","description":"...","price_cents":500,"recurring":false,"interval":null,"duration_minutes":null,"perks":[],"add_ons":[]}],"xp_actions":[{"action":"visit|first_visit|order|referral|event_attend|review","label":"...","points":50,"description":"...","max_per_day":null}],"xp_milestones":[{"name":"...","threshold":100,"color":"#hex","reward":"...","perks":["..."]}],"perks":[{"name":"...","description":"...","point_cost":100,"category":"drink|food|access|experience|merch|other"}]}
Generate 6-10 offerings, 5 XP actions, 4 milestones (100/300/750/1500), 4-5 perks. Prices in cents. Make everything specific to THIS venue.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateVenueSetup(venueId: string, service: any) {
  const results = { offerings: 0, xpActions: 0, milestones: 0, perks: 0, errors: [] as string[] };

  const { data: venue } = await service.from("venues").select("name, type, address, neighborhood").eq("id", venueId).single();
  const { data: page } = await service.from("venue_pages").select("tagline, description").eq("venue_id", venueId).single();
  if (!venue) { results.errors.push("Venue not found"); return results; }

  const context = [`Venue: ${venue.name}`, `Type: ${venue.type || "venue"}`, venue.address ? `Address: ${venue.address}` : "", page?.tagline ? `Tagline: ${page.tagline}` : "", page?.description ? `Description: ${page.description}` : ""].filter(Boolean).join("\n");

  // Try OpenClaw first, fall back to Cloudflare Workers AI
  let raw = "";
  const clawUrl = process.env.OPENCLAW_GATEWAY_URL;
  const clawToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (clawUrl && clawToken) {
    try {
      const res = await fetch(`${clawUrl}/v1/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${clawToken}`, "Content-Type": "application/json", "x-openclaw-agent-id": "venue-setup" },
        body: JSON.stringify({ model: "openclaw", input: `${SETUP_PROMPT}\n\n${context}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg = data.output?.find((o: { type: string }) => o.type === "message");
        raw = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text || "";
      } else {
        results.errors.push(`OpenClaw: HTTP ${res.status}`);
      }
    } catch (err) {
      results.errors.push(`OpenClaw error: ${err}`);
    }
  }

  // Fallback to Cloudflare Workers AI
  if (!raw) {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!cfToken) {
      results.errors.push("No CLOUDFLARE_API_TOKEN or OPENCLAW configured");
      return results;
    }
    const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", messages: [{ role: "system", content: SETUP_PROMPT }, { role: "user", content: context }] }),
      });
      if (!res.ok) { results.errors.push(`Cloudflare AI: HTTP ${res.status}`); return results; }
      const data = await res.json() as { choices: { message: { content: string } }[] };
      raw = data.choices?.[0]?.message?.content || "";
    } catch (err) {
      results.errors.push(`Cloudflare AI error: ${err}`);
      return results;
    }
  }

  if (!raw) { results.errors.push("AI returned empty response"); return results; }

  let setup;
  try {
    setup = JSON.parse(raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim());
  } catch {
    results.errors.push(`JSON parse failed: ${raw.slice(0, 200)}`);
    return results;
  }

  // Insert offerings
  for (let i = 0; i < (setup.offerings || []).length; i++) {
    const o = setup.offerings[i];
    const { error } = await service.from("venue_offerings").insert({ venue_id: venueId, type: o.type || "product", name: o.name, description: o.description, price_cents: o.price_cents || 0, recurring: o.recurring || false, interval: o.interval, duration_minutes: o.duration_minutes, perks: o.perks || [], add_ons: o.add_ons || [], active: true, sort_order: i });
    if (error) results.errors.push(`offering "${o.name}": ${error.message}`); else results.offerings++;
  }
  for (let i = 0; i < (setup.xp_actions || []).length; i++) {
    const a = setup.xp_actions[i];
    const { error } = await service.from("venue_xp_actions").insert({ venue_id: venueId, action: a.action || "custom", label: a.label, points: a.points || 10, description: a.description, max_per_day: a.max_per_day, sort_order: i });
    if (error) results.errors.push(`xp "${a.label}": ${error.message}`); else results.xpActions++;
  }
  for (let i = 0; i < (setup.xp_milestones || []).length; i++) {
    const m = setup.xp_milestones[i];
    const { error } = await service.from("venue_xp_milestones").insert({ venue_id: venueId, name: m.name, threshold: m.threshold || 100, color: m.color || "#4ade80", reward: m.reward, perks: m.perks || [], sort_order: i });
    if (error) results.errors.push(`milestone "${m.name}": ${error.message}`); else results.milestones++;
  }
  for (let i = 0; i < (setup.perks || []).length; i++) {
    const p = setup.perks[i];
    const { error } = await service.from("venue_perks").insert({ venue_id: venueId, name: p.name, description: p.description, point_cost: p.point_cost || 100, category: p.category || "other", sort_order: i });
    if (error) results.errors.push(`perk "${p.name}": ${error.message}`); else results.perks++;
  }

  return results;
}
