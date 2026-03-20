import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const MAX_DEVICES = 3;

async function getUser() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

// GET /api/devices — list user's devices
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: devices } = await supabase
    .from("user_devices")
    .select("id, device_id, device_name, last_active_at, created_at")
    .eq("user_id", user.id)
    .order("last_active_at", { ascending: false });

  return NextResponse.json({
    devices: devices || [],
    maxDevices: MAX_DEVICES,
  });
}

// DELETE /api/devices — remove a device or all devices
// Body: { deviceDbId } to remove one, { all: true } to remove all + sign out everywhere
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  if (body.all) {
    // Remove all devices
    await supabase
      .from("user_devices")
      .delete()
      .eq("user_id", user.id);

    // Clear the legacy device_id on profile
    await supabase
      .from("profiles")
      .update({ device_id: null })
      .eq("id", user.id);

    // Sign out all sessions via Supabase Admin API
    const authClient = await createAuthClient();
    await authClient.auth.signOut({ scope: "global" });

    return NextResponse.json({ ok: true, signedOut: true });
  }

  if (body.deviceDbId) {
    // Remove specific device
    const { error } = await supabase
      .from("user_devices")
      .delete()
      .eq("id", body.deviceDbId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing deviceDbId or all flag" }, { status: 400 });
}
