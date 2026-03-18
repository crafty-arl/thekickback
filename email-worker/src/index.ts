import PostalMime from "postal-mime";
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

// ─── Types ───────────────────────────────────────────────────────

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_HOOKS_TOKEN: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  ENVIRONMENT: string;
}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
  reply(message: EmailMessage): Promise<void>;
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

// ─── SMS Gateway Detection ───────────────────────────────────────

const SMS_GATEWAYS: Record<string, string> = {
  "txt.att.net": "AT&T",
  "mms.att.net": "AT&T MMS",
  "tmomail.net": "T-Mobile",
  "vtext.com": "Verizon",
  "vzwpix.com": "Verizon MMS",
  "messaging.sprintpcs.com": "Sprint",
  "pm.sprint.com": "Sprint",
  "vmobl.com": "Visible",
  "mmst5.tracfone.com": "TracFone",
  "mymetropcs.com": "Metro",
  "msg.fi.google.com": "Google Fi",
  "text.republicwireless.com": "Republic",
  "mailmymobile.net": "Consumer Cellular",
  "cingularme.com": "AT&T Legacy",
  "email.uscc.net": "US Cellular",
  "sms.cricketwireless.net": "Cricket",
  "mms.cricketwireless.net": "Cricket MMS",
  "text.att.net": "AT&T",
};

function isSmsGateway(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return domain in SMS_GATEWAYS;
}

function getCarrier(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return SMS_GATEWAYS[domain] || "Unknown";
}

/**
 * Clean up reply text for SMS delivery via carrier gateways.
 * No length limit — carriers handle multi-segment concatenation.
 */
function smsFormat(text: string): string {
  return text
    .replace(/\n{2,}/g, "\n")   // collapse double newlines
    .replace(/→/g, "-")          // replace arrows with dashes
    .trim();
}

// ─── Email Handler ───────────────────────────────────────────────

export default {
  async email(message: ForwardableEmailMessage, env: Env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const email = await PostalMime.parse(raw);

    // Extract command — SMS gateways often put the text in subject OR body
    const fromAddress = message.from;
    const isSms = isSmsGateway(fromAddress);

    // SMS gateways: body is sometimes in subject, sometimes in body
    // Also strip carrier signatures and forwarding junk
    let body = "";
    if (isSms) {
      // Prefer body, fall back to subject
      body = (email.text || email.subject || "").trim();
      // Strip common carrier footer noise
      body = body.split("\n")[0].trim(); // first line only for SMS
    } else {
      body = (email.text || email.subject || "").trim();
    }

    const carrier = isSms ? getCarrier(fromAddress) : "email";
    console.log(`From: ${fromAddress} | Carrier: ${carrier} | SMS: ${isSms} | Body: "${body}"`);

    // Process command
    const reply = await handleCommand(fromAddress, body, env);

    if (isSms) {
      // SMS: plain text reply via CF Email
      const response = createMimeMessage();
      response.setSender(env.EMAIL_FROM);
      response.setRecipient(fromAddress);
      response.setSubject("");
      response.addMessage({ contentType: "text/plain; charset=utf-8", data: smsFormat(reply) });
      const replyMessage = new EmailMessage(env.EMAIL_FROM, fromAddress, response.asRaw());
      await message.reply(replyMessage);
      console.log(`SMS reply sent to ${fromAddress} (${carrier})`);
    } else {
      // Email: send rich HTML via Resend
      const command = body.toLowerCase().trim().split(/\s+/)[0];
      const subject = buildSubject(command, email.subject);
      const html = buildRichHtml(reply, command, env.EMAIL_FROM);

      await sendViaResend(env, fromAddress, subject, html, reply);
      console.log(`Rich email sent to ${fromAddress} via Resend`);

      // Also reply via CF Email for threading
      const response = createMimeMessage();
      response.setSender(env.EMAIL_FROM);
      response.setRecipient(fromAddress);
      const msgId = message.headers.get("Message-ID") || "";
      if (msgId) response.setHeader("In-Reply-To", msgId);
      response.setSubject(subject);
      response.addMessage({ contentType: "text/plain; charset=utf-8", data: reply });
      const replyMessage = new EmailMessage(env.EMAIL_FROM, fromAddress, response.asRaw());
      await message.reply(replyMessage);
    }
  },
};

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

async function getOrCreateProfile(identifier: string, env: Env): Promise<Profile> {
  // Use email address as the phone field (works as unique identifier)
  const existing = (await supabase(env, `profiles?phone=eq.${encodeURIComponent(identifier)}&limit=1`)) as Profile[] | null;
  if (existing && existing.length > 0) return existing[0];

  const created = (await supabase(env, "profiles", {
    method: "POST",
    body: JSON.stringify({ phone: identifier }),
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
    return "Something went wrong. Try again or send STATUS to check your session.";
  }
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleJoin(profile: Profile, env: Env): Promise<string> {
  const existing = await getActiveSession(profile.id, env);
  if (existing) {
    const venue = await getVenueById(existing.venue_id, env);
    return `You're already in ${venue?.name || "a venue"}. Send STATUS to see your session or LEAVE to exit.`;
  }

  const venue = await getDefaultVenue(env);
  if (!venue) return "No venues are active right now. Try again later.";

  await supabase(env, "sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: profile.id,
      venue_id: venue.id,
      status: "active",
    }),
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
    `You're in as a Guest. Send MENU, REQUEST, or ASK anytime.`,
    rulesText ? `\nHouse rules:\n${rulesText}` : "",
  ].join("\n").trim();
}

async function handleAsk(profile: Profile, question: string, env: Env): Promise<string> {
  if (!question) return "What do you want to ask? Send ASK followed by your question.";

  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN first.";

  const venue = await getVenueById(session.venue_id, env);

  return askClaw(
    `A guest at ${venue?.name || "the venue"} asks: "${question}". The venue is currently ${venue?.vibe}, with ${venue?.occupancy} people. Respond as the venue in 1-2 sentences max. Be helpful and direct. No emojis.`,
    profile.phone,
    env
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
      body: JSON.stringify({
        message,
        from: userIdentifier,
        agentId: "main",
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { payloads?: { text?: string }[] };
      if (data.payloads?.[0]?.text) {
        return data.payloads[0].text;
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
  if (!session) return "You're not in a venue. Send JOIN first.";

  const venue = await getVenueById(session.venue_id, env);

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

  return `Request sent to ${venue?.name || "the venue"}: "${what}"\nWe'll reply when it's handled.`;
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
    "Send REQUEST + item to order.",
  ].join("\n");
}

async function handleHold(profile: Profile, what: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN first.";

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

  return "Hold request sent. We'll reply when confirmed.";
}

async function handleStatus(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now. Send JOIN to enter one.";

  const venue = await getVenueById(session.venue_id, env);

  const reqs = (await supabase(
    env,
    `requests?user_id=eq.${profile.id}&session_id=eq.${session.id}&status=eq.pending`
  )) as { id: string }[] | null;

  const started = new Date(session.started_at);
  const mins = Math.round((Date.now() - started.getTime()) / 60000);

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

  await supabase(env, `sessions?id=eq.${session.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
  });

  if (venue && venue.occupancy > 0) {
    await supabase(env, `venues?id=eq.${venue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ occupancy: venue.occupancy - 1 }),
    });
  }

  return `You've left ${venue?.name || "the venue"}. Thanks for stopping by. Send JOIN anytime to come back.`;
}

async function handleMembership(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const venueId = session?.venue_id;
  const venue = venueId ? await getVenueById(venueId, env) : await getDefaultVenue(env);

  if (!venue) return "No venue available for membership right now.";

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

  return `You're in. Welcome to ${venue.name}, member. Your email is now recognized across all KickBack venues. Send STATUS anytime.`;
}

async function handleFreeform(profile: Profile, raw: string, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);

  if (session) {
    const venue = await getVenueById(session.venue_id, env);
    return askClaw(
      `A guest at ${venue?.name || "the venue"} sent: "${raw}". Venue is ${venue?.vibe}, ${venue?.occupancy} people. Respond as the venue. Keep it concise. No emojis.`,
      profile.phone,
      env
    );
  }

  return [
    `Hey! Send JOIN to enter a venue first.`,
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

// ─── Resend Rich HTML Email ───────────────────────────────────────

async function sendViaResend(env: Env, to: string, subject: string, html: string, text: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "theKickBack <join@thekickback.net>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error: ${res.status} ${err}`);
  }
}

function buildSubject(command: string, originalSubject: string | undefined): string {
  switch (command) {
    case "join": return "Welcome — you're in ✦";
    case "menu": return "Menu ✦";
    case "status": return "Your session ✦";
    case "request": return "Request sent ✦";
    case "hold": return "Hold confirmed ✦";
    case "leave": return "See you next time ✦";
    case "membership": return "Membership ✦";
    case "yes": return "Welcome, member ✦";
    default: return `Re: ${originalSubject || "theKickBack"}`;
  }
}

function buildRichHtml(body: string, command: string, fromEmail: string): string {
  const accent = "#F97316";
  const lines = body.split("\n").filter(Boolean);

  const bodyHtml = lines.map((line) => {
    if (line.startsWith("  - ") || line.startsWith("-> ")) {
      return `<tr><td style="color:${accent};font-size:14px;padding:2px 8px 2px 0;vertical-align:top;">•</td><td style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;">${esc(line.replace(/^(\s*-\s*|-> )/, ""))}</td></tr>`;
    }
    if (line.includes(" — ") && lines.indexOf(line) === 0) {
      return `<h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;">${esc(line)}</h2>`;
    }
    return `<p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 6px;">${esc(line)}</p>`;
  });

  const hasList = bodyHtml.some((h) => h.startsWith("<tr>"));
  const content = hasList
    ? bodyHtml.map((h) => h.startsWith("<tr>") ? h : `<tr><td colspan="2">${h}</td></tr>`).join("")
    : bodyHtml.join("");

  const commandPills = ["MENU", "ASK", "REQUEST", "STATUS", "LEAVE"].map((cmd) =>
    `<a href="mailto:${fromEmail}?subject=${cmd}&body=${cmd}" style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 12px;color:rgba(255,255,255,0.5);font-size:12px;font-family:monospace;text-decoration:none;margin:0 4px 4px 0;">${cmd}</a>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#000;padding:0;">

<!-- Content -->
<div style="padding:24px;">
${hasList ? `<table style="border-collapse:collapse;">${content}</table>` : content}
</div>

<!-- Quick Commands -->
<div style="padding:0 24px 16px;">
<p style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:1.5px;margin:0 0 8px;">REPLY WITH A COMMAND</p>
${commandPills}
</div>

<!-- Wallet Pass -->
<div style="padding:0 24px 24px;">
<a href="https://thekickback.net/wallet/pass" style="display:block;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">📲 Add to Apple / Google Wallet</a>
<p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:8px 0 0;">Live updates on your lock screen</p>
</div>

<!-- Footer -->
<div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px 32px;text-align:center;">
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0 0 4px;">powered by theKickBack</p>
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;"><a href="https://thekickback.net" style="color:rgba(255,255,255,0.25);text-decoration:underline;">thekickback.net</a> · <a href="#" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Unsubscribe</a></p>
</div>

</div>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Utilities ───────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
