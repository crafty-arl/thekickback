export interface Env {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_HOOKS_TOKEN: string;
  ENVIRONMENT: string;
}

interface Profile {
  id: string;
  phone: string;
  display_name: string | null;
}

interface Venue {
  id: string;
  name: string;
  state: string;
  occupancy: number;
  max_occupancy: number;
  vibe: string;
  rules: string[];
}

interface Session {
  id: string;
  user_id: string;
  venue_id: string;
  started_at: string;
  status: string;
}

// ─── Worker entry ────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "sms-worker", provider: "twilio", number: env.TWILIO_PHONE_NUMBER });
    }

    // ─── Shortcuts / JSON API ─────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/api") {
      const json = await request.json() as {
        command: string;
        venue_id?: string;
        device_id?: string;
      };

      const deviceId = json.device_id || `shortcut-${Date.now()}`;
      const venueId = json.venue_id;
      const command = (json.command || "").toLowerCase().trim();

      console.log(`Shortcut API: command="${command}" venue="${venueId}" device="${deviceId}"`);

      const profile = await getOrCreateProfile(`device:${deviceId}`, env);

      // For JOIN, use specific venue if provided
      let reply: string;
      let venueData: Venue | null = null;
      let sessionData: Session | null = null;

      if (command === "join" && venueId) {
        venueData = await getVenueById(venueId, env);
        if (!venueData) {
          return Response.json({ error: "Venue not found" }, { status: 404 });
        }

        const existing = await getActiveSession(profile.id, env);
        if (existing) {
          const existingVenue = await getVenueById(existing.venue_id, env);
          return Response.json({
            status: "already_joined",
            message: `You're already in ${existingVenue?.name || "a venue"}.`,
            venue: existingVenue ? {
              name: existingVenue.name,
              vibe: existingVenue.vibe,
              occupancy: existingVenue.occupancy,
              capacity: existingVenue.max_occupancy,
            } : null,
            session_id: existing.id,
            user_id: profile.id,
            pass_url: `https://thekickback.net/wallet/pass/${existing.venue_id}/${profile.id}`,
          });
        }

        // Create session
        const sessions = await supabase(env, "sessions", {
          method: "POST",
          body: JSON.stringify({ user_id: profile.id, venue_id: venueData.id, status: "active" }),
        }) as Session[] | null;

        // Update occupancy
        await supabase(env, `venues?id=eq.${venueData.id}`, {
          method: "PATCH",
          body: JSON.stringify({ occupancy: venueData.occupancy + 1 }),
        });

        return Response.json({
          status: "joined",
          message: `Welcome to ${venueData.name}!`,
          venue: {
            name: venueData.name,
            vibe: venueData.vibe,
            occupancy: venueData.occupancy + 1,
            capacity: venueData.max_occupancy,
            rules: venueData.rules,
          },
          session_id: sessions?.[0]?.id || null,
          user_id: profile.id,
          pass_url: `https://thekickback.net/wallet/pass/${venueData.id}/${profile.id}`,
          commands: ["menu", "request", "ask", "status", "hold", "leave", "membership"],
        });
      }

      // Generic command handling
      reply = await handleCommand(`device:${deviceId}`, `${command} ${json.venue_id || ""}`.trim(), env);
      return Response.json({ status: "ok", message: reply });
    }

    // ─── List venues (for Shortcuts) ─────────────────────────────
    if (request.method === "GET" && url.pathname === "/api/venues") {
      const venues = await supabase(env, "venues?state=eq.active&order=name") as Venue[] | null;
      return Response.json({
        venues: (venues || []).map(v => ({
          id: v.id,
          name: v.name,
          vibe: v.vibe,
          occupancy: v.occupancy,
          capacity: v.max_occupancy,
        })),
      });
    }

    // ─── Twilio SMS webhook ──────────────────────────────────────
    if (request.method !== "POST" || url.pathname !== "/sms") {
      return new Response("Not found", { status: 404 });
    }

    const formData = await request.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string || "").trim();

    console.log(`SMS from: ${from} | Body: "${body}"`);

    const reply = await handleCommand(from, body, env);

    return new Response(twiml(reply), {
      headers: { "Content-Type": "text/xml" },
    });
  },
};

// ─── TwiML helper ────────────────────────────────────────────────

function twiml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

// ─── Supabase helpers ────────────────────────────────────────────

async function supabase(env: Env, path: string, options: RequestInit = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Supabase error: ${res.status} ${err}`);
    return null;
  }
  return res.json();
}

async function getOrCreateProfile(phone: string, env: Env): Promise<Profile> {
  const existing = (await supabase(env, `profiles?phone=eq.${encodeURIComponent(phone)}&limit=1`)) as Profile[] | null;
  if (existing && existing.length > 0) return existing[0];

  const created = (await supabase(env, "profiles", {
    method: "POST",
    body: JSON.stringify({ phone }),
  })) as Profile[] | null;

  if (created && created.length > 0) return created[0];
  throw new Error("Failed to create profile");
}

async function getDefaultVenue(env: Env): Promise<Venue | null> {
  const venues = (await supabase(env, "venues?state=eq.active&limit=1")) as Venue[] | null;
  return venues && venues.length > 0 ? venues[0] : null;
}

async function getActiveSession(userId: string, env: Env): Promise<Session | null> {
  const sessions = (await supabase(
    env,
    `sessions?user_id=eq.${userId}&status=eq.active&order=started_at.desc&limit=1`
  )) as Session[] | null;
  return sessions && sessions.length > 0 ? sessions[0] : null;
}

async function getVenueById(venueId: string, env: Env): Promise<Venue | null> {
  const venues = (await supabase(env, `venues?id=eq.${venueId}&limit=1`)) as Venue[] | null;
  return venues && venues.length > 0 ? venues[0] : null;
}

// ─── Command Router ──────────────────────────────────────────────

async function handleCommand(from: string, body: string, env: Env): Promise<string> {
  const raw = body.toLowerCase().trim();
  const command = raw.split(/\s+/)[0];
  const args = raw.slice(command.length).trim();

  try {
    const profile = await getOrCreateProfile(from, env);

    switch (command) {
      case "join":
        return handleJoin(profile, env);
      case "ask":
        return handleAsk(profile, args, env);
      case "request":
        return handleRequest(profile, args, env);
      case "menu":
        return handleMenu(env);
      case "hold":
        return handleHold(profile, args, env);
      case "status":
        return handleStatus(profile, env);
      case "leave":
        return handleLeave(profile, env);
      case "membership":
        return handleMembership(profile, env);
      case "yes":
        return handleMembershipConfirm(profile, env);
      default:
        return handleFreeform(profile, raw, env);
    }
  } catch (err) {
    console.error("Command error:", err);
    return "Something went wrong. Try again or text STATUS to check your session.";
  }
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleJoin(profile: Profile, env: Env): Promise<string> {
  const existing = await getActiveSession(profile.id, env);
  if (existing) {
    const venue = await getVenueById(existing.venue_id, env);
    return `You're already in ${venue?.name || "a venue"}. Text STATUS to see your session or LEAVE to exit.`;
  }

  const venue = await getDefaultVenue(env);
  if (!venue) return "No venues are active right now. Try again later.";

  await supabase(env, "sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, status: "active" }),
  });

  await supabase(env, `venues?id=eq.${venue.id}`, {
    method: "PATCH",
    body: JSON.stringify({ occupancy: venue.occupancy + 1 }),
  });

  const rulesText = Array.isArray(venue.rules)
    ? venue.rules.map((r: string) => `  - ${r}`).join("\n")
    : "";

  return [
    `Welcome to ${venue.name}. ${capitalize(venue.vibe)} right now — ${venue.occupancy + 1} people.`,
    "",
    `You're in as a Guest. Text MENU, REQUEST, or ASK anytime.`,
    rulesText ? `\nHouse rules:\n${rulesText}` : "",
  ].join("\n").trim();
}

async function handleAsk(profile: Profile, question: string, env: Env): Promise<string> {
  if (!question) return "What do you want to ask? Text ASK followed by your question.";
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Text JOIN first.";
  const venue = await getVenueById(session.venue_id, env);

  return askClaw(
    `A guest at ${venue?.name || "the venue"} asks: "${question}". The venue is currently ${venue?.vibe}, with ${venue?.occupancy} people. Respond as the venue in 1-2 sentences max. Be helpful and direct. No emojis.`,
    profile.phone,
    env
  );
}

async function askClaw(message: string, userPhone: string, env: Env): Promise<string> {
  try {
    const res = await fetch(`${env.OPENCLAW_GATEWAY_URL}/hooks/agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCLAW_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, from: userPhone, agentId: "main" }),
    });
    if (res.ok) {
      const data = (await res.json()) as { payloads?: { text?: string }[] };
      if (data.payloads?.[0]?.text) return data.payloads[0].text;
    }
    const errText = await res.text();
    console.error("Claw response:", res.status, errText);
  } catch (err) {
    console.error("Claw error:", err);
  }
  return "Couldn't reach the venue right now. Try again in a moment.";
}

async function handleRequest(profile: Profile, what: string, env: Env): Promise<string> {
  if (!what) return "What would you like to request? e.g. REQUEST a booth near the window";
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Text JOIN first.";
  const venue = await getVenueById(session.venue_id, env);
  const lower = what.toLowerCase();
  const type = lower.includes("booth") || lower.includes("table") || lower.includes("seat")
    ? "booth" : lower.includes("order") || lower.includes("drink") || lower.includes("food")
      ? "order" : "service";

  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({ user_id: profile.id, venue_id: session.venue_id, session_id: session.id, type, body: what, status: "pending" }),
  });
  return `Request sent to ${venue?.name || "the venue"}: "${what}"\nWe'll text you when it's handled.`;
}

async function handleMenu(env: Env): Promise<string> {
  const venue = await getDefaultVenue(env);
  if (!venue) return "No venue info available.";
  return `${venue.name} — Menu\n\nDrinks: espresso, matcha, cold brew, sparkling water\nFood: avocado toast, grain bowl, pastry basket\n\nText REQUEST + item to order.`;
}

async function handleHold(profile: Profile, what: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Text JOIN first.";
  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({ user_id: profile.id, venue_id: session.venue_id, session_id: session.id, type: "booth", body: what || "Hold a booth", status: "pending" }),
  });
  return "Hold request sent. We'll text you when confirmed.";
}

async function handleStatus(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now. Text JOIN to enter one.";
  const venue = await getVenueById(session.venue_id, env);
  const reqs = (await supabase(env, `requests?user_id=eq.${profile.id}&session_id=eq.${session.id}&status=eq.pending`)) as { id: string }[] | null;
  const mins = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
  const memberships = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${session.venue_id}&limit=1`)) as { tier: string }[] | null;
  const tier = memberships && memberships.length > 0 ? memberships[0].tier : "Guest";

  return `${venue?.name || "Venue"} — Your session\n\nStatus: ${capitalize(tier)}\nVibe: ${capitalize(venue?.vibe || "unknown")} (${venue?.occupancy || "?"} people)\nTime: ${mins} min\nPending requests: ${reqs?.length || 0}`;
}

async function handleLeave(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now.";
  const venue = await getVenueById(session.venue_id, env);
  await supabase(env, `sessions?id=eq.${session.id}`, { method: "PATCH", body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }) });
  if (venue && venue.occupancy > 0) {
    await supabase(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy - 1 }) });
  }
  return `You've left ${venue?.name || "the venue"}. Thanks for stopping by. Text JOIN anytime to come back.`;
}

async function handleMembership(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venue = session ? await getVenueById(session.venue_id, env) : await getDefaultVenue(env);
  if (!venue) return "No venue available for membership right now.";
  const existing = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `You're already a ${existing[0].tier} member at ${venue.name}.`;
  return `${venue.name} Membership\n\n-> Priority booths\n-> Skip the wait\n-> Members-only events\n-> $25/month\n\nReply YES to join, or ASK to learn more.`;
}

async function handleMembershipConfirm(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venue = session ? await getVenueById(session.venue_id, env) : await getDefaultVenue(env);
  if (!venue) return "No venue available.";
  const existing = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `Already a ${existing[0].tier} member at ${venue.name}.`;
  await supabase(env, "memberships", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, tier: "member" }) });
  return `You're in. Welcome to ${venue.name}, member. Your number is now recognized across all KickBack venues. Text STATUS anytime.`;
}

async function handleFreeform(profile: Profile, raw: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (session) {
    const venue = await getVenueById(session.venue_id, env);
    return askClaw(`A guest at ${venue?.name || "the venue"} texted: "${raw}". Venue is ${venue?.vibe}, ${venue?.occupancy} people. Respond as the venue. Keep it under 160 chars. No emojis.`, profile.phone, env);
  }
  return `Hey! Text JOIN to enter a venue first.\n\nCommands:\nJOIN — enter a venue\nASK — ask the venue anything\nREQUEST — request something\nSTATUS — check your session\nLEAVE — exit\nMEMBERSHIP — join as a member`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
