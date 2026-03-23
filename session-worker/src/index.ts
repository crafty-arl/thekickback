// ─── KickBack Session Expiry Worker ──────────────────────────────
// Runs every 30 minutes via cron to expire stale GPS check-in sessions.
// Also exposes /health and /expire endpoints.
// ─────────────────────────────────────────────────────────────────

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// ─── Supabase helpers ────────────────────────────────────────────

async function supabaseQuery(env: Env, path: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

// ─── Expire stale sessions ──────────────────────────────────────

async function expireSessions(env: Env): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  // Find active sessions past their expiry
  const stale = (await supabaseQuery(
    env,
    `sessions?status=eq.active&expires_at=lt.${now}&select=id,expires_at`
  )) as { id: string; expires_at: string }[];

  if (!Array.isArray(stale) || stale.length === 0) {
    console.log("[session-worker] No expired sessions found");
    return { expired: 0 };
  }

  console.log(`[session-worker] Found ${stale.length} expired session(s)`);

  // Batch update: set status=expired, ended_at=expires_at for each
  let count = 0;
  for (const session of stale) {
    await supabaseQuery(
      env,
      `sessions?id=eq.${session.id}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "expired",
          ended_at: session.expires_at,
        }),
      }
    );
    count++;
  }

  console.log(`[session-worker] Expired ${count} session(s)`);
  return { expired: count };
}

// ─── Worker export ──────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, worker: "kickback-session", timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/expire") {
      const result = await expireSessions(env);
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log("[session-worker] Cron triggered at", new Date().toISOString());
    await expireSessions(env);
  },
} satisfies ExportedHandler<Env>;
