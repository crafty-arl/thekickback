import { NextRequest, NextResponse } from "next/server";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wofvgfhejrvudvfxdytc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const SYSTEM_PROMPT = `You are the theKickBack venue onboarding assistant. Help venue owners set up their venue through natural conversation. Ask ONE question at a time. Keep responses to 1-2 sentences max. Be friendly and efficient.

Steps (follow in order):
1. Venue name
2. Address (full street address + city + state)
3. Type (bar, cafe, restaurant, lounge, cowork, club, other)
4. Max capacity (number)
5. Hours (days and times)
6. Menu highlights (categories and top items)
7. House rules
8. Tagline (one sentence describing the vibe)
9. You generate a 2-3 sentence description and ask if they like it
10. Suggest a theme color based on type (bar=#F97316, cafe=#4ADE80, restaurant=#EF4444, lounge=#8B5CF6) — ask if they want to keep or change
11. Tell them they can upload a hero image from the dashboard later
12. Show a FULL summary of everything and ask: "Does everything look right? Say yes to submit, or tell me what to change."
13. When they confirm, respond with EXACTLY this format on a new line at the end:
    <<<VENUE_DATA>>>{"name":"...","address":"...","type":"...","maxOccupancy":N,"hours":"...","menu":"...","rules":["..."],"tagline":"...","description":"...","themeColor":"#..."}<<<END_DATA>>>

Important:
- ONE question at a time
- Dont sound like a form
- If they want to change something after review, go back to that field
- Only output the <<<VENUE_DATA>>> block when they confirm "yes" at step 12`;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
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
      await createVenueFromAI(venueData);
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
}) {
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

  console.log(`Venue created: ${data.name} (${venueId}) — pending review`);
}
