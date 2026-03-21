import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiConfig } from "@/lib/ai-config";
import { sendEmail, wrap } from "@/lib/email";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wofvgfhejrvudvfxdytc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const SYSTEM_PROMPT = `You are the theKickBack hub setup assistant. Get a hub set up in 3-4 messages MAX. Be fast, casual, extract as much as possible from each response. Never sound like a form.

Flow (3 exchanges then done):

EXCHANGE 1: "Tell me about your hub — what's it called and what kind of place is it?"
→ Extract: name, type. If they give more (address, hours, capacity) take it all.
→ After getting name and type, determine locationMode using the rules below.

LOCATION MODE DETECTION:
- If the type is clearly physical (bar, restaurant, cafe, barbershop, nail_salon, coworking, lounge, club): set locationMode to "fixed"
- If the type is event/community-based (touring artist, running club, book club, community org, league, creator, musician, popup): ask "Do you have a permanent location, or do you mostly host events at different spots?"
- Based on the answer, set locationMode:
  - "fixed" = permanent address (ask for it)
  - "mobile" = moves around (address optional, ask about their next event location instead)
  - "virtual" = no physical location (skip address, ask about their first event)
- For "fixed" locationMode, ask for address if not already provided.
- For "mobile" locationMode, address is optional — ask "Where's your next event?" instead.
- For "virtual" locationMode, skip address entirely — ask about their first event or community details.

EXCHANGE 2: "Nice! A few quick details — hours, capacity, and what you serve?"
→ Extract: hours, max_occupancy, menu highlights. If they mention rules take those too. Skip anything they already told you.
→ For mobile/virtual hubs, ask about event schedule instead of fixed hours.

EXCHANGE 3: "Last one — describe the vibe in a sentence."
→ Extract: tagline. YOU auto-generate: description (2 sentences), theme color (bar/club=#F97316, cafe/cowork=#4ADE80, restaurant=#EF4444, lounge=#8B5CF6), slug, and set rules to [] if not mentioned.

Then IMMEDIATELY show a quick summary and ask "Look good?" Do NOT ask extra questions. Fill in sensible defaults for anything missing.

IMPORTANT — after EVERY response (including exchange 1, 2, 3, and the summary), append a partial data block on a new line with all fields extracted so far. Use this exact format:
<<<HUB_PARTIAL>>>{"name":"...","type":"...","locationMode":"fixed|mobile|virtual","address":"...","tagline":"...","description":"...","themeColor":"#...","hours":"...","maxOccupancy":N,"menu":"...","rules":[],"slug":"...","offerings":[]}<<<END_PARTIAL>>>
Only include fields you have extracted so far. For slug, auto-generate from the name (lowercase, hyphens). For themeColor, pick based on type (bar/club=#F97316, cafe/cowork=#4ADE80, restaurant=#EF4444, lounge=#8B5CF6, barbershop=#F59E0B, nail_salon=#EC4899). Leave unknown fields as empty strings, 0, or []. For locationMode, default to "fixed" if clearly a physical venue.

When they confirm the summary, output EXACTLY this on a new line (IN ADDITION to the partial block):
<<<VENUE_DATA>>>{"name":"...","address":"...","type":"...","locationMode":"fixed|mobile|virtual","maxOccupancy":N,"hours":"...","menu":"...","rules":["..."],"tagline":"...","description":"...","themeColor":"#..."}<<<END_DATA>>>

Rules:
- NEVER more than 4 total exchanges before showing the summary
- Extract MULTIPLE fields from every response — people talk naturally, dont force structure
- If they dump everything in one message, go straight to summary
- Keep every response under 3 sentences
- If something is missing, pick a reasonable default rather than asking
- Only output <<<VENUE_DATA>>> after they confirm the summary
- ALWAYS output <<<HUB_PARTIAL>>> after every response
- ALWAYS output smart reply suggestions after every response using this format:
<<<REPLIES>>>["suggestion 1","suggestion 2","suggestion 3"]<<<END_REPLIES>>>
Generate 3-4 contextual reply suggestions that would naturally move the conversation forward. Make them specific and realistic — full sentences the user can tap to send as their response. Examples:
  - For exchange 1: "It's a cocktail bar called Neon on 6th St in Austin", "We're a barbershop in Brooklyn called Fresh Fades"
  - For exchange 2: "Open 5pm to midnight, fits about 80, craft cocktails and local beer", "9 to 7 weekdays, we do cuts fades and beard trims"
  - For exchange 3: "Late nights and good company", "Where the neighborhood comes to unwind"
  - For summary confirmation: "Looks good, let's go!", "Change the hours to 4pm-2am", "Update the tagline"
Make them feel like real answers a real owner would give. Vary them based on the venue type if known.`;

function buildChecklistPrompt(currentItem: string | null, checklist: Record<string, boolean>, locationMode?: string) {
  const completed = Object.entries(checklist).filter(([, v]) => v).map(([k]) => k);
  const remaining = Object.entries(checklist).filter(([, v]) => !v).map(([k]) => k);

  const locationContext = locationMode === "mobile"
    ? `\nThis hub is mobile (moves around / hosts events at different spots). The "location" item is auto-completed — no fixed address needed. For "offerings", mention that each event can have its own location.`
    : locationMode === "virtual"
    ? `\nThis hub is virtual (no physical location). The "location" item is auto-completed — no address needed. For "offerings", mention that each event can have its own location.`
    : "";

  return `You are guiding a venue owner through their setup checklist. They already created their hub. Now walk them through each remaining item.

Current item: ${currentItem || "none"}
Completed: ${completed.join(", ") || "none"}
Remaining: ${remaining.join(", ") || "none"}${locationContext}

For each item, explain it briefly (1-2 sentences) and help them complete it. Be casual and encouraging.

When a checklist item is completed through your conversation, output:
<<<CHECKLIST_UPDATE>>>{"item":"${currentItem}","completed":true}<<<END_UPDATE>>>

Item descriptions:
- basics: Hub name and type
- location: ${locationMode === "mobile" ? "Your hub doesn't need a fixed address — you're mobile! Already complete." : locationMode === "virtual" ? "Your hub doesn't need a fixed address — it's virtual! Already complete." : "Address confirmation"}
- hours: ${locationMode === "mobile" || locationMode === "virtual" ? "Event schedule or typical timing" : "Operating hours"}
- branding: Tagline, description, and theme color
- offerings: Review auto-generated offerings${locationMode === "mobile" || locationMode === "virtual" ? " — each event can have its own location" : ""}
- knowledge: AI knowledge base — what should the AI know about this spot?
- photos: Upload at least one photo
- xp: Review loyalty/XP program
- stripe: Tell them to tap the Connect Stripe button below

For "knowledge", ask them to share insider tips, signature items, parking info, dress code, etc. When they share info, mark it complete.
For "offerings" and "xp", ask if the auto-generated items look good. If they say yes, mark complete.
For "stripe", tell them to tap the Connect Stripe button — you can't do it for them.

Keep it encouraging. Celebrate progress. Keep responses under 3 sentences.

ALWAYS output smart reply suggestions:
<<<REPLIES>>>["suggestion 1","suggestion 2"]<<<END_REPLIES>>>`;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const body = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    phase?: "chat" | "checklist";
    currentItem?: string | null;
    checklist?: Record<string, boolean>;
    locationMode?: string;
  };

  const isChecklist = body.phase === "checklist";
  const systemPrompt = isChecklist
    ? buildChecklistPrompt(body.currentItem || null, body.checklist || {}, body.locationMode)
    : SYSTEM_PROMPT;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...body.messages,
  ];

  // For Phase 1 exchange 1, try OSM search to pre-fill data
  let osmContext = "";
  if (!isChecklist && body.messages.length === 1) {
    try {
      const userMsg = body.messages[0].content;
      // Extract name + city heuristically
      const parts = userMsg.match(/called\s+(.+?)(?:\s+(?:in|on|at)\s+(.+))?$/i)
        || userMsg.match(/(.+?)(?:\s+(?:in|on|at)\s+(.+))$/i);
      if (parts && parts[2]) {
        const searchRes = await fetch(new URL("/api/onboarding/search", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: parts[1].trim(), city: parts[2].trim() }),
        });
        if (searchRes.ok) {
          const osmData = await searchRes.json();
          if (osmData.found) {
            osmContext = `\n\nI found this venue on OpenStreetMap — use this data if it matches what the owner described:
Address: ${osmData.address}
Coordinates: ${osmData.lat}, ${osmData.lng}
${osmData.hours ? `Hours: ${osmData.hours}` : ""}
${osmData.type ? `Type: ${osmData.type}` : ""}
${osmData.neighborhood ? `Neighborhood: ${osmData.neighborhood}` : ""}
Include this info in your <<<HUB_PARTIAL>>> block. Confirm the address with the owner naturally.`;
            messages[0].content += osmContext;
          }
        }
      }
    } catch {
      // OSM search is best effort
    }
  }

  const aiModelConfig = await getAiConfig();

  const aiRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModelConfig.onboarding_model,
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

  // Check for venue creation (Phase 1)
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

  // Extract partial hub data
  let hubData = null;
  const partialMatch = reply.match(/<<<HUB_PARTIAL>>>([\s\S]*?)<<<END_PARTIAL>>>/);
  if (partialMatch) {
    try { hubData = JSON.parse(partialMatch[1]); } catch { /* best effort */ }
  }

  // Extract smart replies
  let smartReplies: string[] = [];
  const repliesMatch = reply.match(/<<<REPLIES>>>([\s\S]*?)<<<END_REPLIES>>>/);
  if (repliesMatch) {
    try { smartReplies = JSON.parse(repliesMatch[1]); } catch { /* best effort */ }
  }

  // Extract checklist update (Phase 2)
  let checklistUpdate = null;
  const checklistMatch = reply.match(/<<<CHECKLIST_UPDATE>>>([\s\S]*?)<<<END_UPDATE>>>/);
  if (checklistMatch) {
    try { checklistUpdate = JSON.parse(checklistMatch[1]); } catch { /* best effort */ }
  }

  // Save knowledge when the knowledge checklist item is marked complete
  if (checklistUpdate?.item === "knowledge" && checklistUpdate?.completed && userId) {
    try {
      // Find the user's venue
      const ownerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/venue_owners?user_id=eq.${userId}&select=venue_id&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (ownerRes.ok) {
        const owners = await ownerRes.json() as { venue_id: string }[];
        if (owners.length > 0) {
          const venueId = owners[0].venue_id;
          // Collect user messages as knowledge content
          const userMessages = body.messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .slice(-5)
            .join("\n\n");

          if (userMessages.trim()) {
            await fetch(`${SUPABASE_URL}/rest/v1/venue_knowledge`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                venue_id: venueId,
                content: userMessages.trim(),
                category: "general",
              }),
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to save knowledge:", err);
    }
  }

  // Clean reply
  const cleanReply = reply
    .replace(/<<<VENUE_DATA>>>[\s\S]*?<<<END_DATA>>>/g, "")
    .replace(/<<<HUB_PARTIAL>>>[\s\S]*?<<<END_PARTIAL>>>/g, "")
    .replace(/<<<REPLIES>>>[\s\S]*?<<<END_REPLIES>>>/g, "")
    .replace(/<<<CHECKLIST_UPDATE>>>[\s\S]*?<<<END_UPDATE>>>/g, "")
    .trim();

  return NextResponse.json({ reply: cleanReply, venueCreated, hubData, smartReplies, checklistUpdate });
}

async function createVenueFromAI(data: {
  name: string;
  address: string;
  type: string;
  locationMode?: string;
  maxOccupancy: number;
  hours: string;
  menu: string;
  rules: string[];
  tagline: string;
  description: string;
  themeColor: string;
}, userId?: string) {
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locationMode = data.locationMode || "fixed";
  const hasAddress = Boolean(data.address && data.address.trim());

  // Geocode address (skip for mobile/virtual with no address)
  let lat = null;
  let lng = null;
  let neighborhood = "";
  if (hasAddress) {
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
  }

  // Determine which checklist items are already complete
  const hasHours = Boolean(data.hours && data.hours.trim());
  const isMobileOrVirtual = locationMode === "mobile" || locationMode === "virtual";
  const onboardingChecklist = {
    basics: true,
    location: isMobileOrVirtual ? true : hasAddress,
    hours: hasHours,
    branding: false,
    offerings: false,
    knowledge: false,
    photos: false,
    xp: false,
    stripe: false,
  };

  const onboardingEmailState = {
    welcome_sent: true,
    created_at: new Date().toISOString(),
    day2_sent: false,
    day5_sent: false,
    day14_sent: false,
  };

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
      location_mode: locationMode,
      address: data.address || "",
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

  const hours = [{ day: "See venue", open: data.hours, close: "" }];
  const menuSections = [{ name: "Highlights", items: data.menu.split(",").map((i: string) => i.trim()) }];

  // Create venue page with checklist
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
      review_status: "draft",
      onboarding_checklist: onboardingChecklist,
      onboarding_email_state: onboardingEmailState,
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

  // Send welcome email
  if (userId) {
    try {
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=email,phone`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (profileRes.ok) {
        const profiles = await profileRes.json() as { email?: string; phone?: string }[];
        const ownerEmail = profiles[0]?.email || (profiles[0]?.phone?.includes("@") ? profiles[0].phone : null);
        if (ownerEmail) {
          sendEmail(ownerEmail, `Welcome to theKickBack, ${data.name}!`, wrap(`
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="margin:0;font-size:24px;color:#fff;">Your hub is taking shape.</h1>
            </div>
            <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.5;">
              <strong style="color:#fff;">${data.name}</strong> has been created on theKickBack.
              Head back to your dashboard to finish setting it up — add photos, connect Stripe, and fine-tune your offerings.
            </p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://dash.thekickback.net/onboarding" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">Continue Setup</a>
            </div>
          `));
        }
      }
    } catch { /* best effort */ }
  }

  // Auto-generate offerings, XP, milestones, perks via AI
  try {
    const setupRes = await fetch(
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
            {
              role: "system",
              content: `Generate venue setup JSON for theKickBack. Return ONLY valid JSON:
{"offerings":[{"type":"product|membership|reservation|service|event|package","name":"...","description":"...","price_cents":500,"recurring":false,"interval":null,"duration_minutes":null,"perks":[],"add_ons":[]}],
"xp_actions":[{"action":"visit|first_visit|order|referral|event_attend|review","label":"...","points":50,"description":"...","max_per_day":null}],
"xp_milestones":[{"name":"...","threshold":100,"color":"#hex","reward":"...","perks":["..."]}],
"perks":[{"name":"...","description":"...","point_cost":100,"category":"drink|food|access|experience"}]}
Rules: 6-8 offerings matching venue type/menu. Reservations need duration_minutes. Memberships need recurring:true, interval:"month". Realistic prices in cents. 5 XP actions. 4 milestones (100,300,750,1500). 4-5 perks (80-1000 points). Make everything specific to this venue.`
            },
            {
              role: "user",
              content: `Venue: ${data.name}\nType: ${data.type}\nAddress: ${data.address}\nMenu: ${data.menu}\nTagline: ${data.tagline}\nDescription: ${data.description}\nRules: ${JSON.stringify(data.rules)}\nCapacity: ${data.maxOccupancy}`
            },
          ],
        }),
      }
    );

    if (setupRes.ok) {
      const setupData = await setupRes.json() as { choices: { message: { content: string } }[] };
      const raw = setupData.choices?.[0]?.message?.content || "";
      const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

      try {
        const setup = JSON.parse(jsonStr);

        for (let i = 0; i < (setup.offerings || []).length; i++) {
          const o = setup.offerings[i];
          await fetch(`${SUPABASE_URL}/rest/v1/venue_offerings`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              venue_id: venueId, type: o.type || "product", name: o.name, description: o.description || null,
              price_cents: o.price_cents || 0, recurring: o.recurring || false, interval: o.interval || null,
              duration_minutes: o.duration_minutes || null, perks: o.perks || [], add_ons: o.add_ons || [],
              active: true, sort_order: i,
            }),
          });
        }

        for (let i = 0; i < (setup.xp_actions || []).length; i++) {
          const a = setup.xp_actions[i];
          await fetch(`${SUPABASE_URL}/rest/v1/venue_xp_actions`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              venue_id: venueId, action: a.action || "custom", label: a.label,
              points: a.points || 10, description: a.description || null,
              max_per_day: a.max_per_day || null, sort_order: i,
            }),
          });
        }

        for (let i = 0; i < (setup.xp_milestones || []).length; i++) {
          const m = setup.xp_milestones[i];
          await fetch(`${SUPABASE_URL}/rest/v1/venue_xp_milestones`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              venue_id: venueId, name: m.name, threshold: m.threshold || 100,
              color: m.color || "#4ade80", reward: m.reward || null, perks: m.perks || [],
              sort_order: i,
            }),
          });
        }

        for (let i = 0; i < (setup.perks || []).length; i++) {
          const p = setup.perks[i];
          await fetch(`${SUPABASE_URL}/rest/v1/venue_perks`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              venue_id: venueId, name: p.name, description: p.description || null,
              point_cost: p.point_cost || 100, category: p.category || "other",
              sort_order: i,
            }),
          });
        }

        console.log(`AI setup complete for ${data.name}: ${setup.offerings?.length || 0} offerings, ${setup.xp_actions?.length || 0} XP actions, ${setup.xp_milestones?.length || 0} milestones, ${setup.perks?.length || 0} perks`);
      } catch (parseErr) {
        console.error("AI setup parse error:", parseErr);
      }
    }
  } catch (setupErr) {
    console.error("AI setup error:", setupErr);
  }

  console.log(`Venue created: ${data.name} (${venueId}) — owner: ${userId || "anonymous"} — pending review`);
}
