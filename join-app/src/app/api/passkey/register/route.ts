import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const RP_NAME = "KickBack";

// Derive RP ID and origin from the request host so it works on all domains
function getRpConfig(host: string) {
  // Strip port for RP ID (WebAuthn uses bare hostname)
  const rpID = host.split(":")[0];
  const isLocalhost = rpID === "localhost" || rpID === "127.0.0.1";
  const origin = isLocalhost ? `http://${host}` : `https://${rpID}`;
  return { rpID, origin };
}

// GET — generate registration options (challenge)
export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const host = h.get("host") || "join.thekickback.net";
  const { rpID } = getRpConfig(host);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email || user.id,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: user.email || "KickBack User",
    attestationType: "none",
    // No excludeCredentials — allow registering on multiple devices
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Face ID / Touch ID only — no QR code scanning
      userVerification: "required",
      residentKey: "required",
    },
  });

  // Store challenge for verification
  await supabase.from("passkey_challenges").insert({
    user_id: user.id,
    challenge: options.challenge,
    purpose: "register",
  });

  return NextResponse.json(options);
}

// POST — verify registration response and store credential
export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const host = h.get("host") || "join.thekickback.net";
  const { rpID, origin } = getRpConfig(host);

  const body: RegistrationResponseJSON & { deviceName?: string } = await req.json();

  // Get the latest unused challenge
  const { data: challengeRow } = await supabase
    .from("passkey_challenges")
    .select("id, challenge")
    .eq("user_id", user.id)
    .eq("purpose", "register")
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    return NextResponse.json({ error: "No valid challenge found. Try again." }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // credential.id is already a Base64URLString in SimpleWebAuthn v13+
    const credId = credential.id;

    // Store the passkey
    await supabase.from("user_passkeys").insert({
      user_id: user.id,
      credential_id: credId,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      device_name: body.deviceName || credentialDeviceType || "Unknown device",
      transports: body.response?.transports || [],
    });

    // Mark challenge as used
    await supabase
      .from("passkey_challenges")
      .update({ used: true })
      .eq("id", challengeRow.id);

    // Also register as a known device in user_devices
    const deviceName = body.deviceName || `Passkey device (${credentialDeviceType || "platform"})`;
    const { data: existingDevice } = await supabase
      .from("user_devices")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_id", credId)
      .limit(1)
      .single();

    if (!existingDevice) {
      await supabase.from("user_devices").insert({
        user_id: user.id,
        device_id: credId,
        device_name: deviceName,
        last_active_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, credentialId: credId });
  } catch (err) {
    console.error("Passkey registration error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
