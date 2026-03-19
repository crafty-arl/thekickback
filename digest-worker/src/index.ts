// ─── KickBack Daily Digest ───────────────────────────────────────
// Sends personalized daily emails to users based on their preferences,
// venue activity, and the city's vibe. Runs on Cloudflare Workers cron.
//
// Cron triggers:
//   Daily digest:  0 14 * * *   (8 AM CT)
//   Weekly roundup: 0 14 * * 1  (Monday 8 AM CT)
// ─────────────────────────────────────────────────────────────────

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
}

interface UserDigestData {
  userId: string;
  email: string;
  displayName: string | null;
  tier: string;
  kickbackScore: number;
  streak: number;
  preferences: { category: string; key: string; value: string }[];
  venueProfiles: { venueName: string; xp: number; visits: number }[];
}

interface VenueSnapshot {
  id: string;
  name: string;
  vibe: string;
  occupancy: number;
  maxOccupancy: number;
  type: string;
  neighborhood: string | null;
}

// ─── Supabase helpers ────────────────────────────────────────────

async function supabaseGet(env: Env, path: string): Promise<unknown> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  return res.json();
}

// ─── Get all users who should receive digests ────────────────────

async function getDigestUsers(env: Env): Promise<UserDigestData[]> {
  // Get all profiles that have an email-like phone (email users) or actual email
  const profiles = (await supabaseGet(env, "profiles?select=id,phone,email,display_name&order=created_at.desc&limit=500")) as {
    id: string; phone: string; email: string | null; display_name: string | null;
  }[];

  const users: UserDigestData[] = [];

  for (const p of profiles) {
    // Determine email — phone field sometimes holds email
    const email = p.email || (p.phone.includes("@") ? p.phone : null);
    if (!email) continue;

    // Get preferences
    const prefs = (await supabaseGet(env, `user_preferences?user_id=eq.${p.id}&select=category,key,value&confidence=gte.0.3&limit=10`)) as {
      category: string; key: string; value: string;
    }[];

    // Get point balance
    const balances = (await supabaseGet(env, `point_balances?user_id=eq.${p.id}&select=tier,kickback_score,current_streak`)) as {
      tier: string; kickback_score: number; current_streak: number;
    }[];
    const balance = balances?.[0] || { tier: "explorer", kickback_score: 0, current_streak: 0 };

    // Get venue XP profiles
    const venueXp = (await supabaseGet(env, `user_venue_xp?user_id=eq.${p.id}&select=xp,visits,venues(name)&order=xp.desc&limit=5`)) as {
      xp: number; visits: number; venues: { name: string } | { name: string }[];
    }[];

    users.push({
      userId: p.id,
      email,
      displayName: p.display_name,
      tier: balance.tier,
      kickbackScore: balance.kickback_score,
      streak: balance.current_streak,
      preferences: prefs,
      venueProfiles: (venueXp || []).map((v) => ({
        venueName: Array.isArray(v.venues) ? v.venues[0]?.name : v.venues?.name || "Venue",
        xp: v.xp,
        visits: v.visits,
      })),
    });
  }

  return users;
}

// ─── Get active venue snapshots ──────────────────────────────────

async function getVenueSnapshots(env: Env): Promise<VenueSnapshot[]> {
  const venues = (await supabaseGet(env, "venues?state=eq.active&select=id,name,vibe,occupancy,max_occupancy,type,neighborhood")) as VenueSnapshot[];
  return venues || [];
}

// ─── Generate personalized digest content via AI ─────────────────

async function generateDigestContent(
  env: Env,
  user: UserDigestData,
  venues: VenueSnapshot[],
  isWeekly: boolean
): Promise<{ subject: string; body: string }> {
  const prefsStr = user.preferences.length > 0
    ? user.preferences.map((p) => `${p.category}: ${p.value}`).join(", ")
    : "No preferences known yet";

  const venuesStr = venues
    .map((v) => `${v.name} (${v.vibe}, ${v.occupancy}/${v.maxOccupancy})`)
    .join(", ");

  const venueXpStr = user.venueProfiles.length > 0
    ? user.venueProfiles.map((v) => `${v.venueName}: ${v.xp} XP, ${v.visits} visits`).join("; ")
    : "No venues visited yet";

  const prompt = isWeekly
    ? [
        "Write a SHORT weekly roundup email for a KickBack user.",
        `User: ${user.displayName || user.email.split("@")[0]}`,
        `Tier: ${user.tier} | Score: ${user.kickbackScore} | Streak: ${user.streak} weeks`,
        `Their preferences: ${prefsStr}`,
        `Their venues: ${venueXpStr}`,
        `Active venues this week: ${venuesStr}`,
        "",
        "The email should:",
        "- Open with a warm, casual greeting (like texting a friend)",
        "- Recap their week: XP earned, venues visited, streak status",
        "- Suggest 1-2 venues they haven't tried based on their preferences",
        "- Mention any upcoming events or multipliers",
        "- End with a CTA: 'Set your plans for the week'",
        "- Keep it under 150 words. No emojis. Conversational, not corporate.",
        "- Return ONLY the email body text. No subject line. No HTML.",
      ].join("\n")
    : [
        "Write a SHORT daily digest email for a KickBack user.",
        `User: ${user.displayName || user.email.split("@")[0]}`,
        `Tier: ${user.tier} | Score: ${user.kickbackScore}`,
        `Their preferences: ${prefsStr}`,
        `Active venues right now: ${venuesStr}`,
        "",
        "The email should:",
        "- Open casually — like a friend giving you the rundown",
        "- Highlight 2-3 venues that match their vibe/preferences",
        "- Mention the current energy (which spots are quiet, which are poppin)",
        "- Include one specific suggestion ('The Rooftop is quiet this morning — good for focus')",
        "- End with a soft CTA: 'What's your vibe today?'",
        "- Keep it under 100 words. No emojis. Direct, warm, not salesy.",
        "- Return ONLY the email body text. No subject line. No HTML.",
      ].join("\n");

  try {
    const res = await fetch(`${env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "digest-writer",
      },
      body: JSON.stringify({ model: "openclaw", input: prompt }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        output: { type: string; content: { type: string; text?: string }[] }[];
      };
      const msg = data.output?.find((o) => o.type === "message");
      const text = msg?.content?.find((c) => c.type === "output_text")?.text;
      if (text) {
        const subject = isWeekly
          ? "Your week on KickBack"
          : "What's happening today";
        return { subject, body: text.trim() };
      }
    }
  } catch (err) {
    console.error("Digest AI error:", err);
  }

  // Fallback if AI fails
  const firstName = user.displayName || user.email.split("@")[0];
  return {
    subject: isWeekly ? "Your week on KickBack" : "What's happening today",
    body: isWeekly
      ? `Hey ${firstName}. Quick recap: you're at ${user.kickbackScore} XP (${user.tier}). ${venues.length} venues are live in the network. Check the app to see what's new this week.`
      : `Hey ${firstName}. ${venues.length} spots are live right now. Open KickBack to see what's going on today.`,
  };
}

// ─── Build HTML email ────────────────────────────────────────────

function buildDigestHtml(
  body: string,
  user: UserDigestData,
  isWeekly: boolean
): string {
  const tierColors: Record<string, string> = {
    explorer: "#94a3b8",
    regular: "#4ade80",
    member: "#f97316",
    vip: "#a78bfa",
  };
  const tierColor = tierColors[user.tier] || "#94a3b8";

  const paragraphs = body.split("\n").filter((l) => l.trim()).map((p) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#e0e0e0;">${p}</p>`
  ).join("");

  // XP bar for weekly
  const xpBar = isWeekly ? `
    <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,0.3);font-weight:600;">KICKBACK SCORE</span>
        <span style="font-size:14px;font-weight:700;color:${tierColor};">${user.kickbackScore.toLocaleString()}</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.min((user.kickbackScore / 5000) * 100, 100)}%;background:${tierColor};border-radius:3px;"></div>
      </div>
      <div style="margin-top:6px;display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:rgba(255,255,255,0.2);text-transform:uppercase;letter-spacing:1px;">${user.tier}</span>
        ${user.streak > 0 ? `<span style="font-size:10px;color:#f97316;">🔥 ${user.streak} week streak</span>` : ""}
      </div>
    </div>
  ` : "";

  // Venue badges for weekly
  const venueBadges = isWeekly && user.venueProfiles.length > 0 ? `
    <div style="margin:16px 0;">
      <div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">YOUR VENUES</div>
      ${user.venueProfiles.map((v) => `
        <div style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
          <span style="font-size:12px;color:#fff;font-weight:600;">${v.venueName}</span>
          <span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:6px;">${v.xp} XP</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.4);">THEKICKBACK</span>
    </div>

    <!-- Body -->
    ${paragraphs}

    ${xpBar}
    ${venueBadges}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://join.thekickback.net" style="display:inline-block;padding:12px 32px;background:#F97316;color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:50px;">
        Open KickBack
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;margin-top:24px;text-align:center;">
      <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:0;">
        You're getting this because you're part of the KickBack network.
        <a href="https://join.thekickback.net/settings" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Manage preferences</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Send via Resend ─────────────────────────────────────────────

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    console.error(`Resend error for ${to}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

// ─── Cloudflare Worker types (inlined to avoid root tsconfig conflicts) ──

interface ScheduledEvent { cron: string; scheduledTime: number; }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }

// ─── Main handler ────────────────────────────────────────────────

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const isMonday = new Date().getUTCDay() === 1;
    const isWeekly = isMonday && event.cron === "0 14 * * 1";

    console.log(`Digest triggered: ${isWeekly ? "WEEKLY" : "DAILY"} at ${new Date().toISOString()}`);

    const [users, venues] = await Promise.all([
      getDigestUsers(env),
      getVenueSnapshots(env),
    ]);

    console.log(`Found ${users.length} users and ${venues.length} venues`);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const { subject, body } = await generateDigestContent(env, user, venues, isWeekly);
        const html = buildDigestHtml(body, user, isWeekly);
        const success = await sendEmail(env, user.email, subject, html, body);

        if (success) sent++;
        else failed++;
      } catch (err) {
        console.error(`Digest failed for ${user.email}:`, err);
        failed++;
      }
    }

    console.log(`Digest complete: ${sent} sent, ${failed} failed`);
  },

  // HTTP handler for testing
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "digest-worker" });
    }

    // Manual trigger for testing: POST /trigger?type=daily|weekly
    if (request.method === "POST" && url.pathname === "/trigger") {
      const type = url.searchParams.get("type") || "daily";
      const isWeekly = type === "weekly";

      const [users, venues] = await Promise.all([
        getDigestUsers(env),
        getVenueSnapshots(env),
      ]);

      // For testing, only send to the first user (or specific email)
      const testEmail = url.searchParams.get("email");
      const targetUsers = testEmail
        ? users.filter((u) => u.email === testEmail)
        : users.slice(0, 1);

      if (targetUsers.length === 0) {
        return Response.json({ error: "No matching users found" }, { status: 404 });
      }

      const results = [];
      for (const user of targetUsers) {
        const { subject, body } = await generateDigestContent(env, user, venues, isWeekly);
        const html = buildDigestHtml(body, user, isWeekly);
        const success = await sendEmail(env, user.email, subject, html, body);
        results.push({ email: user.email, subject, success, bodyPreview: body.slice(0, 200) });
      }

      return Response.json({ type, users: results.length, results });
    }

    // Preview digest without sending: GET /preview?email=...&type=daily|weekly
    if (url.pathname === "/preview") {
      const type = url.searchParams.get("type") || "daily";
      const isWeekly = type === "weekly";
      const testEmail = url.searchParams.get("email");

      const [users, venues] = await Promise.all([
        getDigestUsers(env),
        getVenueSnapshots(env),
      ]);

      const user = testEmail
        ? users.find((u) => u.email === testEmail)
        : users[0];

      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      const { subject, body } = await generateDigestContent(env, user, venues, isWeekly);
      const html = buildDigestHtml(body, user, isWeekly);

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return Response.json({ service: "kickback-digest", endpoints: ["/health", "/trigger", "/preview"] });
  },
};
