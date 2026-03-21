// ─── Types ───────────────────────────────────────────────────────

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  OPENCLAW_HOOKS_TOKEN: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  VENUE_EMAIL_DOMAIN: string;
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

interface VenuePage {
  slug: string;
  venue_id: string;
}

interface Session {
  id: string;
  user_id: string;
  venue_id: string;
  started_at: string;
  status: string;
}

interface AskUserContext {
  isRegistered: boolean;
  email: string;
  displayName: string | null;
  tier: string;
  kickbackScore: number;
  streak: number;
  venueProfiles: { venueName: string; xp: number; visits: number }[];
  threadHistory: { role: string; body: string }[];
}

interface VenueOffering {
  name: string;
  type: string;
  price_cents: number | null;
  venue_name: string;
}

interface DigitalAssetRow {
  name: string;
  asset_type: string;
  xp_cost: number;
  venue_name: string;
}

// ─── Worker Entry (HTTP only — no CF Email handler) ──────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "email-worker", provider: "resend" });
    }

    // Resend inbound webhook
    if (request.method === "POST" && url.pathname === "/inbound") {
      return handleInbound(request, env);
    }

    // Manual test trigger for ask@ digest
    if (request.method === "POST" && url.pathname === "/trigger-ask") {
      return handleTriggerAsk(request, env);
    }

    // Send a welcome email (called from join-app or API)
    if (request.method === "POST" && url.pathname === "/send/welcome") {
      return handleSendWelcome(request, env);
    }

    // Send any email (internal API)
    if (request.method === "POST" && url.pathname === "/send") {
      return handleSend(request, env);
    }

    return new Response("theKickBack Email Service", { status: 200 });
  },
};

// ─── Resolve venue from "to" address ─────────────────────────────

async function resolveVenueFromTo(toAddresses: string[], env: Env): Promise<Venue | null> {
  for (const addr of toAddresses) {
    const lower = addr.toLowerCase().trim();

    // venue-slug@thekickback.net → look up venue by slug
    if (lower.endsWith(`@${env.VENUE_EMAIL_DOMAIN}`)) {
      const slug = lower.split("@")[0];
      if (slug && slug !== "join" && slug !== "noreply" && slug !== "ask") {
        const venue = await getVenueBySlug(slug, env);
        if (venue) return venue;
      }
    }
  }

  // Fallback: first active venue (for join@chat.thekickback.net)
  return getDefaultVenue(env);
}

function replyFromAddress(venue: Venue | null, env: Env): string {
  if (venue) {
    // Use venue slug as email local part on the main domain
    const slug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${slug}@${env.VENUE_EMAIL_DOMAIN}`;
  }
  return env.EMAIL_FROM;
}

function replyFromName(venue: Venue | null): string {
  return venue ? venue.name : "theKickBack";
}

// ─── Resend Inbound Webhook ──────────────────────────────────────

async function handleInbound(request: Request, env: Env): Promise<Response> {
  const webhook = await request.json() as {
    type: string;
    data: {
      email_id: string;
      from: string;
      to: string[];
      subject: string;
      created_at: string;
    };
  };

  if (webhook.type !== "email.received") {
    return Response.json({ ok: true, skipped: true });
  }

  const fromEmail = webhook.data.from;
  const toAddresses = webhook.data.to || [];
  const emailId = webhook.data.email_id;
  const subject = webhook.data.subject || "";

  console.log(`Inbound from: ${fromEmail} | To: ${toAddresses.join(", ")} | Subject: "${subject}" | ID: ${emailId}`);

  // ── Check if this is an ask@thekickback.net email ──
  const isAsk = toAddresses.some((addr) => addr.toLowerCase().trim().startsWith("ask@"));
  if (isAsk) {
    // Fetch full email body
    let body = subject;
    const emailRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (emailRes.ok) {
      const emailData = await emailRes.json() as { text?: string; subject?: string };
      body = (emailData.text || emailData.subject || subject).trim();
    }
    body = body.split("\n").filter((l: string) => !l.startsWith(">") && !l.startsWith("On ") && l.trim() !== "").join("\n").trim();
    return handleAskDigest(fromEmail, body, env);
  }

  // ── Regular venue email flow ──
  const venue = await resolveVenueFromTo(toAddresses, env);

  // Fetch full email content from Resend API
  const emailRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });

  let body = subject; // fallback to subject
  if (emailRes.ok) {
    const emailData = await emailRes.json() as { text?: string; subject?: string };
    body = (emailData.text || emailData.subject || subject).trim();
  }

  // Strip reply quotes (lines starting with >)
  body = body.split("\n").filter((l: string) => !l.startsWith(">") && !l.startsWith("On ") && l.trim() !== "").join("\n").trim();
  // Take first meaningful line as the command
  const firstLine = body.split("\n")[0]?.trim() || body;

  console.log(`Parsed body: "${firstLine}" | Venue: ${venue?.name || "default"}`);

  // Log inbound guest email to chat_messages
  if (venue) {
    await supa(env, "chat_messages", {
      method: "POST",
      body: JSON.stringify({
        venue_id: venue.id,
        sender_type: "guest",
        sender_phone: fromEmail,
        body: firstLine,
      }),
    });
  }

  // Process command with venue context
  const reply = await handleCommand(fromEmail, firstLine, venue, env);

  // Log AI reply to chat_messages
  if (venue) {
    await supa(env, "chat_messages", {
      method: "POST",
      body: JSON.stringify({
        venue_id: venue.id,
        sender_type: "ai",
        sender_phone: null,
        body: reply,
      }),
    });
  }

  // Send rich HTML reply from the venue's email address
  const command = firstLine.toLowerCase().trim().split(/\s+/)[0];
  const replySubject = buildSubject(command, subject, venue);
  const fromAddr = replyFromAddress(venue, env);
  const fromName = replyFromName(venue);
  const html = buildRichHtml(reply, command, fromAddr);

  await sendViaResend(env, fromEmail, replySubject, html, reply, fromAddr, fromName);

  console.log(`Reply sent to ${fromEmail} from ${fromAddr}`);
  return Response.json({ ok: true, from: fromEmail, venue: venue?.name, command });
}

// ─── ask@thekickback.net — KickBack Score Digest Channel ─────────

const ASK_CHANNEL_ID = "ask-channel";

async function gatherAskContext(fromEmail: string, userMessage: string, env: Env): Promise<AskUserContext> {
  // Look up user by email
  const profiles = (await supa(env, `profiles?email=eq.${encodeURIComponent(fromEmail)}&limit=1`)) as {
    id: string; display_name: string | null; email: string;
  }[] | null;

  const isRegistered = !!(profiles && profiles.length > 0);
  const profile = profiles?.[0];

  let tier = "explorer";
  let kickbackScore = 0;
  let streak = 0;
  let venueProfiles: { venueName: string; xp: number; visits: number }[] = [];

  if (isRegistered && profile) {
    // Get score/tier
    const balances = (await supa(env, `point_balances?user_id=eq.${profile.id}&select=tier,kickback_score,current_streak`)) as {
      tier: string; kickback_score: number; current_streak: number;
    }[] | null;
    const b = balances?.[0];
    if (b) { tier = b.tier; kickbackScore = b.kickback_score; streak = b.current_streak; }

    // Get top venues
    const venueXp = (await supa(env, `user_venue_xp?user_id=eq.${profile.id}&select=xp,visits,venues(name)&order=xp.desc&limit=5`)) as {
      xp: number; visits: number; venues: { name: string } | { name: string }[];
    }[] | null;
    venueProfiles = (venueXp || []).map((v) => ({
      venueName: Array.isArray(v.venues) ? v.venues[0]?.name : v.venues?.name || "Venue",
      xp: v.xp,
      visits: v.visits,
    }));
  }

  // Thread history — skip for now since chat_messages.venue_id is UUID
  // TODO: create a dedicated ask_threads table or use a real UUID for the ask channel
  const threadHistory: { role: string; body: string }[] = [];

  return {
    isRegistered,
    email: fromEmail,
    displayName: profile?.display_name || null,
    tier,
    kickbackScore,
    streak,
    venueProfiles,
    threadHistory,
  };
}

async function handleAskDigest(fromEmail: string, userMessage: string, env: Env): Promise<Response> {
  console.log(`[ASK] Inbound from: ${fromEmail} | Message: "${userMessage.slice(0, 100)}"`);

  // Gather user context
  const ctx = await gatherAskContext(fromEmail, userMessage, env);

  // Get city snapshot — active venues
  const venues = (await supa(env, "venues?state=eq.active&select=name,vibe,occupancy,max_occupancy,neighborhood&limit=20")) as {
    name: string; vibe: string; occupancy: number; max_occupancy: number; neighborhood: string | null;
  }[] | null;
  const venueSnapshot = (venues || []).map((v) =>
    `${v.name} (${v.vibe}, ${v.occupancy}/${v.max_occupancy}${v.neighborhood ? `, ${v.neighborhood}` : ""})`
  ).join("; ");

  // Get active offerings across all venues
  const offerings = (await supa(env, "venue_offerings?active=eq.true&select=name,type,price_cents,venues(name)&limit=15")) as {
    name: string; type: string; price_cents: number | null; venues: { name: string } | { name: string }[];
  }[] | null;
  const offeringsStr = (offerings || []).map((o) => {
    const vName = Array.isArray(o.venues) ? o.venues[0]?.name : o.venues?.name || "";
    return `${o.name} (${o.type}${vName ? ` at ${vName}` : ""})`.trim();
  }).join("; ");

  // Digital assets — table may not exist yet, skip gracefully
  const assetsStr = "";

  // Log user message — skipped until ask_threads table exists
  console.log(`[ASK] User (${fromEmail}): ${userMessage.slice(0, 200)}`);

  // Build OpenClaw prompt
  const isFirstMessage = ctx.threadHistory.length === 0;
  const threadStr = ctx.threadHistory.map((m) => `${m.role === "user" ? "User" : "KickBack"}: ${m.body}`).join("\n");

  let prompt: string;
  if (ctx.isRegistered) {
    const firstName = ctx.displayName || fromEmail.split("@")[0];
    const venueXpStr = ctx.venueProfiles.length > 0
      ? ctx.venueProfiles.map((v) => `${v.venueName}: ${v.xp} XP, ${v.visits} visits`).join("; ")
      : "No venues visited yet";

    if (isFirstMessage) {
      prompt = [
        "You are theKickBack — a city discovery platform. Write a personalized KickBack Score digest for this user.",
        `User: ${firstName}`,
        `Tier: ${ctx.tier} | Score: ${ctx.kickbackScore} | Streak: ${ctx.streak} weeks`,
        `Their top venues: ${venueXpStr}`,
        `Active spots right now: ${venueSnapshot}`,
        offeringsStr ? `Available offerings & events: ${offeringsStr}` : "",
        assetsStr ? `Collectibles they could earn: ${assetsStr}` : "",
        "",
        "Write an email that:",
        userMessage && userMessage.length > 3 ? `- Answers their question: "${userMessage}"` : "- Gives them a rundown of what's happening",
        "- Frames EVERYTHING around how it grows their KickBack Score",
        "- Suggests 2-3 specific things they could do right now to earn XP",
        "- Mentions specific venues by name with what's happening there",
        "- Tells them how close they are to the next tier",
        "- Keep it under 200 words. Warm, conversational, like a friend who knows the city inside out.",
        "- No emojis. No HTML. Just plain text paragraphs.",
        "- End with 'Reply to this email if you want to know more about anything.'",
      ].filter(Boolean).join("\n");
    } else {
      prompt = [
        "You are theKickBack. Continue this conversation about growing KickBack Score.",
        `User: ${firstName} | Tier: ${ctx.tier} | Score: ${ctx.kickbackScore}`,
        `Their venues: ${venueXpStr}`,
        `Active spots: ${venueSnapshot}`,
        offeringsStr ? `Offerings: ${offeringsStr}` : "",
        assetsStr ? `Collectibles: ${assetsStr}` : "",
        "",
        "Previous conversation:",
        threadStr,
        "",
        `User's new message: "${userMessage}"`,
        "",
        "Go deeper on what they're asking. Be specific about XP opportunities, venues, and how it impacts their score.",
        "Keep it under 150 words. Conversational. No emojis. No HTML.",
        "End with an invitation to keep the thread going.",
      ].filter(Boolean).join("\n");
    }
  } else {
    // Guest — unregistered email
    if (isFirstMessage) {
      prompt = [
        "You are theKickBack — a city discovery platform. Someone who isn't on the platform yet just emailed ask@thekickback.net.",
        `Their email: ${fromEmail}`,
        `Active spots right now: ${venueSnapshot}`,
        offeringsStr ? `Offerings happening: ${offeringsStr}` : "",
        "",
        "Write a warm, intriguing email that:",
        userMessage && userMessage.length > 3 ? `- Addresses their question: "${userMessage}"` : "- Gives them a taste of what's happening in the city",
        "- Explains what KickBack Score is (your reputation across venues — check in, earn XP, unlock perks)",
        "- Highlights 2-3 interesting things happening at specific venues",
        "- Makes them curious enough to start exploring",
        "- Keep it under 150 words. Conversational, not salesy. Like a friend giving the lowdown.",
        "- No emojis. No HTML. Plain text.",
        "- End with: 'Start building your score at join.thekickback.net — or just reply here and ask me anything.'",
      ].filter(Boolean).join("\n");
    } else {
      prompt = [
        "You are theKickBack. Continue this conversation with someone who hasn't signed up yet.",
        `Active spots: ${venueSnapshot}`,
        offeringsStr ? `Offerings: ${offeringsStr}` : "",
        "",
        "Previous conversation:",
        threadStr,
        "",
        `Their new message: "${userMessage}"`,
        "",
        "Answer their question. Give specific venue and event details.",
        "Gently remind them they could be earning XP for all this if they had an account.",
        "Under 150 words. Conversational. No emojis. No HTML.",
      ].filter(Boolean).join("\n");
    }
  }

  // Call OpenClaw
  const aiReply = await askClaw(prompt, fromEmail, ASK_CHANNEL_ID, env);

  // Log AI reply — skipped until ask_threads table exists
  console.log(`[ASK] AI reply (${aiReply.length} chars): ${aiReply.slice(0, 200)}`);

  // Build HTML email
  const askFrom = `ask@${env.VENUE_EMAIL_DOMAIN}`;
  const subject = ctx.isRegistered
    ? (isFirstMessage ? `Your KickBack Score ✦ ${ctx.tier}` : "Re: Your KickBack Score ✦")
    : (isFirstMessage ? "What's happening in the city ✦" : "Re: What's happening in the city ✦");

  const html = ctx.isRegistered
    ? buildAskRegisteredHtml(aiReply, ctx, askFrom)
    : buildAskGuestHtml(aiReply, askFrom);

  await sendViaResend(env, fromEmail, subject, html, aiReply, askFrom, "theKickBack");

  console.log(`[ASK] Reply sent to ${fromEmail} (${ctx.isRegistered ? ctx.tier : "guest"})`);
  return Response.json({ ok: true, channel: "ask", from: fromEmail, registered: ctx.isRegistered });
}

// ─── Ask Channel HTML Templates ──────────────────────────────────

function buildAskRegisteredHtml(body: string, ctx: AskUserContext, replyTo: string): string {
  const tierColors: Record<string, string> = {
    explorer: "#94a3b8", regular: "#4ade80", member: "#f97316", vip: "#a78bfa",
  };
  const tierColor = tierColors[ctx.tier] || "#94a3b8";
  const firstName = ctx.displayName || ctx.email.split("@")[0];

  const paragraphs = body.split("\n").filter((l) => l.trim()).map((p) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#e0e0e0;">${esc(p)}</p>`
  ).join("");

  const venueBadges = ctx.venueProfiles.length > 0
    ? ctx.venueProfiles.map((v) =>
      `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:11px;color:#fff;">${esc(v.venueName)} <span style="color:rgba(255,255,255,0.3);">${v.xp} XP</span></span>`
    ).join("")
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;">

  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.4);">THEKICKBACK</span>
  </div>

  <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
    <div style="margin-bottom:8px;">
      <span style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,0.3);font-weight:600;">KICKBACK SCORE</span>
      <span style="float:right;font-size:18px;font-weight:700;color:${tierColor};">${ctx.kickbackScore.toLocaleString()}</span>
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
      <div style="height:100%;width:${Math.min((ctx.kickbackScore / 5000) * 100, 100)}%;background:${tierColor};border-radius:3px;"></div>
    </div>
    <div style="margin-top:6px;">
      <span style="font-size:10px;color:rgba(255,255,255,0.2);text-transform:uppercase;letter-spacing:1px;">${ctx.tier}</span>
      ${ctx.streak > 0 ? `<span style="float:right;font-size:10px;color:#f97316;">streak: ${ctx.streak}w</span>` : ""}
    </div>
  </div>

  ${paragraphs}

  ${venueBadges ? `<div style="margin:16px 0;">
    <div style="font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.2);font-weight:600;margin-bottom:6px;">YOUR SPOTS</div>
    ${venueBadges}
  </div>` : ""}

  <div style="text-align:center;margin:28px 0;">
    <a href="https://join.thekickback.net/map" style="display:inline-block;padding:12px 32px;background:#a78bfa;color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:50px;">Open KickBack</a>
  </div>

  <div style="text-align:center;margin:16px 0;">
    <p style="font-size:12px;color:rgba(255,255,255,0.25);">Reply to keep the conversation going</p>
  </div>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;margin-top:24px;text-align:center;">
    <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:0;">powered by theKickBack<br/>
    <a href="mailto:${replyTo}" style="color:rgba(255,255,255,0.25);text-decoration:underline;">ask@thekickback.net</a></p>
  </div>

</div></body></html>`;
}

function buildAskGuestHtml(body: string, replyTo: string): string {
  const paragraphs = body.split("\n").filter((l) => l.trim()).map((p) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#e0e0e0;">${esc(p)}</p>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;">

  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.4);">THEKICKBACK</span>
  </div>

  ${paragraphs}

  <div style="margin:24px 0;padding:16px;background:rgba(167,139,250,0.06);border-radius:12px;border:1px solid rgba(167,139,250,0.15);text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;color:#a78bfa;font-weight:600;">What's your KickBack Score?</p>
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.5;">Every venue you visit builds your score. Unlock perks, collect badges, and shape your neighborhood.</p>
    <a href="https://join.thekickback.net/map" style="display:inline-block;padding:12px 32px;background:#a78bfa;color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:50px;">Start exploring</a>
  </div>

  <div style="text-align:center;margin:16px 0;">
    <p style="font-size:12px;color:rgba(255,255,255,0.25);">Reply to keep asking — no account needed</p>
  </div>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;margin-top:24px;text-align:center;">
    <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:0;">powered by theKickBack<br/>
    <a href="mailto:${replyTo}" style="color:rgba(255,255,255,0.25);text-decoration:underline;">ask@thekickback.net</a></p>
  </div>

</div></body></html>`;
}

// ─── Test trigger for ask@ digest ────────────────────────────────

async function handleTriggerAsk(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const message = url.searchParams.get("message") || "What's happening in the city?";
  if (!email) return Response.json({ error: "email param required" }, { status: 400 });
  return handleAskDigest(email, message, env);
}

// ─── Send Welcome Email (called from join-app) ──────────────────

async function handleSendWelcome(request: Request, env: Env): Promise<Response> {
  const data = await request.json() as {
    to: string;
    venueName: string;
    venueSlug: string;
    vibe: string;
    occupancy: number;
    maxOccupancy: number;
    themeColor: string;
    tagline: string;
    rules: string[];
    walletPassUrl: string;
  };

  const vibeLabel = capitalize(data.vibe);
  const vibeColor = data.vibe === "quiet" ? "#4ADE80" : data.vibe === "moderate" ? "#FACC15" : data.vibe === "busy" ? "#F97316" : "#EF4444";
  const spotsOpen = Math.max(0, data.maxOccupancy - data.occupancy);

  // Reply-to is the venue-specific address
  const venueEmail = `${data.venueSlug}@${env.VENUE_EMAIL_DOMAIN}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#000;">

<!-- Hero gradient -->
<div style="height:180px;background:linear-gradient(to bottom,transparent,${data.themeColor});border-radius:0 0 16px 16px;"></div>

<!-- LIVE Badge + Name -->
<div style="padding:0 24px;">
<div style="display:inline-block;background:${data.themeColor};border-radius:999px;padding:3px 10px;margin-bottom:8px;">
<span style="color:#000;font-size:10px;font-weight:700;letter-spacing:1.5px;">● LIVE</span>
</div>
<h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 4px;line-height:1.1;">${esc(data.venueName)}</h1>
<p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0;">${esc(data.tagline)}</p>
</div>

<!-- Stats -->
<div style="padding:16px 24px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="background:#1A1A1A;border-radius:12px;padding:12px;width:33%;">
<span style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;letter-spacing:1.5px;">VIBE</span><br/>
<span style="color:${vibeColor};font-size:18px;font-weight:700;">${vibeLabel}</span>
</td>
<td width="12"></td>
<td style="background:#1A1A1A;border-radius:12px;padding:12px;width:33%;">
<span style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;letter-spacing:1.5px;">PEOPLE</span><br/>
<span style="color:#fff;font-size:18px;font-weight:700;">${data.occupancy} / ${data.maxOccupancy}</span>
</td>
<td width="12"></td>
<td style="background:#1A1A1A;border-radius:12px;padding:12px;width:33%;">
<span style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;letter-spacing:1.5px;">OPEN</span><br/>
<span style="color:#fff;font-size:18px;font-weight:700;">${spotsOpen} spots</span>
</td>
</tr></table>
</div>

<!-- Welcome -->
<div style="padding:0 24px;">
<h2 style="color:#fff;font-size:18px;font-weight:600;margin:0 0 8px;">You're in.</h2>
<p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 20px;">Reply to this email anytime to interact with ${esc(data.venueName)}. Just type a command and we'll handle the rest.</p>
</div>

<!-- Action buttons -->
<div style="padding:0 24px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="49%"><a href="mailto:${venueEmail}?subject=MENU&body=MENU" style="display:block;background:${data.themeColor};border-radius:12px;padding:14px 0;color:#000;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">Menu</a></td>
<td width="2%"></td>
<td width="49%"><a href="mailto:${venueEmail}?subject=REQUEST&body=REQUEST a booth" style="display:block;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 0;color:rgba(255,255,255,0.5);font-size:14px;font-weight:500;text-decoration:none;text-align:center;">Reserve</a></td>
</tr></table>
</div>

<!-- Wallet Pass -->
<div style="padding:20px 24px;">
<a href="${data.walletPassUrl}" style="display:block;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Add to Apple / Google Wallet</a>
<p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:8px 0 0;">Live updates on your lock screen</p>
</div>

<!-- Commands -->
<div style="padding:0 24px 16px;">
<p style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:1.5px;margin:0 0 8px;">REPLY WITH ANY COMMAND</p>
${"MENU,ASK,REQUEST,STATUS,LEAVE,MEMBERSHIP".split(",").map(c => `<a href="mailto:${venueEmail}?subject=${c}&body=${c}" style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 12px;color:rgba(255,255,255,0.5);font-size:12px;font-family:monospace;text-decoration:none;margin:0 4px 4px 0;">${c}</a>`).join("")}
</div>

${data.rules.length > 0 ? `
<!-- Rules -->
<div style="padding:0 24px 16px;">
<p style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:1.5px;margin:0 0 8px;">HOUSE RULES</p>
${data.rules.map(r => `<p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 4px;">• ${esc(r)}</p>`).join("")}
</div>` : ""}

<!-- Footer -->
<div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px 32px;text-align:center;">
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0 0 4px;">powered by theKickBack</p>
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;"><a href="https://join.thekickback.net/${data.venueSlug}" style="color:rgba(255,255,255,0.25);text-decoration:underline;">View venue</a> · <a href="#" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Unsubscribe</a></p>
</div>

</div></body></html>`;

  const text = `Welcome to ${data.venueName}! ${capitalize(data.vibe)} right now — ${data.occupancy} people. Reply MENU, ASK, REQUEST, or STATUS anytime.`;

  await sendViaResend(env, data.to, `Welcome to ${data.venueName} ✦`, html, text, venueEmail, data.venueName);

  return Response.json({ ok: true, sent: data.to });
}

// ─── Generic Send ────────────────────────────────────────────────

async function handleSend(request: Request, env: Env): Promise<Response> {
  const data = await request.json() as { to: string; subject: string; html: string; text: string };
  await sendViaResend(env, data.to, data.subject, data.html, data.text, env.EMAIL_FROM, "theKickBack");
  return Response.json({ ok: true });
}

// ─── Resend API ──────────────────────────────────────────────────

async function sendViaResend(env: Env, to: string, subject: string, html: string, text: string, fromAddr: string, fromName: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddr}>`,
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

// ─── Supabase helpers ────────────────────────────────────────────

async function supa(env: Env, path: string, options: RequestInit = {}) {
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
  // Try by email first, then by phone (legacy)
  const byEmail = (await supa(env, `profiles?email=eq.${encodeURIComponent(identifier)}&limit=1`)) as Profile[] | null;
  if (byEmail && byEmail.length > 0) return byEmail[0];

  const byPhone = (await supa(env, `profiles?phone=eq.${encodeURIComponent(identifier)}&limit=1`)) as Profile[] | null;
  if (byPhone && byPhone.length > 0) return byPhone[0];

  // Create with email
  const created = (await supa(env, "profiles", { method: "POST", body: JSON.stringify({ phone: identifier, email: identifier }) })) as Profile[] | null;
  if (created && created.length > 0) return created[0];
  throw new Error("Failed to create profile");
}

async function getDefaultVenue(env: Env): Promise<Venue | null> {
  const venues = (await supa(env, "venues?state=eq.active&limit=1")) as Venue[] | null;
  return venues && venues.length > 0 ? venues[0] : null;
}

async function getVenueBySlug(slug: string, env: Env): Promise<Venue | null> {
  // Look up venue_pages by slug, then get the venue
  const pages = (await supa(env, `venue_pages?slug=eq.${encodeURIComponent(slug)}&select=venue_id`)) as VenuePage[] | null;
  if (!pages || pages.length === 0) return null;
  return getVenueById(pages[0].venue_id, env);
}

async function getActiveSession(userId: string, env: Env): Promise<Session | null> {
  const sessions = (await supa(env, `sessions?user_id=eq.${userId}&status=eq.active&order=started_at.desc&limit=1`)) as Session[] | null;
  return sessions && sessions.length > 0 ? sessions[0] : null;
}

async function getVenueById(venueId: string, env: Env): Promise<Venue | null> {
  const venues = (await supa(env, `venues?id=eq.${venueId}&limit=1`)) as Venue[] | null;
  return venues && venues.length > 0 ? venues[0] : null;
}

// ─── Command Router ──────────────────────────────────────────────

async function handleCommand(from: string, body: string, venue: Venue | null, env: Env): Promise<string> {
  const raw = body.toLowerCase().trim();
  const command = raw.split(/\s+/)[0];
  const args = raw.slice(command.length).trim();

  try {
    const profile = await getOrCreateProfile(from, env);
    switch (command) {
      case "join": return handleJoin(profile, venue, env);
      case "ask": return handleAsk(profile, args, venue, env);
      case "request": return handleRequest(profile, args, venue, env);
      case "menu": return handleMenu(venue, env);
      case "hold": return handleHold(profile, args, venue, env);
      case "status": return handleStatus(profile, env);
      case "leave": return handleLeave(profile, env);
      case "membership": return handleMembership(profile, venue, env);
      case "yes": return handleMembershipConfirm(profile, venue, env);
      default: return handleFreeform(profile, raw, venue, env);
    }
  } catch (err) {
    console.error("Command error:", err);
    return "Something went wrong. Try again or send STATUS.";
  }
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleJoin(profile: Profile, venue: Venue | null, env: Env): Promise<string> {
  const existing = await getActiveSession(profile.id, env);
  if (existing) {
    const v = await getVenueById(existing.venue_id, env);
    return `You're already in ${v?.name || "a venue"}. Send STATUS or LEAVE.`;
  }
  if (!venue) return "No venues are active right now. Try again later.";
  await supa(env, "sessions", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, status: "active" }) });
  await supa(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy + 1 }) });
  const rulesText = Array.isArray(venue.rules) ? venue.rules.map((r: string) => `  - ${r}`).join("\n") : "";
  return [`Welcome to ${venue.name}. ${capitalize(venue.vibe)} right now — ${venue.occupancy + 1} people.`, "", "You're in as a Guest. Send MENU, REQUEST, or ASK anytime.", rulesText ? `\nHouse rules:\n${rulesText}` : ""].join("\n").trim();
}

async function handleAsk(profile: Profile, question: string, venue: Venue | null, env: Env): Promise<string> {
  if (!question) return "What do you want to ask? Send ASK followed by your question.";

  // If emailed a venue directly, use that venue even without a session
  const session = await getActiveSession(profile.id, env);
  const v = session ? await getVenueById(session.venue_id, env) : venue;
  if (!v) return "You're not in a venue. Send JOIN first.";

  // Auto-join if they emailed a venue but don't have a session
  if (!session && v) {
    await supa(env, "sessions", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: v.id, status: "active" }) });
    await supa(env, `venues?id=eq.${v.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: v.occupancy + 1 }) });
  }

  const knowledge = await getVenueKnowledge(v.id, env);
  return askClaw(
    [
      `You are the AI agent for ${v.name}. Respond as the venue.`,
      knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
      `A guest asks: "${question}". Venue is ${v.vibe}, ${v.occupancy} people. 1-2 sentences. No emojis.`,
    ].filter(Boolean).join(" "),
    profile.phone || profile.id,
    v.id,
    env
  );
}

async function askClaw(message: string, userIdentifier: string, venueId: string, env: Env): Promise<string> {
  try {
    const res = await fetch(`${env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": venueId ? `venue-${venueId}` : "main",
      },
      body: JSON.stringify({ model: "openclaw", input: message, user: userIdentifier }),
    });
    if (res.ok) {
      const data = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
      const msg = data.output?.find((o) => o.type === "message");
      const text = msg?.content?.find((c) => c.type === "output_text")?.text;
      if (text) return text;
    }
  } catch (err) { console.error("Claw error:", err); }
  return "Couldn't reach the venue right now. Try again in a moment.";
}

async function getVenueKnowledge(venueId: string, env: Env): Promise<string> {
  const data = (await supa(env, `venue_knowledge?venue_id=eq.${venueId}&order=category`)) as { content: string; category: string }[] | null;
  if (!data || data.length === 0) return "";

  const grouped: Record<string, string[]> = {};
  for (const row of data) {
    const cat = row.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(row.content);
  }

  return Object.entries(grouped)
    .map(([cat, items]) => `[${cat}]\n${items.join("\n")}`)
    .join("\n\n");
}

async function handleRequest(profile: Profile, what: string, venue: Venue | null, env: Env): Promise<string> {
  if (!what) return "What would you like? e.g. REQUEST a booth near the window";
  const session = await getActiveSession(profile.id, env);

  // Auto-join if they emailed a venue directly
  if (!session && venue) {
    await supa(env, "sessions", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, status: "active" }) });
    await supa(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy + 1 }) });
    const newSession = await getActiveSession(profile.id, env);
    if (newSession) return createRequest(profile, newSession, what, venue, env);
  }

  if (!session) return "You're not in a venue. Send JOIN first.";
  const v = await getVenueById(session.venue_id, env);
  return createRequest(profile, session, what, v, env);
}

async function createRequest(profile: Profile, session: Session, what: string, venue: Venue | null, env: Env): Promise<string> {
  const lower = what.toLowerCase();
  const type = lower.includes("booth") || lower.includes("table") ? "booth" : lower.includes("drink") || lower.includes("food") ? "order" : "service";
  await supa(env, "requests", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: session.venue_id, session_id: session.id, type, body: what, status: "pending" }) });
  return `Request sent to ${venue?.name || "the venue"}: "${what}"`;
}

async function handleMenu(venue: Venue | null, env: Env): Promise<string> {
  const v = venue || await getDefaultVenue(env);
  if (!v) return "No venue info available.";
  return `${v.name} — Menu\n\nDrinks: espresso, matcha, cold brew, sparkling water\nFood: avocado toast, grain bowl, pastry basket\n\nSend REQUEST + item to order.`;
}

async function handleHold(profile: Profile, what: string, venue: Venue | null, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session && venue) {
    await supa(env, "sessions", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, status: "active" }) });
    await supa(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy + 1 }) });
  }
  const s = await getActiveSession(profile.id, env);
  if (!s) return "You're not in a venue. Send JOIN first.";
  await supa(env, "requests", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: s.venue_id, session_id: s.id, type: "booth", body: what || "Hold a booth", status: "pending" }) });
  return "Hold request sent. We'll reply when confirmed.";
}

async function handleStatus(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue. Send JOIN to enter one.";
  const venue = await getVenueById(session.venue_id, env);
  const reqs = (await supa(env, `requests?user_id=eq.${profile.id}&session_id=eq.${session.id}&status=eq.pending`)) as { id: string }[] | null;
  const mins = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
  const memberships = (await supa(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${session.venue_id}&limit=1`)) as { tier: string }[] | null;
  const tier = memberships && memberships.length > 0 ? memberships[0].tier : "Guest";
  return `${venue?.name || "Venue"} — Your session\n\nStatus: ${capitalize(tier)}\nVibe: ${capitalize(venue?.vibe || "?")} (${venue?.occupancy} people)\nTime: ${mins} min\nPending: ${reqs?.length || 0}`;
}

async function handleLeave(profile: Profile, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  if (!session) return "You're not in a venue right now.";
  const venue = await getVenueById(session.venue_id, env);
  await supa(env, `sessions?id=eq.${session.id}`, { method: "PATCH", body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }) });
  if (venue && venue.occupancy > 0) await supa(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy - 1 }) });
  return `You've left ${venue?.name || "the venue"}. Send JOIN anytime to come back.`;
}

async function handleMembership(profile: Profile, venue: Venue | null, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const v = session ? await getVenueById(session.venue_id, env) : (venue || await getDefaultVenue(env));
  if (!v) return "No venue available.";
  const existing = (await supa(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${v.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `Already a ${existing[0].tier} member at ${v.name}.`;
  return `${v.name} Membership\n\n-> Priority booths\n-> Skip the wait\n-> Members-only events\n-> $25/month\n\nReply YES to join.`;
}

async function handleMembershipConfirm(profile: Profile, venue: Venue | null, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);
  const v = session ? await getVenueById(session.venue_id, env) : (venue || await getDefaultVenue(env));
  if (!v) return "No venue available.";
  const existing = (await supa(env, `memberships?user_id=eq.${profile.id}&venue_id=eq.${v.id}&limit=1`)) as { tier: string }[] | null;
  if (existing && existing.length > 0) return `Already a ${existing[0].tier} member at ${v.name}.`;
  await supa(env, "memberships", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: v.id, tier: "member" }) });
  return `You're in. Welcome to ${v.name}, member. Send STATUS anytime.`;
}

async function handleFreeform(profile: Profile, raw: string, venue: Venue | null, env: Env): Promise<string> {
  const session = await getActiveSession(profile.id, env);

  // If they emailed a venue directly, auto-join and ask
  if (!session && venue) {
    await supa(env, "sessions", { method: "POST", body: JSON.stringify({ user_id: profile.id, venue_id: venue.id, status: "active" }) });
    await supa(env, `venues?id=eq.${venue.id}`, { method: "PATCH", body: JSON.stringify({ occupancy: venue.occupancy + 1 }) });
    const knowledge = await getVenueKnowledge(venue.id, env);
    return askClaw(
      [
        `You are the AI agent for ${venue.name}. Respond as the venue.`,
        knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
        `A new guest just emailed saying: "${raw}". Venue is ${venue.vibe}, ${venue.occupancy + 1} people. Welcome them and answer. Concise. No emojis.`,
      ].filter(Boolean).join(" "),
      profile.phone || profile.id,
      venue.id,
      env
    );
  }

  if (session) {
    const v = await getVenueById(session.venue_id, env);
    const knowledge = v ? await getVenueKnowledge(v.id, env) : "";
    return askClaw(
      [
        `You are the AI agent for ${v?.name || "the venue"}. Respond as the venue.`,
        knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
        `Guest sent: "${raw}". Venue is ${v?.vibe}, ${v?.occupancy} people. Concise. No emojis.`,
      ].filter(Boolean).join(" "),
      profile.phone || profile.id,
      v?.id || "",
      env
    );
  }

  return "Hey! Send JOIN to enter a venue, or email a venue directly at venue-name@thekickback.net.\n\nCommands: JOIN, ASK, REQUEST, STATUS, LEAVE, MEMBERSHIP";
}

// ─── Utilities ───────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSubject(command: string, originalSubject: string | undefined, venue: Venue | null): string {
  const name = venue?.name || "theKickBack";
  switch (command) {
    case "join": return `Welcome to ${name} ✦`;
    case "menu": return `${name} — Menu ✦`;
    case "status": return `${name} — Your session ✦`;
    case "request": return `${name} — Request sent ✦`;
    case "hold": return `${name} — Hold confirmed ✦`;
    case "leave": return `See you next time ✦`;
    case "membership": return `${name} — Membership ✦`;
    case "yes": return `Welcome, member ✦`;
    default: return `Re: ${originalSubject || name}`;
  }
}

function buildRichHtml(body: string, command: string, fromEmail: string): string {
  const lines = body.split("\n").filter(Boolean);
  const bodyHtml = lines.map((line) => {
    if (line.startsWith("  - ") || line.startsWith("-> ")) {
      return `<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 4px;padding-left:12px;">• ${esc(line.replace(/^(\s*-\s*|-> )/, ""))}</p>`;
    }
    if (line.includes(" — ") && lines.indexOf(line) === 0) {
      return `<h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;">${esc(line)}</h2>`;
    }
    return `<p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 6px;">${esc(line)}</p>`;
  }).join("");

  const pills = "MENU,ASK,REQUEST,STATUS,LEAVE".split(",").map(c =>
    `<a href="mailto:${fromEmail}?subject=${c}&body=${c}" style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 12px;color:rgba(255,255,255,0.5);font-size:12px;font-family:monospace;text-decoration:none;margin:0 4px 4px 0;">${c}</a>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#000;padding:24px;">
${bodyHtml}
</div>
<div style="max-width:480px;margin:0 auto;padding:0 24px 16px;">
<p style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:1.5px;margin:0 0 8px;">REPLY WITH A COMMAND</p>
${pills}
</div>
<div style="max-width:480px;margin:0 auto;padding:0 24px 24px;">
<a href="https://thekickback.net/wallet/pass" style="display:block;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Add to Wallet</a>
</div>
<div style="max-width:480px;margin:0 auto;border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px 32px;text-align:center;">
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;">powered by theKickBack</p>
</div>
</body></html>`;
}
