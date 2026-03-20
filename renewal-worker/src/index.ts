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

// ─── Main handler ───────────────────────────────────────────────

export default {
  // Cron trigger — process all expiring memberships
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
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

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
