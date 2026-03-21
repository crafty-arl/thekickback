// ─── KickBack Membership Renewal Worker ─────────────────────────
// Runs daily via cron to renew expiring memberships.
// Priority: wallet first → card fallback → cancel if both fail.
//
// Also exposes POST /renew for OpenClaw to trigger per-user renewal.
// ─────────────────────────────────────────────────────────────────

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_TEST_SECRET_KEY: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  RESEND_API_KEY: string;
}

// ─── Email helpers (Cloudflare Worker — no process.env) ─────────

const EMAIL_FROM = "theKickBack <hub@thekickback.net>";

function wrapEmail(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;">
  <div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
    ${content}
    <p style="margin-top:32px;font-size:11px;color:rgba(255,255,255,0.2);text-align:center;">
      theKickBack &mdash; tap in, text in, you're in
    </p>
  </div>
</body>
</html>`;
}

function sendWorkerEmail(env: Env, to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !to) return;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  }).catch((err) => console.error(`Email to ${to} failed:`, err));
}

interface Membership {
  id: string;
  user_id: string;
  venue_id: string;
  offering_id: string;
  mode: string;
  expires_at: string;
  charge_method: string;
}

interface Offering {
  id: string;
  name: string;
  price_cents: number;
  interval: string | null;
}

interface Wallet {
  id: string;
  balance_cents: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
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

async function supabaseRpc(env: Env, fn: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return res.json();
}

async function supabasePatch(env: Env, table: string, id: string, data: Record<string, unknown>): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

async function supabaseInsert(env: Env, table: string, data: Record<string, unknown>): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

// ─── Stripe charge helper ────────────────────────────────────────

async function chargeCard(
  stripeKey: string,
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  description: string,
  metadata: Record<string, string>
): Promise<{ ok: boolean; paymentIntentId?: string; error?: string }> {
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(stripeKey + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: String(amountCents),
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: "true",
      confirm: "true",
      description,
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    }),
  });

  const pi = await res.json() as { id?: string; status?: string; error?: { message?: string } };
  if (pi.status === "succeeded") {
    return { ok: true, paymentIntentId: pi.id };
  }
  return { ok: false, error: pi.error?.message || `Payment ${pi.status || "failed"}` };
}

// ─── User email lookup ──────────────────────────────────────────

async function getUserEmail(env: Env, userId: string): Promise<string | null> {
  const rows = (await supabaseGet(env, `profiles?id=eq.${userId}&select=email`)) as { email?: string }[];
  return rows?.[0]?.email || null;
}

async function getVenueName(env: Env, venueId: string): Promise<string> {
  const rows = (await supabaseGet(env, `venues?id=eq.${venueId}&select=name,slug`)) as { name?: string; slug?: string }[];
  return rows?.[0]?.name || "Venue";
}

async function getVenueSlug(env: Env, venueId: string): Promise<string> {
  const rows = (await supabaseGet(env, `venues?id=eq.${venueId}&select=slug`)) as { slug?: string }[];
  return rows?.[0]?.slug || venueId;
}

// ─── Renew a single membership ──────────────────────────────────

async function renewMembership(env: Env, membership: Membership): Promise<{ renewed: boolean; method?: string; error?: string }> {
  // Get offering details
  const offerings = (await supabaseGet(env, `venue_offerings?id=eq.${membership.offering_id}&select=id,name,price_cents,interval`)) as Offering[];
  const offering = offerings[0];
  if (!offering) return { renewed: false, error: "Offering not found" };

  const stripeKey = membership.mode === "test" ? env.STRIPE_TEST_SECRET_KEY : env.STRIPE_SECRET_KEY;

  // Get wallet
  const wallets = (await supabaseGet(env, `user_wallets?user_id=eq.${membership.user_id}&mode=eq.${membership.mode}&active=eq.true&select=id,balance_cents,stripe_customer_id,stripe_payment_method_id`)) as Wallet[];
  const wallet = wallets[0];

  // ── Step 1: Try wallet ──
  if (wallet && wallet.balance_cents >= offering.price_cents) {
    const result = (await supabaseRpc(env, "wallet_spend", {
      p_user_id: membership.user_id,
      p_amount_cents: offering.price_cents,
      p_venue_id: membership.venue_id,
      p_description: `Membership renewal: ${offering.name}`,
      p_mode: membership.mode,
    })) as { ok?: boolean };

    if (result?.ok) {
      // Extend membership
      const newExpiry = getNextExpiry(membership.expires_at, offering.interval);
      await supabasePatch(env, "memberships", membership.id, {
        expires_at: newExpiry,
        last_charged_at: new Date().toISOString(),
        charge_method: "wallet",
      });

      // Record order for tracking
      await supabaseInsert(env, "orders", {
        user_id: membership.user_id,
        venue_id: membership.venue_id,
        status: "completed",
        total_cents: offering.price_cents,
        mode: membership.mode,
        notes: `Auto-renewal: ${offering.name} (wallet)`,
      });

      console.log(`✓ Renewed ${offering.name} for ${membership.user_id} via wallet`);

      // ─── Email 3: Membership Renewed (wallet) ──────────────────
      try {
        const email = await getUserEmail(env, membership.user_id);
        if (email) {
          const vName = await getVenueName(env, membership.venue_id);
          const priceDollars = (offering.price_cents / 100).toFixed(2);
          const expiryStr = new Date(newExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const nextRenewal = new Date(newExpiry);
          const nextRenewalStr = nextRenewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          sendWorkerEmail(env, email, `Renewed — ${offering.name}`, wrapEmail(`
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="margin:0;font-size:28px;color:#fff;">Renewed.</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${offering.name} at ${vName}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Membership</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${offering.name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Charged</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">$${priceDollars} &middot; Wallet</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Valid until</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ADE80;font-weight:600;">${expiryStr}</td></tr>
              <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Next renewal</td><td style="text-align:right;padding:10px 0;color:#fff;">${nextRenewalStr}</td></tr>
            </table>
          `));
        }
      } catch (e) { console.error("Renewal email failed:", e); }

      return { renewed: true, method: "wallet" };
    }
  }

  // ── Step 2: Try card ──
  if (wallet?.stripe_customer_id && wallet?.stripe_payment_method_id && stripeKey) {
    const chargeResult = await chargeCard(
      stripeKey,
      wallet.stripe_customer_id,
      wallet.stripe_payment_method_id,
      offering.price_cents,
      `KickBack membership renewal: ${offering.name}`,
      {
        user_id: membership.user_id,
        venue_id: membership.venue_id,
        offering_id: membership.offering_id,
        type: "membership_renewal",
      }
    );

    if (chargeResult.ok) {
      // Extend membership
      const newExpiry = getNextExpiry(membership.expires_at, offering.interval);
      await supabasePatch(env, "memberships", membership.id, {
        expires_at: newExpiry,
        last_charged_at: new Date().toISOString(),
        charge_method: "card",
      });

      // Record wallet transaction for the card charge
      if (wallet) {
        await supabaseInsert(env, "wallet_transactions", {
          wallet_id: wallet.id,
          user_id: membership.user_id,
          venue_id: membership.venue_id,
          amount_cents: offering.price_cents,
          description: `Membership renewal: ${offering.name} (card)`,
          stripe_payment_intent_id: chargeResult.paymentIntentId,
          status: "completed",
          mode: membership.mode,
        });
      }

      // Record order
      await supabaseInsert(env, "orders", {
        user_id: membership.user_id,
        venue_id: membership.venue_id,
        status: "completed",
        total_cents: offering.price_cents,
        mode: membership.mode,
        notes: `Auto-renewal: ${offering.name} (card)`,
      });

      console.log(`✓ Renewed ${offering.name} for ${membership.user_id} via card`);

      // ─── Email 3: Membership Renewed (card) ────────────────────
      try {
        const email = await getUserEmail(env, membership.user_id);
        if (email) {
          const vName = await getVenueName(env, membership.venue_id);
          const priceDollars = (offering.price_cents / 100).toFixed(2);
          const expiryStr = new Date(newExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const nextRenewal = new Date(newExpiry);
          const nextRenewalStr = nextRenewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          sendWorkerEmail(env, email, `Renewed — ${offering.name}`, wrapEmail(`
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="margin:0;font-size:28px;color:#fff;">Renewed.</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${offering.name} at ${vName}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Membership</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${offering.name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Charged</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">$${priceDollars} &middot; Card</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Valid until</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ADE80;font-weight:600;">${expiryStr}</td></tr>
              <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Next renewal</td><td style="text-align:right;padding:10px 0;color:#fff;">${nextRenewalStr}</td></tr>
            </table>
          `));
        }
      } catch (e) { console.error("Renewal email failed:", e); }

      return { renewed: true, method: "card" };
    } else {
      console.error(`✗ Card charge failed for ${membership.user_id}: ${chargeResult.error}`);
    }
  }

  // ── Step 3: Both failed — mark for cancellation ──
  await supabasePatch(env, "memberships", membership.id, {
    auto_renew: false,
  });
  console.log(`✗ Renewal failed for ${membership.user_id} — auto_renew disabled`);

  // ─── Email 4: Renewal Failed ──────────────────────────────────
  try {
    const email = await getUserEmail(env, membership.user_id);
    if (email) {
      const vName = await getVenueName(env, membership.venue_id);
      const slug = await getVenueSlug(env, membership.venue_id);
      const reason = (!wallet || wallet.balance_cents < offering.price_cents)
        ? "Insufficient wallet balance"
        : "Card declined";
      sendWorkerEmail(env, email, `Renewal failed — ${offering.name}`, wrapEmail(`
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#EF4444;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:28px;color:#fff;line-height:56px;">!</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#fff;">Renewal failed.</h1>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${vName}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Membership</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${offering.name}</td></tr>
          <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Reason</td><td style="text-align:right;padding:10px 0;color:#EF4444;font-weight:600;">${reason}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">Auto-renew has been turned off. Update your payment to keep your membership.</p>
        <div style="text-align:center;margin-top:20px;">
          <a href="https://join.thekickback.net/${slug}" style="display:inline-block;padding:12px 28px;background:#EF4444;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Update Payment</a>
        </div>
      `));
    }
  } catch (e) { console.error("Renewal failed email failed:", e); }

  return { renewed: false, error: "Wallet insufficient, card failed or missing" };
}

function getNextExpiry(currentExpiry: string, interval: string | null): string {
  const d = new Date(currentExpiry);
  if (interval === "year") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

// ─── Monthly Statement ──────────────────────────────────────────

async function sendMonthlyStatements(env: Env) {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const monthName = firstOfLastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Get all wallets with transactions last month
  const txRows = (await supabaseGet(
    env,
    `wallet_transactions?status=eq.completed&created_at=gte.${firstOfLastMonth.toISOString()}&created_at=lt.${firstOfThisMonth.toISOString()}&select=user_id,venue_id,amount_cents`
  )) as { user_id: string; venue_id: string; amount_cents: number }[];

  if (!txRows?.length) {
    console.log("No transactions last month — skipping statements");
    return;
  }

  // Group by user
  const byUser: Record<string, { venue_id: string; amount_cents: number }[]> = {};
  for (const tx of txRows) {
    if (!byUser[tx.user_id]) byUser[tx.user_id] = [];
    byUser[tx.user_id].push(tx);
  }

  let sent = 0;
  for (const [userId, txs] of Object.entries(byUser)) {
    try {
      const email = await getUserEmail(env, userId);
      if (!email) continue;

      const totalSpent = txs.reduce((s, t) => s + t.amount_cents, 0);

      // Group by venue
      const venueMap: Record<string, number> = {};
      for (const tx of txs) {
        const vid = tx.venue_id || "unknown";
        venueMap[vid] = (venueMap[vid] || 0) + tx.amount_cents;
      }
      const venueCount = Object.keys(venueMap).length;

      // Top venue
      let topVenueId = "";
      let topVenueSpend = 0;
      for (const [vid, spend] of Object.entries(venueMap)) {
        if (spend > topVenueSpend) { topVenueId = vid; topVenueSpend = spend; }
      }
      const topVenueName = topVenueId && topVenueId !== "unknown"
        ? await getVenueName(env, topVenueId)
        : "—";

      // Funded (wallet top-ups) — look for positive balance changes
      // For simplicity, we count fund transactions as description containing "fund" or "top" or negative spend
      const funded = txs.filter(t => t.amount_cents < 0).reduce((s, t) => s + Math.abs(t.amount_cents), 0);

      // Get current balance
      const wallets = (await supabaseGet(
        env,
        `user_wallets?user_id=eq.${userId}&active=eq.true&select=balance_cents`
      )) as { balance_cents: number }[];
      const balance = wallets?.[0]?.balance_cents || 0;

      // Get points balance
      const pointRows = (await supabaseGet(
        env,
        `point_balances?user_id=eq.${userId}&select=balance`
      )) as { balance: number }[];
      const points = pointRows?.[0]?.balance || 0;

      const spentDollars = (totalSpent / 100).toFixed(2);
      const balanceDollars = (balance / 100).toFixed(2);

      sendWorkerEmail(env, email, `Your ${monthName} on theKickBack`, wrapEmail(`
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="margin:0;font-size:24px;color:#fff;">Your month on theKickBack</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${monthName}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Total spent</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#F97316;font-weight:700;font-size:18px;">$${spentDollars}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venues visited</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${venueCount}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Top venue</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${topVenueName}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Points earned</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ADE80;font-weight:600;">${points.toLocaleString()}</td></tr>
          <tr><td style="padding:12px 0;color:rgba(255,255,255,0.5);">Current balance</td><td style="text-align:right;padding:12px 0;color:#fff;font-weight:700;font-size:18px;">$${balanceDollars}</td></tr>
        </table>
        <div style="text-align:center;margin-top:24px;">
          <a href="https://join.thekickback.net" style="display:inline-block;padding:12px 28px;background:#F97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Open theKickBack</a>
        </div>
      `));
      sent++;
    } catch (e) { console.error(`Monthly statement failed for ${userId}:`, e); }
  }
  console.log(`Sent ${sent} monthly statements`);
}

// ─── Main handler ───────────────────────────────────────────────

export default {
  // Cron trigger — process all expiring memberships
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext) {
    console.log("─── Membership renewal cron started ───");

    // Find memberships expiring in the next 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const memberships = (await supabaseGet(
      env,
      `memberships?auto_renew=eq.true&offering_id=not.is.null&expires_at=lt.${tomorrow}&select=id,user_id,venue_id,offering_id,mode,expires_at,charge_method`
    )) as Membership[];

    console.log(`Found ${memberships.length} memberships to renew`);

    let renewed = 0;
    let failed = 0;
    for (const m of memberships) {
      const result = await renewMembership(env, m);
      if (result.renewed) renewed++;
      else failed++;
    }

    console.log(`─── Done: ${renewed} renewed, ${failed} failed ───`);

    // ─── Email 5: Booking Reminders (24h before) ────────────────
    console.log("─── Booking reminder check started ───");
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      // Bookings starting in the next 24 hours that haven't been reminder-sent
      const bookings = (await supabaseGet(
        env,
        `venue_bookings?cal_status=in.(confirmed,accepted)&starts_at=gt.${now.toISOString()}&starts_at=lt.${in24h.toISOString()}&reminder_sent=is.null&select=id,venue_id,offering_name,guest_name,guest_email,starts_at,duration_minutes`
      )) as {
        id: string; venue_id: string; offering_name: string;
        guest_name: string; guest_email: string;
        starts_at: string; duration_minutes: number;
      }[];

      console.log(`Found ${(bookings || []).length} bookings needing reminders`);

      for (const b of bookings || []) {
        if (!b.guest_email) continue;
        try {
          const vName = await getVenueName(env, b.venue_id);
          const slug = await getVenueSlug(env, b.venue_id);
          const startDate = new Date(b.starts_at);
          const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          sendWorkerEmail(env, b.guest_email, `Tomorrow — ${b.offering_name} at ${vName}`, wrapEmail(`
            <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;margin-bottom:8px;">&#128197;</div>
              <h1 style="margin:0;font-size:28px;color:#fff;">Tomorrow.</h1>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${vName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Service</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${b.offering_name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Date</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${dateStr}</td></tr>
              <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Time</td><td style="text-align:right;padding:10px 0;color:#8B5CF6;font-weight:600;">${timeStr}</td></tr>
            </table>
            <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;margin-top:20px;text-align:center;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">Your pass is ready. Don't be late.</p>
            </div>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://join.thekickback.net/${slug}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">View venue</a>
            </div>
          `));

          // Mark reminder as sent
          await supabasePatch(env, "venue_bookings", b.id, { reminder_sent: true });
        } catch (e) { console.error(`Booking reminder failed for ${b.id}:`, e); }
      }
      console.log("─── Booking reminders done ───");
    } catch (e) { console.error("Booking reminder check failed:", e); }

    // ─── Event RSVP Reminders (24h before) ────────────────────────
    console.log("─── Event RSVP reminder check started ───");
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find offering_slots starting in next 24h for event offerings that have RSVPs
      const slots = (await supabaseGet(
        env,
        `offering_slots?starts_at=gt.${now.toISOString()}&starts_at=lt.${in24h.toISOString()}&status=eq.available&select=id,offering_id,venue_id,starts_at`
      )) as { id: string; offering_id: string; venue_id: string; starts_at: string }[];

      console.log(`Found ${(slots || []).length} upcoming event slots`);

      for (const slot of slots || []) {
        try {
          // Get the offering name
          const offerings = (await supabaseGet(
            env,
            `venue_offerings?id=eq.${slot.offering_id}&type=eq.event&active=eq.true&select=name`
          )) as { name: string }[];
          if (!offerings?.length) continue;
          const eventName = offerings[0].name;

          // Get RSVPs for this offering that haven't been reminded
          const rsvps = (await supabaseGet(
            env,
            `event_rsvps?offering_id=eq.${slot.offering_id}&status=eq.going&reminder_sent=is.null&select=id,user_id`
          )) as { id: string; user_id: string }[];

          if (!rsvps?.length) continue;

          const vName = await getVenueName(env, slot.venue_id);
          const slug = await getVenueSlug(env, slot.venue_id);
          const startDate = new Date(slot.starts_at);
          const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          for (const rsvp of rsvps) {
            try {
              const email = await getUserEmail(env, rsvp.user_id);
              if (!email) continue;

              sendWorkerEmail(env, email, `Tomorrow night — ${eventName}`, wrapEmail(`
                <div style="background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                  <div style="font-size:36px;margin-bottom:8px;">&#128337;</div>
                  <h1 style="margin:0;font-size:28px;color:#fff;">Tomorrow night.</h1>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Event</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${eventName}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${vName}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Time</td><td style="text-align:right;padding:10px 0;color:#8B5CF6;font-weight:600;">${timeStr}</td></tr>
                </table>
                <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;margin-top:20px;text-align:center;">
                  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">Don't forget. Pull up.</p>
                </div>
                <div style="text-align:center;margin-top:20px;">
                  <a href="https://join.thekickback.net/${slug}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">View venue</a>
                </div>
              `));

              // Mark reminder sent
              await supabasePatch(env, "event_rsvps", rsvp.id, { reminder_sent: true });
            } catch (e) { console.error(`RSVP reminder failed for ${rsvp.id}:`, e); }
          }
        } catch (e) { console.error(`Event slot reminder failed for ${slot.id}:`, e); }
      }
      console.log("─── Event RSVP reminders done ───");
    } catch (e) { console.error("Event RSVP reminder check failed:", e); }

    // ─── Monthly Statement (1st of month) ─────────────────────────
    const today = new Date();
    if (today.getUTCDate() === 1) {
      console.log("─── Monthly statements started ───");
      try {
        await sendMonthlyStatements(env);
        console.log("─── Monthly statements done ───");
      } catch (e) { console.error("Monthly statements failed:", e); }
    }
  },

  // HTTP trigger — OpenClaw can POST /renew to renew a specific user's membership
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/renew") {
      // Auth: require OpenClaw token
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      const { userId, venueId, membershipId } = await request.json() as {
        userId?: string;
        venueId?: string;
        membershipId?: string;
      };

      // Find the specific membership
      let query = "memberships?auto_renew=eq.true&offering_id=not.is.null&select=id,user_id,venue_id,offering_id,mode,expires_at,charge_method";
      if (membershipId) {
        query += `&id=eq.${membershipId}`;
      } else if (userId && venueId) {
        query += `&user_id=eq.${userId}&venue_id=eq.${venueId}`;
      } else {
        return new Response(JSON.stringify({ error: "Provide membershipId or userId+venueId" }), { status: 400 });
      }

      const memberships = (await supabaseGet(env, query)) as Membership[];
      if (memberships.length === 0) {
        return new Response(JSON.stringify({ error: "Membership not found" }), { status: 404 });
      }

      const result = await renewMembership(env, memberships[0]);
      return new Response(JSON.stringify(result), {
        status: result.renewed ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Manual monthly statement trigger
    if (request.method === "POST" && url.pathname === "/monthly-statements") {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      try {
        await sendMonthlyStatements(env);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
      }
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
