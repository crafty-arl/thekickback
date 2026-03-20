import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function getRpConfig(host: string) {
  const rpID = host.split(":")[0];
  const isLocalhost = rpID === "localhost" || rpID === "127.0.0.1";
  const origin = isLocalhost ? `http://${host}` : `https://${rpID}`;
  return { rpID, origin };
}

// GET — generate authentication options (challenge for biometric/password prompt)
export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const host = h.get("host") || "join.thekickback.net";
  const { rpID } = getRpConfig(host);

  // Get user's registered passkeys
  const { data: passkeys } = await supabase
    .from("user_passkeys")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json({ error: "No passkeys registered", needsSetup: true }, { status: 404 });
  }

  const allowCredentials = passkeys.map((p) => ({
    id: p.credential_id,
    type: "public-key" as const,
    transports: p.transports || [],
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred", // biometric if available, password/PIN fallback on desktop
  });

  // Store challenge
  await supabase.from("passkey_challenges").insert({
    user_id: user.id,
    challenge: options.challenge,
    purpose: "verify",
  });

  return NextResponse.json(options);
}

// POST — verify authentication response
export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const host = h.get("host") || "join.thekickback.net";
  const { rpID, origin } = getRpConfig(host);

  const body: AuthenticationResponseJSON = await req.json();

  // Get the latest unused verification challenge
  const { data: challengeRow } = await supabase
    .from("passkey_challenges")
    .select("id, challenge")
    .eq("user_id", user.id)
    .eq("purpose", "verify")
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    return NextResponse.json({ error: "No valid challenge. Try again." }, { status: 400 });
  }

  // Find the matching credential
  const credentialId = body.id;
  const { data: passkey } = await supabase
    .from("user_passkeys")
    .select("id, credential_id, public_key, counter")
    .eq("user_id", user.id)
    .eq("credential_id", credentialId)
    .single();

  if (!passkey) {
    return NextResponse.json({ error: "Unknown credential" }, { status: 400 });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, "base64url"),
        counter: passkey.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 403 });
    }

    // Update counter and last used
    await supabase
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", passkey.id);

    // Mark challenge as used
    await supabase
      .from("passkey_challenges")
      .update({ used: true })
      .eq("id", challengeRow.id);

    // Update device last active
    await supabase
      .from("user_devices")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("device_id", passkey.credential_id);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("Passkey verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 403 });
  }
}
