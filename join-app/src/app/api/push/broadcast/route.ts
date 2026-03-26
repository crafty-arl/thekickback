import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:carl@craftthefuture.xyz",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// POST /api/push/broadcast — send push to ALL subscribed users
// Body: { title, body, url?, secret }
// Requires a secret to prevent unauthorized access
export async function POST(req: NextRequest) {
  const { title, body, url, secret } = await req.json();

  // Verify admin secret
  const expectedSecret = process.env.OPENCLAW_HOOKS_TOKEN || process.env.SUPABASE_SERVICE_KEY;
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!title || !body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  // Get all subscriptions
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  const payload = JSON.stringify({ title, body, url: url || "/", tag: "broadcast" });
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as webpush.PushSubscription["keys"] },
        payload,
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: subs.length });
}
