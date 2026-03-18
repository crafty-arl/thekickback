import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { encrypt, decrypt } from "nostr-tools/nip04";

// ─── Types ───────────────────────────────────────────────────────

export interface Env {
  NOSTR_SECRET_KEY: string;
  NOSTR_RELAYS: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_HOOKS_TOKEN: string;
  ENVIRONMENT: string;
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
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

// ─── Nostr Helpers ───────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Fetch recent DMs (kind 4) addressed to our pubkey from a relay
 * using the NIP-01 REQ filter over HTTP (NIP-50 / NIP-11 style)
 * We use the relay's WebSocket to fetch events.
 */
async function fetchDMs(relayUrl: string, ourPubkey: string, since: number): Promise<NostrEvent[]> {
  // Use relay HTTP API if available, otherwise skip
  // Most relays support NIP-50 search or we can use the REQ protocol over fetch
  const httpUrl = relayUrl.replace("wss://", "https://").replace("ws://", "http://");

  try {
    const res = await fetch(`${httpUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: {
          kinds: [4],
          "#p": [ourPubkey],
          since,
          limit: 50,
        },
      }),
    });

    if (res.ok) {
      const events = (await res.json()) as NostrEvent[];
      return Array.isArray(events) ? events : [];
    }
  } catch {
    // Relay doesn't support HTTP POST, try NIP-50
  }

  // Fallback: use nostr.band API which indexes events
  try {
    const res = await fetch(
      `https://api.nostr.band/v0/events?kinds=4&%23p=${ourPubkey}&since=${since}&limit=50`
    );
    if (res.ok) {
      const data = (await res.json()) as { events?: NostrEvent[] };
      return data.events || [];
    }
  } catch {
    // nostr.band unavailable
  }

  return [];
}

/**
 * Publish a kind-4 encrypted DM to relays
 */
async function publishDM(
  content: string,
  recipientPubkey: string,
  secretKeyHex: string,
  relays: string[],
): Promise<void> {
  const sk = hexToBytes(secretKeyHex);

  // Encrypt with NIP-04
  const encrypted = await encrypt(secretKeyHex, recipientPubkey, content);

  // Build event
  const event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", recipientPubkey]],
      content: encrypted,
    },
    sk,
  );

  // Publish to all relays via HTTP
  for (const relay of relays) {
    const httpUrl = relay.replace("wss://", "https://").replace("ws://", "http://");
    try {
      await fetch(httpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["EVENT", event]),
      });
    } catch {
      console.error(`Failed to publish to ${relay}`);
    }
  }
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

async function getOrCreateProfile(nostrPubkey: string, env: Env): Promise<Profile> {
  const identifier = `nostr:${nostrPubkey.slice(0, 16)}`;
  const existing = (await supabase(env, `profiles?phone=eq.${encodeURIComponent(identifier)}&limit=1`)) as Profile[] | null;
  if (existing && existing.length > 0) return existing[0];

  const created = (await supabase(env, "profiles", {
    method: "POST",
    body: JSON.stringify({ phone: identifier, display_name: `nostr:${nostrPubkey.slice(0, 8)}` }),
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
    `sessions?user_id=eq.${userId}&status=eq.active&order=started_at.desc&limit=1`,
  )) as Session[] | null;
  return sessions && sessions.length > 0 ? sessions[0] : null;
}

async function getVenueById(venueId: string, env: Env): Promise<Venue | null> {
  const venues = (await supabase(env, `venues?id=eq.${venueId}&limit=1`)) as Venue[] | null;
  return venues && venues.length > 0 ? venues[0] : null;
}

// Track processed event IDs to avoid double-processing
async function isProcessed(eventId: string, env: Env): Promise<boolean> {
  const rows = (await supabase(env, `nostr_processed?event_id=eq.${eventId}&limit=1`)) as { id: string }[] | null;
  return (rows && rows.length > 0) || false;
}

async function markProcessed(eventId: string, env: Env): Promise<void> {
  await supabase(env, "nostr_processed", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId }),
  });
}

// ─── Command Router ──────────────────────────────────────────────

async function handleCommand(pubkey: string, body: string, env: Env): Promise<string> {
  const raw = body.toLowerCase().trim();
  const command = raw.split(/\s+/)[0];
  const args = raw.slice(command.length).trim();

  try {
    const profile = await getOrCreateProfile(pubkey, env);

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
    return "Something went wrong. Try again or send STATUS.";
  }
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleJoin(profile: Profile, env: Env): Promise<string> {
  const existing = await getActiveSession(profile.id, env);
  if (existing) {
    const venue = await getVenueById(existing.venue_id, env);
    return `You're already in ${venue?.name || "a venue"}. Send STATUS or LEAVE.`;
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

  return [
    `Welcome to ${venue.name}. ${capitalize(venue.vibe)} right now — ${venue.occupancy + 1} people.`,
    "",
    "You're in as a Guest. Send MENU, REQUEST, or ASK anytime.",
  ].join("\n");
}

async function handleAsk(profile: Profile, question: string, env: Env): Promise<string> {
  if (!question) return "What do you want to ask? Send ASK followed by your question.";
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN first.";
  const venue = await getVenueById(session.venue_id, env);

  return askClaw(
    `A guest at ${venue?.name || "the venue"} asks: "${question}". Venue is ${venue?.vibe}, ${venue?.occupancy} people. Respond as the venue in 1-2 sentences. Be direct. No emojis.`,
    profile.phone,
    env,
  );
}

async function askClaw(message: string, userIdentifier: string, env: Env): Promise<string> {
  try {
    const res = await fetch(`${env.OPENCLAW_GATEWAY_URL}/hooks/agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCLAW_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, from: userIdentifier, agentId: "main" }),
    });
    if (res.ok) {
      const data = (await res.json()) as { payloads?: { text?: string }[] };
      if (data.payloads?.[0]?.text) return data.payloads[0].text;
    }
  } catch (err) {
    console.error("Claw error:", err);
  }
  return "Couldn't reach the venue right now. Try again in a moment.";
}

async function handleRequest(profile: Profile, what: string, env: Env): Promise<string> {
  if (!what) return "What would you like? e.g. REQUEST a booth near the window";
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN first.";
  const venue = await getVenueById(session.venue_id, env);
  const lower = what.toLowerCase();
  const type = lower.includes("booth") || lower.includes("table") ? "booth" : lower.includes("drink") || lower.includes("food") ? "order" : "service";

  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({ user_id: profile.id, venue_id: session.venue_id, session_id: session.id, type, body: what, status: "pending" }),
  });
  return `Request sent to ${venue?.name || "the venue"}: "${what}"`;
}

async function handleMenu(env: Env): Promise<string> {
  const venue = await getDefaultVenue(env);
  if (!venue) return "No venue info available.";
  return `${venue.name} — Menu\n\nDrinks: espresso, matcha, cold brew\nFood: avocado toast, grain bowl, pastry\n\nSend REQUEST + item to order.`;
}

async function handleHold(profile: Profile, what: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN first.";
  await supabase(env, "requests", {
    method: "POST",
    body: JSON.stringify({ user_id: profile.id, venue_id: session.venue_id, session_id: session.id, type: "booth", body: what || "Hold a booth", status: "pending" }),
  });
  return "Hold request sent. We'll reply when confirmed.";
}

async function handleStatus(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN to enter one.";
  const venue = await getVenueById(session.venue_id, env);
  const reqs = (await supabase(env, `requests?user_id=eq.${profile.id}&session_id=eq.${session.id}&status=eq.pending`)) as { id: string }[] | null;
  const mins = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
  const memberships = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${session.venue_id}&limit=1`)) as { tier: string }[] | null;
  const tier = memberships && memberships.length > 0 ? memberships[0].tier : "Guest";

  return `${venue?.name || "Venue"} — Your session\n\nStatus: ${capitalize(tier)}\nVibe: ${capitalize(venue?.vibe || "?")} (${venue?.occupancy} people)\nTime: ${mins} min\nPending: ${reqs?.length || 0}`;
}

async function handleLeave(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now.";
  const venue = await getVenueById(session.venue_id, env);
  await supabase(env, `sessions?id=eq.${session.id}`, { method: "PATCH", body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }) });
  if (venue && venue.occupancy > 0) {
    await supabase(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy - 1 }) });
  }
  return `You've left ${venue?.name || "the venue"}. Send JOIN anytime to come back.`;
}

async function handleMembership(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venue = session ? await getVenueById(session.venue_id, env) : await getDefaultVenue(env);
  if (!venue) return "No venue available.";
  const existing = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `You're already a ${existing[0].tier} member at ${venue.name}.`;
  return `${venue.name} Membership\n\n- Priority booths\n- Skip the wait\n- Members-only events\n- $25/month\n\nReply YES to join.`;
}

async function handleMembershipConfirm(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venue = session ? await getVenueById(session.venue_id, env) : await getDefaultVenue(env);
  if (!venue) return "No venue available.";
  const existing = (await supabase(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${venue.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `Already a ${existing[0].tier} member at ${venue.name}.`;
  await supabase(env, "memberships", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, tier: "member" }) });
  return `You're in. Welcome to ${venue.name}, member. Send STATUS anytime.`;
}

async function handleFreeform(profile: Profile, raw: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (session) {
    const venue = await getVenueById(session.venue_id, env);
    return askClaw(`Guest at ${venue?.name} sent: "${raw}". Venue is ${venue?.vibe}, ${venue?.occupancy} people. Respond as venue. Concise. No emojis.`, profile.phone, env);
  }
  return "Hey! Send JOIN to enter a venue.\n\nCommands: JOIN, ASK, REQUEST, STATUS, LEAVE, MEMBERSHIP";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Worker Entry ────────────────────────────────────────────────

export default {
  // HTTP endpoint for health checks and manual triggers
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const sk = hexToBytes(env.NOSTR_SECRET_KEY);
      const pubkey = getPublicKey(sk);
      return Response.json({
        status: "ok",
        service: "nostr-worker",
        pubkey,
        npub: `npub...${pubkey.slice(-8)}`,
        relays: env.NOSTR_RELAYS.split(","),
      });
    }

    // Manual poll trigger
    if (url.pathname === "/poll") {
      const count = await pollAndReply(env);
      return Response.json({ processed: count });
    }

    return new Response("theKickBack Nostr Bot. DM me!", { status: 200 });
  },

  // Cron trigger — polls relays every minute for new DMs
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await pollAndReply(env);
  },
};

async function pollAndReply(env: Env): Promise<number> {
  const sk = hexToBytes(env.NOSTR_SECRET_KEY);
  const ourPubkey = getPublicKey(sk);
  const relays = env.NOSTR_RELAYS.split(",").map((r) => r.trim());

  // Look back 2 minutes for new DMs
  const since = Math.floor(Date.now() / 1000) - 120;

  // Fetch DMs from all relays
  const allEvents: NostrEvent[] = [];
  for (const relay of relays) {
    const events = await fetchDMs(relay, ourPubkey, since);
    allEvents.push(...events);
  }

  // Deduplicate by event ID
  const seen = new Set<string>();
  const unique = allEvents.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  console.log(`Polled ${relays.length} relays, found ${unique.length} DMs`);

  let processed = 0;

  for (const event of unique) {
    // Skip if already processed
    if (await isProcessed(event.id, env)) continue;

    try {
      // Decrypt the DM content
      const plaintext = await decrypt(env.NOSTR_SECRET_KEY, event.pubkey, event.content);

      console.log(`DM from ${event.pubkey.slice(0, 8)}...: "${plaintext}"`);

      // Process the command
      const reply = await handleCommand(event.pubkey, plaintext, env);

      // Send encrypted reply
      await publishDM(reply, event.pubkey, env.NOSTR_SECRET_KEY, relays);

      // Mark as processed
      await markProcessed(event.id, env);

      console.log(`Replied to ${event.pubkey.slice(0, 8)}...`);
      processed++;
    } catch (err) {
      console.error(`Error processing event ${event.id}:`, err);
    }
  }

  return processed;
}
