import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wofvgfhejrvudvfxdytc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const SYSTEM_PROMPT = `You are the theKickBack venue onboarding assistant. Get a venue set up in 3-4 messages MAX. Be fast, casual, extract as much as possible from each response. Never sound like a form.

Flow (3 exchanges then done):

EXCHANGE 1: "Tell me about your spot — name, what kind of place, and where it is."
→ Extract: name, type, address. If they give more (hours, capacity) take it all.

EXCHANGE 2: "Nice! A few quick details — hours, capacity, and what you serve?"
→ Extract: hours, max_occupancy, menu highlights. If they mention rules take those too. Skip anything they already told you.

EXCHANGE 3: "Last one — describe the vibe in a sentence."
→ Extract: tagline. YOU auto-generate: description (2 sentences), theme color (bar/club=#F97316, cafe/cowork=#4ADE80, restaurant=#EF4444, lounge=#8B5CF6), slug, and set rules to [] if not mentioned.

Then IMMEDIATELY show a quick summary and ask "Look good?" Do NOT ask extra questions. Fill in sensible defaults for anything missing.

When they confirm, output EXACTLY this on a new line:
<<<VENUE_DATA>>>{"name":"...","address":"...","type":"...","maxOccupancy":N,"hours":"...","menu":"...","rules":["..."],"tagline":"...","description":"...","themeColor":"#..."}<<<END_DATA>>>

Rules:
- NEVER more than 4 total exchanges before showing the summary
- Extract MULTIPLE fields from every response — people talk naturally, dont force structure
- If they dump everything in one message, go straight to summary
- Keep every response under 3 sentences
- If something is missing, pick a reasonable default rather than asking
- Only output <<<VENUE_DATA>>> after they confirm the summary`;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const body = await request.json() as { messages: { role: "user" | "assistant"; content: string }[] };

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...body.messages,
  ];

  // Call Workers AI
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
        messages,
      }),
    }
  );

  if (!aiRes.ok) {
    const err = await aiRes.text();
    console.error("Workers AI error:", err);
    return NextResponse.json({ reply: "Something went wrong. Try again." }, { status: 500 });
  }

  const aiData = await aiRes.json() as {
    choices: { message: { content: string } }[];
  };

  const reply = aiData.choices?.[0]?.message?.content || "I didn't catch that. Try again.";

  // Check if the reply contains venue data (submission step)
  const dataMatch = reply.match(/<<<VENUE_DATA>>>([\s\S]*?)<<<END_DATA>>>/);
  let venueCreated = false;

  if (dataMatch) {
    try {
      const venueData = JSON.parse(dataMatch[1]);
      await createVenueFromAI(venueData, userId);
      venueCreated = true;
    } catch (err) {
      console.error("Failed to parse/create venue:", err);
    }
  }

  // Clean the reply — remove the data block from what the user sees
  const cleanReply = reply.replace(/<<<VENUE_DATA>>>[\s\S]*?<<<END_DATA>>>/, "").trim();

  return NextResponse.json({ reply: cleanReply, venueCreated });
}

async function createVenueFromAI(data: {
  name: string;
  address: string;
  type: string;
  maxOccupancy: number;
  hours: string;
  menu: string;
  rules: string[];
  tagline: string;
  description: string;
  themeColor: string;
}, userId?: string) {
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Geocode address
  let lat = null;
  let lng = null;
  let neighborhood = "";
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.address)}&format=json&limit=1`,
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
  } catch (err) {
    console.error("Geocoding error:", err);
  }

  // Create venue
  const venueRes = await fetch(`${SUPABASE_URL}/rest/v1/venues`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: data.name,
      state: "active",
      occupancy: 0,
      max_occupancy: data.maxOccupancy || 100,
      vibe: "quiet",
      type: data.type,
      address: data.address,
      neighborhood,
      lat,
      lng,
      rules: data.rules || [],
    }),
  });

  if (!venueRes.ok) {
    console.error("Venue create error:", await venueRes.text());
    return;
  }

  const venues = await venueRes.json() as { id: string }[];
  const venueId = venues[0]?.id;
  if (!venueId) return;

  // Parse hours into structured format
  const hours = [{ day: "See venue", open: data.hours, close: "" }];

  // Parse menu into sections
  const menuSections = [{ name: "Highlights", items: data.menu.split(",").map((i: string) => i.trim()) }];

  // Create venue page
  await fetch(`${SUPABASE_URL}/rest/v1/venue_pages`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      venue_id: venueId,
      slug,
      tagline: data.tagline,
      description: data.description,
      theme_color: data.themeColor || "#F97316",
      hours,
      menu_sections: menuSections,
      published: false,
      review_status: "pending",
    }),
  });

  // Link the authenticated user as venue owner
  if (userId) {
    await fetch(`${SUPABASE_URL}/rest/v1/venue_owners`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        venue_id: venueId,
        role: "owner",
      }),
    });
  }

  console.log(`Venue created: ${data.name} (${venueId}) — owner: ${userId || "anonymous"} — pending review`);
}
