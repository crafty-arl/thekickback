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
  userId: string;
  displayName: string;
  balanceCents: number;
  tier: string;
  totalPoints: number;
  streak: number;
  venuesVisited: number;
  activeItems: { label: string; venueName: string }[];
  activeMemberships: { venueName: string; tier: string }[];
  hmacSecret: string;
}

async function generatePass(data: PassData): Promise<Buffer> {
  const serialNumber = `kb-${data.userId}`;
  const authToken = crypto.randomBytes(32).toString("hex");

  // Check if pass already exists for this user
  const existing = await supabase(
    `wallet_passes?serial_number=eq.${serialNumber}&limit=1`
  ) as any[];

  let hmacSecret = data.hmacSecret;

  if (existing && existing.length > 0) {
    // Update existing pass record
    await supabase(`wallet_passes?serial_number=eq.${serialNumber}`, {
      method: "PATCH",
      body: JSON.stringify({
        auth_token: authToken,
        user_id: data.userId,
        pass_type_id: PASS_TYPE_ID,
        hmac_secret: hmacSecret,
      }),
    });
  } else {
    // Insert new pass record
    await supabase("wallet_passes", {
      method: "POST",
      body: JSON.stringify({
        serial_number: serialNumber,
        auth_token: authToken,
        user_id: data.userId,
        pass_type_id: PASS_TYPE_ID,
        hmac_secret: hmacSecret,
      }),
    });
  }

  // Build dynamic QR with HMAC
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto
    .createHmac("sha256", hmacSecret)
    .update(`${data.userId}/${timestamp}`)
    .digest("hex")
    .slice(0, 8);
  const qrPayload = `kb://${data.userId}/${timestamp}/${hmac}`;

  // Read certs
  const signerCert = fs.readFileSync(path.join(CERTS_DIR, "signerCert.pem"));
  const signerKey = fs.readFileSync(path.join(CERTS_DIR, "signerKey.pem"));
  const wwdr = fs.readFileSync(path.join(CERTS_DIR, "wwdr.pem"));

  const balanceStr = `$${(data.balanceCents / 100).toFixed(2)}`;

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
      description: `theKickBack — ${data.displayName || "Member"}`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(0, 0, 0)",
      labelColor: "rgb(249, 115, 22)",
      logoText: "theKickBack",
      webServiceURL: "https://thekickback.net/wallet",
      authenticationToken: authToken,
    }
  );

  // Set pass type — storeCard
  pass.type = "storeCard";

  // Header — balance
  pass.headerFields.push({
    key: "balance",
    label: "BALANCE",
    value: balanceStr,
  });

  // Primary — display name
  pass.primaryFields.push({
    key: "name",
    label: "MEMBER",
    value: data.displayName || "theKickBack",
  });

  // Secondary — tier + total points
  pass.secondaryFields.push(
    {
      key: "tier",
      label: "TIER",
      value: capitalize(data.tier || "Explorer"),
    },
    {
      key: "points",
      label: "POINTS",
      value: `${data.totalPoints}`,
    }
  );

  // Auxiliary — active items count + venues visited
  pass.auxiliaryFields.push(
    {
      key: "activeItems",
      label: "ACTIVE ITEMS",
      value: `${data.activeItems.length}`,
    },
    {
      key: "venues",
      label: "VENUES VISITED",
      value: `${data.venuesVisited}`,
    },
    {
      key: "streak",
      label: "STREAK",
      value: `${data.streak}`,
    }
  );

  // Back fields
  const itemsList = data.activeItems.length > 0
    ? data.activeItems.map((i) => `${i.label} @ ${i.venueName}`).join("\n")
    : "No active items";
  const membershipsList = data.activeMemberships.length > 0
    ? data.activeMemberships.map((m) => `${m.venueName} — ${m.tier}`).join("\n")
    : "No active memberships";

  pass.backFields.push(
    {
      key: "items",
      label: "ACTIVE ITEMS",
      value: itemsList,
    },
    {
      key: "memberships",
      label: "MEMBERSHIPS",
      value: membershipsList,
    },
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

  // QR code — dynamic identity encoding
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: qrPayload,
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

// Generate and download a storeCard pass for a user
app.get("/wallet/pass/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user profile
    const profiles = await supabase(`profiles?id=eq.${userId}&limit=1`) as any[];
    const profile = profiles?.[0];
    if (!profile) return res.status(404).json({ error: "User not found" });

    // Get wallet balance (live mode)
    const wallets = await supabase(
      `user_wallets?user_id=eq.${userId}&mode=eq.live&limit=1`
    ) as any[];
    const balanceCents = wallets?.[0]?.balance_cents || 0;

    // Get point balances
    const points = await supabase(
      `point_balances?user_id=eq.${userId}&limit=1`
    ) as any[];
    const pb = points?.[0];

    // Get pending fulfillments
    const fulfillments = await supabase(
      `pending_fulfillments?user_id=eq.${userId}&fulfilled_at=is.null&select=*,venues(name)`
    ) as any[];
    const activeItems = (fulfillments || []).map((f: any) => ({
      label: f.label,
      venueName: f.venues?.name || "Unknown",
    }));

    // Get active memberships
    const memberships = await supabase(
      `memberships?user_id=eq.${userId}&expires_at=gt.${new Date().toISOString()}&select=*,venues(name)`
    ) as any[];
    const activeMemberships = (memberships || []).map((m: any) => ({
      venueName: m.venues?.name || "Unknown",
      tier: m.tier || "Member",
    }));

    // Get or create hmac_secret
    const existingPasses = await supabase(
      `wallet_passes?serial_number=eq.kb-${userId}&limit=1`
    ) as any[];
    let hmacSecret = existingPasses?.[0]?.hmac_secret;
    if (!hmacSecret) {
      hmacSecret = crypto.randomBytes(32).toString("hex");
    }

    const passData: PassData = {
      userId,
      displayName: profile.display_name || profile.name || "theKickBack",
      balanceCents,
      tier: pb?.tier || "Explorer",
      totalPoints: pb?.kickback_score || 0,
      streak: pb?.current_streak || 0,
      venuesVisited: pb?.venues_visited || 0,
      activeItems,
      activeMemberships,
      hmacSecret,
    };

    const passBuffer = await generatePass(passData);

    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename=kickback-pass.pkpass`,
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

// 4. Get the latest version of a pass (refresh)
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
  const userId = passRecord.user_id;

  // Get user profile
  const profiles = await supabase(`profiles?id=eq.${userId}&limit=1`) as any[];
  const profile = profiles?.[0];
  if (!profile) return res.sendStatus(404);

  // Get wallet balance (live mode)
  const wallets = await supabase(
    `user_wallets?user_id=eq.${userId}&mode=eq.live&limit=1`
  ) as any[];
  const balanceCents = wallets?.[0]?.balance_cents || 0;

  // Get point balances
  const points = await supabase(
    `point_balances?user_id=eq.${userId}&limit=1`
  ) as any[];
  const pb = points?.[0];

  // Get pending fulfillments
  const fulfillments = await supabase(
    `pending_fulfillments?user_id=eq.${userId}&fulfilled_at=is.null&select=*,venues(name)`
  ) as any[];
  const activeItems = (fulfillments || []).map((f: any) => ({
    label: f.label,
    venueName: f.venues?.name || "Unknown",
  }));

  // Get active memberships
  const memberships = await supabase(
    `memberships?user_id=eq.${userId}&expires_at=gt.${new Date().toISOString()}&select=*,venues(name)`
  ) as any[];
  const activeMemberships = (memberships || []).map((m: any) => ({
    venueName: m.venues?.name || "Unknown",
    tier: m.tier || "Member",
  }));

  // Reuse existing hmac_secret
  let hmacSecret = passRecord.hmac_secret;
  if (!hmacSecret) {
    hmacSecret = crypto.randomBytes(32).toString("hex");
  }

  const passData: PassData = {
    userId,
    displayName: profile.display_name || profile.name || "theKickBack",
    balanceCents,
    tier: pb?.tier || "Explorer",
    totalPoints: pb?.kickback_score || 0,
    streak: pb?.current_streak || 0,
    venuesVisited: pb?.venues_visited || 0,
    activeItems,
    activeMemberships,
    hmacSecret,
  };

  const passBuffer = await generatePass(passData);

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

app.post("/wallet/push/:userId", async (req, res) => {
  const { userId } = req.params;
  const serialNumber = `kb-${userId}`;

  // Get the pass for this user
  const passes = await supabase(
    `wallet_passes?serial_number=eq.${serialNumber}`
  ) as any[];
  if (!passes || passes.length === 0) {
    return res.json({ pushed: 0 });
  }

  // Get device tokens for this pass
  let totalPushed = 0;
  const devices = await supabase(
    `wallet_devices?serial_number=eq.${serialNumber}`
  ) as any[];

  if (devices) {
    for (const device of devices) {
      if (device.push_token) {
        try {
          await sendAPNsPush(device.push_token);
          totalPushed++;
        } catch (err) {
          console.error(`Push failed for ${device.device_id}:`, err);
        }
      }
    }
  }

  console.log(`Pushed updates to ${totalPushed} devices for user ${userId}`);
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

// ─── Reward Badge Pass (Apple — coupon type) ─────────────────────

interface RewardBadgeData {
  redemptionId: string;
  perkName: string;
  perkDescription: string;
  perkCategory: string;
  pointsSpent: number;
  venueName: string;
  venueId: string;
  userId: string;
  expiresAt: string;
  venueLatitude?: number;
  venueLongitude?: number;
}

async function generateRewardBadge(data: RewardBadgeData): Promise<Buffer> {
  const serialNumber = `kb-reward-${data.redemptionId}`;
  const authToken = crypto.randomBytes(32).toString("hex");

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

  const signerCert = fs.readFileSync(path.join(CERTS_DIR, "signerCert.pem"));
  const signerKey = fs.readFileSync(path.join(CERTS_DIR, "signerKey.pem"));
  const wwdr = fs.readFileSync(path.join(CERTS_DIR, "wwdr.pem"));

  const CATEGORY_EMOJI: Record<string, string> = {
    drink: "☕", food: "🍔", access: "🔑", experience: "✨", merch: "🎁",
  };
  const emoji = CATEGORY_EMOJI[data.perkCategory] || "🎯";

  const pass = new PKPass(
    {},
    { wwdr, signerCert, signerKey },
    {
      serialNumber,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      organizationName: "theKickBack",
      description: `${data.perkName} — ${data.venueName}`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(0, 0, 0)",
      labelColor: "rgb(249, 115, 22)",
      logoText: "theKickBack",
      webServiceURL: "https://thekickback.net/wallet",
      authenticationToken: authToken,
    }
  );

  pass.type = "coupon";
  pass.setExpirationDate(new Date(data.expiresAt));

  // Header
  pass.headerFields.push({
    key: "points",
    label: "POINTS SPENT",
    value: `${data.pointsSpent}`,
  });

  // Primary — the reward name
  pass.primaryFields.push({
    key: "reward",
    label: `${emoji} REWARD`,
    value: data.perkName,
  });

  // Secondary
  pass.secondaryFields.push(
    {
      key: "venue",
      label: "VENUE",
      value: data.venueName,
    },
    {
      key: "status",
      label: "STATUS",
      value: "Ready to Claim",
    }
  );

  // Auxiliary
  pass.auxiliaryFields.push(
    {
      key: "redeemed",
      label: "REDEEMED",
      value: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    },
    {
      key: "expires",
      label: "EXPIRES",
      value: new Date(data.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }
  );

  // Back
  pass.backFields.push(
    {
      key: "description",
      label: "DETAILS",
      value: data.perkDescription || data.perkName,
    },
    {
      key: "instructions",
      label: "HOW TO USE",
      value: "Show this pass at the venue. Staff will scan the QR code to fulfill your reward.",
    },
    {
      key: "venue_address",
      label: "VENUE",
      value: data.venueName,
    }
  );

  // QR code — links to redemption verification
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: `https://thekickback.net/wallet/redeem/${data.redemptionId}`,
    messageEncoding: "iso-8859-1",
  });

  // Location trigger — notify when near the venue
  if (data.venueLatitude && data.venueLongitude) {
    pass.setLocations({
      latitude: data.venueLatitude,
      longitude: data.venueLongitude,
      relevantText: `Your ${data.perkName} is waiting at ${data.venueName}`,
    });
  }

  // Add images
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

  return pass.getAsBuffer();
}

// ─── Google Wallet Pass (JWT) ────────────────────────────────────

function buildGoogleWalletUrl(data: RewardBadgeData): string {
  // Google Wallet uses a JWT-based Save to Google Wallet link
  // For now, generate a deep link that creates a generic pass object
  // Full implementation requires Google Pay API for Passes setup
  const passObject = {
    iss: "kickback@thekickback.iam.gserviceaccount.com",
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      genericObjects: [{
        id: `kickback.reward.${data.redemptionId}`,
        classId: "kickback.reward_class",
        genericType: "GENERIC_TYPE_UNSPECIFIED",
        hexBackgroundColor: "#000000",
        logo: {
          sourceUri: { uri: "https://thekickback.net/logo.png" },
        },
        cardTitle: { defaultValue: { language: "en", value: "theKickBack" } },
        subheader: { defaultValue: { language: "en", value: data.venueName } },
        header: { defaultValue: { language: "en", value: data.perkName } },
        barcode: {
          type: "QR_CODE",
          value: `https://thekickback.net/wallet/redeem/${data.redemptionId}`,
        },
        textModulesData: [
          { id: "points", header: "POINTS SPENT", body: `${data.pointsSpent}` },
          { id: "status", header: "STATUS", body: "Ready to Claim" },
          { id: "expires", header: "EXPIRES", body: new Date(data.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) },
        ],
      }],
    },
  };

  // Encode as base64 JWT-like payload (simplified — full implementation needs signing)
  const encoded = Buffer.from(JSON.stringify(passObject)).toString("base64url");
  return `https://pay.google.com/gp/v/save/${encoded}`;
}

// ─── Reward Badge Endpoint (platform-aware) ──────────────────────

app.get("/wallet/reward/:redemptionId", async (req, res) => {
  try {
    const { redemptionId } = req.params;
    const ua = (req.headers["user-agent"] || "").toLowerCase();

    // Detect platform
    const isIOS = /iphone|ipad|ipod/i.test(ua) || /mac/i.test(ua);
    const isAndroid = /android/i.test(ua);

    // Get redemption data
    const redemptions = await supabase(
      `perk_redemptions?id=eq.${redemptionId}&select=*,venue_perks(name,description,category,point_cost),profiles(id)&limit=1`
    ) as any[];

    if (!redemptions || redemptions.length === 0) {
      return res.status(404).json({ error: "Redemption not found" });
    }

    const redemption = redemptions[0];
    const perk = Array.isArray(redemption.venue_perks)
      ? redemption.venue_perks[0]
      : redemption.venue_perks;

    if (!perk) return res.status(404).json({ error: "Perk not found" });

    // Get venue
    const venues = await supabase(`venues?id=eq.${redemption.venue_id}&limit=1`) as any[];
    const venue = venues?.[0];
    if (!venue) return res.status(404).json({ error: "Venue not found" });

    const badgeData: RewardBadgeData = {
      redemptionId,
      perkName: perk.name,
      perkDescription: perk.description || perk.name,
      perkCategory: perk.category,
      pointsSpent: redemption.points_spent,
      venueName: venue.name,
      venueId: venue.id,
      userId: redemption.user_id,
      expiresAt: redemption.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      venueLatitude: venue.latitude,
      venueLongitude: venue.longitude,
    };

    if (isAndroid) {
      // Redirect to Google Wallet save URL
      const googleUrl = buildGoogleWalletUrl(badgeData);
      return res.redirect(googleUrl);
    }

    if (isIOS) {
      // Return Apple Wallet .pkpass file
      const passBuffer = await generateRewardBadge(badgeData);
      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename=reward-${redemptionId.slice(0, 8)}.pkpass`,
      });
      return res.send(passBuffer);
    }

    // Desktop/unknown — return JSON with both options
    const googleUrl = buildGoogleWalletUrl(badgeData);
    res.json({
      redemptionId,
      perk: perk.name,
      venue: venue.name,
      status: redemption.status,
      expires: redemption.expires_at,
      appleWalletUrl: `https://thekickback.net/wallet/reward/${redemptionId}`,
      googleWalletUrl: googleUrl,
    });
  } catch (err) {
    console.error("Reward badge error:", err);
    res.status(500).json({ error: "Failed to generate reward badge" });
  }
});

// ─── QR Scan Verification ─────────────────────────────────────────
// Venue staff or kiosk scans the dynamic QR from a user's storeCard pass

app.get("/wallet/scan/:payload", async (req, res) => {
  try {
    const { payload } = req.params;
    // payload format: {userId}/{timestamp}/{hmac}
    // (the kb:// prefix is stripped by the scanner or passed as-is)
    const cleaned = payload.replace(/^kb:\/\//, "");
    const parts = cleaned.split("/");

    if (parts.length !== 3) {
      return res.status(400).json({ error: "Invalid QR payload format" });
    }

    const [userId, timestamp, hmacProvided] = parts;

    // Look up the user's pass to get the hmac_secret
    const passes = await supabase(
      `wallet_passes?serial_number=eq.kb-${userId}&limit=1`
    ) as any[];

    if (!passes || passes.length === 0) {
      return res.status(404).json({ error: "Pass not found" });
    }

    const passRecord = passes[0];
    const hmacSecret = passRecord.hmac_secret;

    if (!hmacSecret) {
      return res.status(400).json({ error: "Pass not configured" });
    }

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac("sha256", hmacSecret)
      .update(`${userId}/${timestamp}`)
      .digest("hex")
      .slice(0, 8);

    if (expectedHmac !== hmacProvided) {
      return res.status(401).json({ error: "Invalid QR code" });
    }

    // Optional: check timestamp freshness (e.g., within 5 minutes)
    const tsNum = parseInt(timestamp, 10);
    const ageSeconds = Math.floor(Date.now() / 1000) - tsNum;
    if (ageSeconds > 300) {
      return res.status(410).json({ error: "QR code expired", ageSeconds });
    }

    // Look up user info
    const profiles = await supabase(`profiles?id=eq.${userId}&limit=1`) as any[];
    const profile = profiles?.[0];

    // Get pending fulfillments
    const fulfillments = await supabase(
      `pending_fulfillments?user_id=eq.${userId}&fulfilled_at=is.null&select=*,venues(name)`
    ) as any[];

    // Get active memberships
    const memberships = await supabase(
      `memberships?user_id=eq.${userId}&expires_at=gt.${new Date().toISOString()}&select=*,venues(name)`
    ) as any[];

    // Get balance
    const wallets = await supabase(
      `user_wallets?user_id=eq.${userId}&mode=eq.live&limit=1`
    ) as any[];

    res.json({
      ok: true,
      userId,
      displayName: profile?.display_name || profile?.name || "Unknown",
      balanceCents: wallets?.[0]?.balance_cents || 0,
      pendingItems: (fulfillments || []).map((f: any) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        venueName: f.venues?.name || "Unknown",
        venueId: f.venue_id,
        status: f.status,
      })),
      memberships: (memberships || []).map((m: any) => ({
        venueName: m.venues?.name || "Unknown",
        venueId: m.venue_id,
        tier: m.tier || "Member",
        expiresAt: m.expires_at,
      })),
    });
  } catch (err) {
    console.error("Scan verification error:", err);
    res.status(500).json({ error: "Failed to verify scan" });
  }
});

// ─── Redeem verification endpoint (venue staff scans QR) ─────────

app.post("/wallet/redeem/:redemptionId", async (req, res) => {
  try {
    const { redemptionId } = req.params;

    // Get redemption
    const redemptions = await supabase(
      `perk_redemptions?id=eq.${redemptionId}&limit=1`
    ) as any[];

    if (!redemptions || redemptions.length === 0) {
      return res.status(404).json({ error: "Redemption not found" });
    }

    const redemption = redemptions[0];

    if (redemption.status === "fulfilled") {
      return res.status(400).json({ error: "Already claimed", status: "fulfilled" });
    }

    if (redemption.status === "expired" || (redemption.expires_at && new Date(redemption.expires_at) < new Date())) {
      return res.status(400).json({ error: "Expired", status: "expired" });
    }

    // Mark as fulfilled
    await supabase(`perk_redemptions?id=eq.${redemptionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
      }),
    });

    res.json({ ok: true, status: "fulfilled", redemptionId });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ error: "Failed to process redemption" });
  }
});

// ─── Utilities ───────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Wallet service running on port ${PORT}`);
  console.log(`Pass generation: GET /wallet/pass/:userId`);
  console.log(`Reward badge:    GET /wallet/reward/:redemptionId`);
  console.log(`Redeem verify:   POST /wallet/redeem/:redemptionId`);
  console.log(`Push updates:    POST /wallet/push/:userId`);
  console.log(`QR scan verify:  GET /wallet/scan/:payload`);
});
