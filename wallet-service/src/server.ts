import express from "express";
import crypto from "crypto";
import path from "path";
import { PKPass } from "passkit-generator";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wofvgfhejrvudvfxdytc.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const PASS_TYPE_ID = process.env.PASS_TYPE_ID || "pass.net.thekickback.venue";
const TEAM_ID = process.env.TEAM_ID || "";

// Paths to Apple certs (you'll add these)
const CERTS_DIR = path.join(__dirname, "..", "certs");
const TEMPLATE_DIR = path.join(__dirname, "..", "templates", "thekickback.pass");

// ─── Supabase helper ─────────────────────────────────────────────

async function supabase(dbPath: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${dbPath}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Pass Generation ─────────────────────────────────────────────

interface PassData {
  venueName: string;
  venueId: string;
  vibe: string;
  occupancy: number;
  capacity: number;
  userStatus: string;
  booth: string;
  timeIn: string;
  pending: number;
  userId: string;
}

async function generatePass(data: PassData): Promise<Buffer> {
  const serialNumber = `kb-${data.venueId}-${data.userId}-${Date.now()}`;
  const authToken = crypto.randomBytes(32).toString("hex");

  // Store the pass registration in Supabase
  await supabase("wallet_passes", {
    method: "POST",
    body: JSON.stringify({
      serial_number: serialNumber,
      auth_token: authToken,
      user_id: data.userId,
      venue_id: data.venueId,
      pass_type_id: PASS_TYPE_ID,
    }),
  });

  // Read certs
  const signerCert = fs.readFileSync(path.join(CERTS_DIR, "signerCert.pem"));
  const signerKey = fs.readFileSync(path.join(CERTS_DIR, "signerKey.pem"));
  const wwdr = fs.readFileSync(path.join(CERTS_DIR, "wwdr.pem"));

  const pass = new PKPass(
    {},
    {
      wwdr,
      signerCert,
      signerKey,
    },
    {
      serialNumber,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      organizationName: "theKickBack",
      description: `${data.venueName} — theKickBack`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(0, 0, 0)",
      labelColor: "rgb(249, 115, 22)",
      logoText: "theKickBack",
      webServiceURL: "https://thekickback.net/wallet",
      authenticationToken: authToken,
    }
  );

  // Set pass type
  pass.type = "generic";

  // Header
  pass.headerFields.push({
    key: "vibe",
    label: "VIBE",
    value: capitalize(data.vibe),
  });

  // Primary
  pass.primaryFields.push({
    key: "venueName",
    label: "VENUE",
    value: data.venueName,
  });

  // Secondary
  pass.secondaryFields.push(
    {
      key: "occupancy",
      label: "PEOPLE",
      value: `${data.occupancy} / ${data.capacity}`,
    },
    {
      key: "status",
      label: "YOUR STATUS",
      value: capitalize(data.userStatus),
    }
  );

  // Auxiliary
  pass.auxiliaryFields.push(
    {
      key: "booth",
      label: "BOOTH",
      value: data.booth || "—",
    },
    {
      key: "timeIn",
      label: "TIME IN",
      value: data.timeIn || "Just arrived",
    },
    {
      key: "pending",
      label: "REQUESTS",
      value: `${data.pending} pending`,
    }
  );

  // Back fields
  pass.backFields.push(
    {
      key: "commands",
      label: "COMMANDS",
      value: "JOIN — enter a venue\nASK — ask anything\nREQUEST — request a booth/drink\nMENU — see what's available\nSTATUS — check session\nLEAVE — exit\nMEMBERSHIP — join as member",
    },
    {
      key: "contact",
      label: "TEXT US",
      value: "(877) 780-4236 or join@thekickback.net",
    },
    {
      key: "website",
      label: "DISCOVER VENUES",
      value: "join.thekickback.net",
    }
  );

  // QR code on pass — links to venue page
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: `https://join.thekickback.net/v/${data.venueId}`,
    messageEncoding: "iso-8859-1",
  });

  // Add logo image if exists
  const logoPath = path.join(TEMPLATE_DIR, "logo.png");
  if (fs.existsSync(logoPath)) {
    pass.addBuffer("logo.png", fs.readFileSync(logoPath));
    pass.addBuffer("logo@2x.png", fs.readFileSync(logoPath));
  }

  const iconPath = path.join(TEMPLATE_DIR, "icon.png");
  if (fs.existsSync(iconPath)) {
    pass.addBuffer("icon.png", fs.readFileSync(iconPath));
    pass.addBuffer("icon@2x.png", fs.readFileSync(iconPath));
  }

  const buf = pass.getAsBuffer();
  return buf;
}

// ─── API Routes ──────────────────────────────────────────────────

// Health check
app.get("/wallet/health", (_req, res) => {
  res.json({ status: "ok", service: "wallet-service" });
});

// Generate and download a pass for a user + venue
app.get("/wallet/pass/:venueId/:userId", async (req, res) => {
  try {
    const { venueId, userId } = req.params;

    // Get venue data
    const venues = await supabase(`venues?id=eq.${venueId}&limit=1`) as any[];
    if (!venues || venues.length === 0) {
      return res.status(404).json({ error: "Venue not found" });
    }
    const venue = venues[0];

    // Get user session
    const sessions = await supabase(
      `sessions?user_id=eq.${userId}&venue_id=eq.${venueId}&status=eq.active&limit=1`
    ) as any[];
    const session = sessions?.[0];

    // Get membership
    const memberships = await supabase(
      `memberships?user_id=eq.${userId}&venue_id=eq.${venueId}&limit=1`
    ) as any[];
    const membership = memberships?.[0];

    // Get pending requests
    const requests = session
      ? (await supabase(
          `requests?user_id=eq.${userId}&session_id=eq.${session.id}&status=eq.pending`
        ) as any[])
      : [];

    const timeIn = session
      ? `${Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)} min`
      : "—";

    const passBuffer = await generatePass({
      venueName: venue.name,
      venueId: venue.id,
      vibe: venue.vibe || "unknown",
      occupancy: venue.occupancy || 0,
      capacity: venue.max_occupancy || 60,
      userStatus: membership?.tier || "Guest",
      booth: "—",
      timeIn,
      pending: requests?.length || 0,
      userId,
    });

    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename=${venue.name.replace(/\s+/g, "-").toLowerCase()}.pkpass`,
    });
    res.send(passBuffer);
  } catch (err) {
    console.error("Pass generation error:", err);
    res.status(500).json({ error: "Failed to generate pass" });
  }
});

// ─── Apple Wallet Web Service (for push updates) ─────────────────
// See: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes

// 1. Register device for push notifications
app.post("/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber", async (req, res) => {
  const { deviceId, passTypeId, serialNumber } = req.params;
  const authHeader = req.headers.authorization;
  const pushToken = req.body?.pushToken;

  if (!authHeader) return res.sendStatus(401);
  const authToken = authHeader.replace("ApplePass ", "");

  // Verify auth token
  const passes = await supabase(
    `wallet_passes?serial_number=eq.${serialNumber}&auth_token=eq.${authToken}&limit=1`
  ) as any[];

  if (!passes || passes.length === 0) return res.sendStatus(401);

  // Store device registration
  await supabase("wallet_devices", {
    method: "POST",
    body: JSON.stringify({
      device_id: deviceId,
      push_token: pushToken,
      pass_type_id: passTypeId,
      serial_number: serialNumber,
    }),
    headers: { Prefer: "resolution=merge-duplicates" } as any,
  });

  console.log(`Device registered: ${deviceId} for pass ${serialNumber}`);
  res.sendStatus(201);
});

// 2. Unregister device
app.delete("/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber", async (req, res) => {
  const { deviceId, serialNumber } = req.params;

  await supabase(
    `wallet_devices?device_id=eq.${deviceId}&serial_number=eq.${serialNumber}`,
    { method: "DELETE" }
  );

  console.log(`Device unregistered: ${deviceId}`);
  res.sendStatus(200);
});

// 3. Get serial numbers for passes updated since a given tag
app.get("/wallet/v1/devices/:deviceId/registrations/:passTypeId", async (req, res) => {
  const { deviceId, passTypeId } = req.params;
  const passesUpdatedSince = req.query.passesUpdatedSince as string;

  // Get all passes for this device
  const devices = await supabase(
    `wallet_devices?device_id=eq.${deviceId}&pass_type_id=eq.${passTypeId}`
  ) as any[];

  if (!devices || devices.length === 0) return res.sendStatus(204);

  const serialNumbers = devices.map((d: any) => d.serial_number);
  const lastUpdated = new Date().toISOString();

  res.json({
    serialNumbers,
    lastUpdated,
  });
});

// 4. Get the latest version of a pass
app.get("/wallet/v1/passes/:passTypeId/:serialNumber", async (req, res) => {
  const { serialNumber } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.sendStatus(401);
  const authToken = authHeader.replace("ApplePass ", "");

  // Verify and get pass info
  const passes = await supabase(
    `wallet_passes?serial_number=eq.${serialNumber}&auth_token=eq.${authToken}&limit=1`
  ) as any[];

  if (!passes || passes.length === 0) return res.sendStatus(401);
  const passRecord = passes[0];

  // Get current venue + session data
  const venues = await supabase(`venues?id=eq.${passRecord.venue_id}&limit=1`) as any[];
  const venue = venues?.[0];
  if (!venue) return res.sendStatus(404);

  const sessions = await supabase(
    `sessions?user_id=eq.${passRecord.user_id}&venue_id=eq.${passRecord.venue_id}&status=eq.active&limit=1`
  ) as any[];
  const session = sessions?.[0];

  const memberships = await supabase(
    `memberships?user_id=eq.${passRecord.user_id}&venue_id=eq.${passRecord.venue_id}&limit=1`
  ) as any[];

  const requests = session
    ? (await supabase(
        `requests?user_id=eq.${passRecord.user_id}&session_id=eq.${session.id}&status=eq.pending`
      ) as any[])
    : [];

  const timeIn = session
    ? `${Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)} min`
    : "—";

  const passBuffer = await generatePass({
    venueName: venue.name,
    venueId: venue.id,
    vibe: venue.vibe || "unknown",
    occupancy: venue.occupancy || 0,
    capacity: venue.max_occupancy || 60,
    userStatus: memberships?.[0]?.tier || "Guest",
    booth: "—",
    timeIn,
    pending: requests?.length || 0,
    userId: passRecord.user_id,
  });

  res.set({ "Content-Type": "application/vnd.apple.pkpass" });
  res.send(passBuffer);
});

// 5. Log endpoint (Apple sends error logs here)
app.post("/wallet/v1/log", (req, res) => {
  console.log("Apple Wallet log:", JSON.stringify(req.body));
  res.sendStatus(200);
});

// ─── Push Update Trigger ─────────────────────────────────────────
// Call this when venue state changes to push updates to all passes

app.post("/wallet/push/:venueId", async (req, res) => {
  const { venueId } = req.params;

  // Get all passes for this venue
  const passes = await supabase(`wallet_passes?venue_id=eq.${venueId}`) as any[];
  if (!passes || passes.length === 0) {
    return res.json({ pushed: 0 });
  }

  // Get device tokens for these passes
  const serialNumbers = passes.map((p: any) => p.serial_number);
  let totalPushed = 0;

  for (const sn of serialNumbers) {
    const devices = await supabase(`wallet_devices?serial_number=eq.${sn}`) as any[];
    if (!devices) continue;

    for (const device of devices) {
      if (device.push_token) {
        // Send empty push notification — Apple Wallet will then call
        // GET /v1/passes/:passTypeId/:serialNumber to fetch the updated pass
        try {
          await sendAPNsPush(device.push_token);
          totalPushed++;
        } catch (err) {
          console.error(`Push failed for ${device.device_id}:`, err);
        }
      }
    }
  }

  console.log(`Pushed updates to ${totalPushed} devices for venue ${venueId}`);
  res.json({ pushed: totalPushed });
});

// ─── APNs Push ───────────────────────────────────────────────────

async function sendAPNsPush(pushToken: string): Promise<void> {
  // Uses HTTP/2 APNs
  // For production, use the @parse/node-apn library or native fetch to api.push.apple.com
  const apnsCertPath = path.join(CERTS_DIR, "apns-cert.pem");
  const apnsKeyPath = path.join(CERTS_DIR, "apns-key.pem");

  if (!fs.existsSync(apnsCertPath) || !fs.existsSync(apnsKeyPath)) {
    console.log(`[APNs] Would push to ${pushToken} (certs not configured yet)`);
    return;
  }

  // The push payload for Wallet passes is an empty JSON object
  // Apple Wallet treats any push as "go check for updates"
  const payload = JSON.stringify({});

  console.log(`[APNs] Pushing to ${pushToken}`);
  // In production, use @parse/node-apn here
}

// ─── Utilities ───────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Wallet service running on port ${PORT}`);
  console.log(`Pass generation: GET /wallet/pass/:venueId/:userId`);
  console.log(`Push updates:    POST /wallet/push/:venueId`);
});
