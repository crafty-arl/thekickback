export interface Env {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_MESSAGING_SERVICE_SID: string;
  TWILIO_PHONE_NUMBER: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  OPENCLAW_HOOKS_TOKEN: string;
  ENVIRONMENT: string;
}

interface InboundSMS {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "sms-worker" });
    }

    if (request.method !== "POST" || url.pathname !== "/sms") {
      return new Response("Not found", { status: 404 });
    }

    // TODO: re-enable after setting correct Account Auth Token
    // if (!(await validateTwilioSignature(request, env))) {
    //   return new Response("Unauthorized", { status: 403 });
    // }

    const formData = await request.formData();
    const sms: InboundSMS = {
      From: formData.get("From") as string,
      To: formData.get("To") as string,
      Body: (formData.get("Body") as string || "").trim(),
      MessageSid: formData.get("MessageSid") as string,
    };

    const reply = await handleCommand(sms, env);

    return new Response(twiml(reply), {
      headers: { "Content-Type": "text/xml" },
    });
  },
};

// ─── Supabase helpers ─────────────────────────────────────────────

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
  // Try to find existing profile
  const existing = (await supabase(env, `profiles?phone=eq.${encodeURIComponent(phone)}&limit=1`)) as Profile[] | null;
  if (existing && existing.length > 0) return existing[0];

  // Create new profile
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

// ─── Command Router ───────────────────────────────────────────────

async function handleCommand(sms: InboundSMS, env: Env): Promise<string> {
  const raw = sms.Body.toLowerCase().trim();
  const command = raw.split(/\s+/)[0];
  const args = raw.slice(command.length).trim();

  try {
    const profile = await getOrCreateProfile(sms.From, env);

    switch (command) {
      case "join":
        return handleJoin(profile, env);
      case "ask":
        return handleAsk(profile, args, env);
      case "request":
        return handleRequest(profile, args, env);
      case "menu":
        return handleMenu(profile, env);
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

// ─── Command Handlers ─────────────────────────────────────────────

async function handleJoin(profile: Profile, env: Env): Promise<string> {
  // Check for existing active session
  const existing = await getActiveSession(profile.id, env);
  if (existing) {
    const venue = await getVenueById(existing.venue_id, env);
    return `You're already in ${venue?.name || "a venue"}. Text STATUS to see your session or LEAVE to exit.`;
  }

  const venue = await getDefaultVenue(env);
  if (!venue) return "No venues are active right now. Try again later.";

  // Create session
  await supabase(env, "sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: profile.id,
      venue_id: venue.id,
      status: "active",
    }),
  });

  // Update occupancy
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
      body: JSON.stringify({
        message,
        from: userPhone,
        agentId: "main",
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { payloads?: { text?: string }[] };
      if (data.payloads?.[0]?.text) {
        // Trim to SMS-friendly length
        const reply = data.payloads[0].text;
        return reply.length > 320 ? reply.slice(0, 317) + "..." : reply;
      }
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

  // Determine request type
  const lower = what.toLowerCase();
  const type = lower.includes("booth") || lower.includes("table") || lower.includes("seat")
    ? "booth"
    : lower.includes("order") || lower.includes("drink") || lower.includes("food")
      ? "order"
      : "service";

  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({
      user_id: profile.id,
      venue_id: session.venue_id,
      session_id: session.id,
      type,
      body: what,
      status: "pending",
    }),
  });

  return `Request sent to ${venue?.name || "the venue"}: "${what}"\nWe'll text you when it's handled.`;
}

async function handleMenu(_profile: Profile, env: Env): Promise<string> {
  const venue = await getDefaultVenue(env);
  if (!venue) return "No venue info available.";

  return [
    `${venue.name} — Menu`,
    "",
    "Drinks: espresso, matcha, cold brew, sparkling water",
    "Food: avocado toast, grain bowl, pastry basket",
    "",
    "Text REQUEST + item to order.",
  ].join("\n");
}

async function handleHold(profile: Profile, what: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Text JOIN first.";

  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({
      user_id: profile.id,
      venue_id: session.venue_id,
      session_id: session.id,
      type: "booth",
      body: what || "Hold a booth",
      status: "pending",
    }),
  });

  return "Hold request sent. We'll text you when confirmed.";
}

async function handleStatus(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now. Text JOIN to enter one.";

  const venue = await getVenueById(session.venue_id, env);

  // Check pending requests
  const reqs = (await supabase(
    env,
    `requests?user_id=eq.${profile.id}&session_id=eq.${session.id}&status=eq.pending`
  )) as { id: string }[] | null;

  const started = new Date(session.started_at);
  const mins = Math.round((Date.now() - started.getTime()) / 60000);

  // Check membership
  const memberships = (await supabase(
    env,
    `memberships?user_id=eq.${profile.id}&venue_id=eq.${session.venue_id}&limit=1`
  )) as { tier: string }[] | null;

  const tier = memberships && memberships.length > 0 ? memberships[0].tier : "Guest";

  return [
    `${venue?.name || "Venue"} — Your session`,
    "",
    `Status: ${capitalize(tier)}`,
    `Vibe: ${capitalize(venue?.vibe || "unknown")} (${venue?.occupancy || "?"} people)`,
    `Time: ${mins} min`,
    `Pending requests: ${reqs?.length || 0}`,
  ].join("\n");
}

async function handleLeave(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now.";

  const venue = await getVenueById(session.venue_id, env);

  // End session
  await supabase(env, `sessions?id=eq.${session.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
  });

  // Decrement occupancy
  if (venue && venue.occupancy > 0) {
    await supabase(env, `venues?id=eq.${venue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ occupancy: venue.occupancy - 1 }),
    });
  }

  return `You've left ${venue?.name || "the venue"}. Thanks for stopping by. Text JOIN anytime to come back.`;
}

async function handleMembership(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venueId = session?.venue_id;
  const venue = venueId ? await getVenueById(venueId, env) : await getDefaultVenue(env);

  if (!venue) return "No venue available for membership right now.";

  // Check existing membership
  const existing = (await supabase(
    env,
    `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`
  )) as { tier: string }[] | null;

  if (existing && existing.length > 0) {
    return `You're already a ${existing[0].tier} member at ${venue.name}.`;
  }

  return [
    `${venue.name} Membership`,
    "",
    "-> Priority booths",
    "-> Skip the wait",
    "-> Members-only events",
    "-> $25/month",
    "",
    "Reply YES to join, or ASK to learn more.",
  ].join("\n");
}

async function handleMembershipConfirm(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venueId = session?.venue_id;
  const venue = venueId ? await getVenueById(venueId, env) : await getDefaultVenue(env);

  if (!venue) return "No venue available.";

  // Check if already a member
  const existing = (await supabase(
    env,
    `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`
  )) as { tier: string }[] | null;

  if (existing && existing.length > 0) {
    return `You're already a ${existing[0].tier} member at ${venue.name}.`;
  }

  await supabase(env, "memberships", {
    method: "POST",
    body: JSON.stringify({
      user_id: profile.id,
      venue_id: venue.id,
      tier: "member",
    }),
  });

  return `You're in. Welcome to ${venue.name}, member. Your number is now recognized across all KickBack venues. Text STATUS anytime.`;
}

async function handleFreeform(profile: Profile, raw: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);

  // If user has an active session, route freeform text to claw as a venue question
  if (session) {
    const venue = await getVenueById(session.venue_id, env);
    return askClaw(
      `A guest at ${venue?.name || "the venue"} texted: "${raw}". Venue is ${venue?.vibe}, ${venue?.occupancy} people. Respond as the venue. Keep it under 160 chars. No emojis.`,
      profile.phone,
      env
    );
  }

  // No session — show help
  return [
    `Hey! Text JOIN to enter a venue first.`,
    "",
    "Commands:",
    "JOIN — enter a venue",
    "ASK — ask the venue anything",
    "REQUEST — request something",
    "STATUS — check your session",
    "LEAVE — exit",
    "MEMBERSHIP — join as a member",
  ].join("\n");
}

// ─── Utilities ────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function twiml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

async function validateTwilioSignature(request: Request, env: Env): Promise<boolean> {
  if (env.ENVIRONMENT === "development") return true;

  const signature = request.headers.get("X-Twilio-Signature");
  if (!signature) return false;

  const url = request.url;
  const body = await request.clone().formData();

  const params: [string, string][] = [];
  body.forEach((value, key) => {
    params.push([key, value as string]);
  });
  params.sort(([a], [b]) => a.localeCompare(b));

  const data = url + params.map(([k, v]) => k + v).join("");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return expected === signature;
}
