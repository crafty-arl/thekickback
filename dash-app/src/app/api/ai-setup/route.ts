import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

function getService() {
  return createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

const SETUP_PROMPT = `You are an AI that generates complete venue setup data for theKickBack platform. Given a venue's info, generate offerings, XP actions, XP milestones, and perks.

OUTPUT FORMAT — return ONLY valid JSON, no explanation:
{
  "offerings": [
    {"type":"product|membership|reservation|service|event|package","name":"...","description":"...","price_cents":500,"recurring":false,"interval":null,"duration_minutes":null,"perks":[],"add_ons":[]}
  ],
  "xp_actions": [
    {"action":"visit|first_visit|order|referral|event_attend|review|membership|custom","label":"...","points":50,"description":"...","max_per_day":null}
  ],
  "xp_milestones": [
    {"name":"...","threshold":100,"color":"#hex","reward":"...","perks":["..."]}
  ],
  "perks": [
    {"name":"...","description":"...","point_cost":100,"category":"drink|food|access|experience|merch|other"}
  ]
}

RULES:
- Generate 6-10 offerings that match the venue type and menu
- For reservations/services, include duration_minutes
- For memberships, set recurring:true, interval:"month", include perks array
- Prices should be realistic (in cents). A $5 coffee = 500
- Generate 5-6 XP actions with sensible point values (visit:50, first_visit:100, order:25, referral:200, event:75, review:50)
- Generate 4 milestones with escalating thresholds (100, 300, 750, 1500) and creative names that match the venue vibe
- Milestone colors should progress: green → yellow → orange → purple
- Generate 4-6 perks redeemable with points (80-1000 range)
- Perks should match actual offerings (free version of a menu item, priority access, etc.)
- Everything should feel specific to THIS venue, not generic`;

// POST /api/ai-setup — AI generates offerings, XP, milestones, perks for a venue
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { venueId, websiteUrl, menuText, menuPhotoUrl } = await request.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const service = getService();

  // Get venue data
  const { data: venue } = await service
    .from("venues")
    .select("id, name, type, address, neighborhood, max_occupancy, rules")
    .eq("id", venueId)
    .single();

  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  // Get venue page data
  const { data: page } = await service
    .from("venue_pages")
    .select("tagline, description, hours, menu_sections")
    .eq("venue_id", venueId)
    .single();

  // Get existing knowledge
  const { data: knowledge } = await service
    .from("venue_knowledge")
    .select("category, content")
    .eq("venue_id", venueId);

  // Build context for AI
  const venueContext = [
    `Venue: ${venue.name}`,
    `Type: ${venue.type || "venue"}`,
    venue.address ? `Address: ${venue.address}` : "",
    venue.neighborhood ? `Area: ${venue.neighborhood}` : "",
    venue.max_occupancy ? `Capacity: ${venue.max_occupancy}` : "",
    page?.tagline ? `Tagline: "${page.tagline}"` : "",
    page?.description ? `Description: ${page.description}` : "",
    page?.hours?.length ? `Hours: ${JSON.stringify(page.hours)}` : "",
    page?.menu_sections?.length ? `Menu: ${JSON.stringify(page.menu_sections)}` : "",
    knowledge?.length ? `Knowledge:\n${knowledge.map((k) => `[${k.category}] ${k.content}`).join("\n")}` : "",
    menuText ? `\nMenu text provided by owner:\n${menuText}` : "",
    websiteUrl ? `Website: ${websiteUrl}` : "",
    venue.rules?.length ? `House rules: ${venue.rules.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  // Call AI
  const aiRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        messages: [
          { role: "system", content: SETUP_PROMPT },
          { role: "user", content: venueContext },
        ],
      }),
    }
  );

  if (!aiRes.ok) {
    console.error("AI error:", await aiRes.text());
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }

  const aiData = await aiRes.json() as { choices: { message: { content: string } }[] };
  const rawContent = aiData.choices?.[0]?.message?.content || "";

  // Parse JSON from AI response (might be wrapped in markdown code block)
  let setup;
  try {
    const jsonStr = rawContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    setup = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse AI setup:", err, rawContent.slice(0, 500));
    return NextResponse.json({ error: "Failed to parse AI response", raw: rawContent.slice(0, 500) }, { status: 500 });
  }

  // Insert everything into the database
  const results = { offerings: 0, xpActions: 0, milestones: 0, perks: 0, errors: [] as string[] };

  // Offerings
  if (setup.offerings?.length) {
    for (const o of setup.offerings) {
      const { error } = await service.from("venue_offerings").insert({
        venue_id: venueId,
        type: o.type || "product",
        name: o.name,
        description: o.description || null,
        price_cents: o.price_cents || 0,
        recurring: o.recurring || false,
        interval: o.interval || null,
        duration_minutes: o.duration_minutes || null,
        perks: o.perks || [],
        add_ons: o.add_ons || [],
        active: true,
        sort_order: results.offerings,
      });
      if (error) results.errors.push(`offering "${o.name}": ${error.message}`);
      else results.offerings++;
    }
  }

  // XP Actions
  if (setup.xp_actions?.length) {
    for (const a of setup.xp_actions) {
      const { error } = await service.from("venue_xp_actions").insert({
        venue_id: venueId,
        action: a.action || "custom",
        label: a.label,
        points: a.points || 10,
        description: a.description || null,
        max_per_day: a.max_per_day || null,
        sort_order: results.xpActions,
      });
      if (error) results.errors.push(`xp_action "${a.label}": ${error.message}`);
      else results.xpActions++;
    }
  }

  // XP Milestones
  if (setup.xp_milestones?.length) {
    for (const m of setup.xp_milestones) {
      const { error } = await service.from("venue_xp_milestones").insert({
        venue_id: venueId,
        name: m.name,
        threshold: m.threshold || 100,
        color: m.color || "#4ade80",
        reward: m.reward || null,
        perks: m.perks || [],
        sort_order: results.milestones,
      });
      if (error) results.errors.push(`milestone "${m.name}": ${error.message}`);
      else results.milestones++;
    }
  }

  // Perks
  if (setup.perks?.length) {
    for (const p of setup.perks) {
      const { error } = await service.from("venue_perks").insert({
        venue_id: venueId,
        name: p.name,
        description: p.description || null,
        point_cost: p.point_cost || 100,
        category: p.category || "other",
        sort_order: results.perks,
      });
      if (error) results.errors.push(`perk "${p.name}": ${error.message}`);
      else results.perks++;
    }
  }

  return NextResponse.json({
    success: true,
    created: results,
    venue: venue.name,
  });
}
