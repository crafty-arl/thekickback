export interface Env {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  ENVIRONMENT: string;
  // DB: D1Database;   // uncomment when D1 is bound
  // KV: KVNamespace;  // uncomment when KV is bound
}

// Supported commands users can text
type Command = "join" | "ask" | "request" | "menu" | "hold" | "status" | "leave" | "membership";

interface InboundSMS {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    // Only accept POST to /sms from Twilio
    if (request.method !== "POST" || url.pathname !== "/sms") {
      return new Response("Not found", { status: 404 });
    }

    // Validate the request comes from Twilio
    if (!await validateTwilioSignature(request, env)) {
      return new Response("Unauthorized", { status: 403 });
    }

    // Parse the inbound SMS
    const formData = await request.formData();
    const sms: InboundSMS = {
      From: formData.get("From") as string,
      To: formData.get("To") as string,
      Body: (formData.get("Body") as string || "").trim(),
      MessageSid: formData.get("MessageSid") as string,
    };

    // Process the command and generate a reply
    const reply = await handleCommand(sms, env);

    // Respond with TwiML so Twilio sends the reply back to the user
    return new Response(twiml(reply), {
      headers: { "Content-Type": "text/xml" },
    });
  },
};

/**
 * Route inbound SMS to the correct command handler.
 */
async function handleCommand(sms: InboundSMS, _env: Env): Promise<string> {
  const raw = sms.Body.toLowerCase().trim();
  const command = raw.split(/\s+/)[0] as Command;
  const args = raw.slice(command.length).trim();

  switch (command) {
    case "join":
      return handleJoin(sms);
    case "ask":
      return handleAsk(sms, args);
    case "request":
      return handleRequest(sms, args);
    case "menu":
      return handleMenu(sms);
    case "hold":
      return handleHold(sms);
    case "status":
      return handleStatus(sms);
    case "leave":
      return handleLeave(sms);
    case "membership":
      return handleMembership(sms);
    default:
      return [
        `Hey! Not sure what "${raw}" means.`,
        "",
        "Try one of these:",
        "JOIN — enter a venue",
        "ASK — ask the venue anything",
        "REQUEST — request a booth, drink, etc.",
        "MENU — see what's available",
        "HOLD — hold a spot",
        "STATUS — check your session",
        "LEAVE — exit the venue",
        "MEMBERSHIP — join as a member",
      ].join("\n");
  }
}

// ─── Command Handlers ──────────────────────────────────────────────
// These are stubs — wire up to D1/KV/AI as you build out each flow.

function handleJoin(sms: InboundSMS): string {
  // TODO: look up venue from the To number, create a session in D1
  return [
    "Welcome to The Rooftop. Quiet right now — 12 people, 3 groups. Good for focus.",
    "",
    `You're in as a Guest. Text MENU, REQUEST, or ASK anytime.`,
  ].join("\n");
}

function handleAsk(_sms: InboundSMS, question: string): string {
  if (!question) {
    return "What do you want to ask? Text ASK followed by your question.";
  }
  // TODO: route question to venue agent / Workers AI
  return `Good question — let me check with the venue. You'll get a reply shortly.`;
}

function handleRequest(_sms: InboundSMS, what: string): string {
  if (!what) {
    return "What would you like to request? e.g. REQUEST a booth near the window";
  }
  // TODO: create request in D1, notify venue
  return `Got it — request sent to the venue: "${what}". We'll text you when it's ready.`;
}

function handleMenu(_sms: InboundSMS): string {
  // TODO: pull venue menu from D1/KV
  return [
    "📋 The Rooftop — Menu",
    "",
    "Drinks: espresso, matcha, cold brew, sparkling water",
    "Food: avocado toast, grain bowl, pastry basket",
    "",
    "Text REQUEST + item to order.",
  ].join("\n");
}

function handleHold(_sms: InboundSMS): string {
  // TODO: check availability in D1, hold the spot
  return "Booth 4 held for 10 min. Head over when ready.";
}

function handleStatus(_sms: InboundSMS): string {
  // TODO: pull session state from D1
  return [
    "📍 The Rooftop — Your session",
    "",
    "Status: Active guest",
    "Booth: #4 (held)",
    "Time in venue: 23 min",
    "Requests: 0 pending",
  ].join("\n");
}

function handleLeave(_sms: InboundSMS): string {
  // TODO: close session in D1
  return "You've left The Rooftop. Thanks for stopping by. Text JOIN anytime to come back.";
}

function handleMembership(_sms: InboundSMS): string {
  // TODO: check membership status, present options
  return [
    "The Rooftop Membership",
    "",
    "→ Priority booths",
    "→ Skip the wait",
    "→ Members-only events",
    "→ $25/month",
    "",
    "Reply YES to join, or ASK to learn more.",
  ].join("\n");
}

// ─── Twilio Helpers ────────────────────────────────────────────────

/**
 * Wrap a reply string in TwiML <Response><Message> XML.
 */
function twiml(body: string): string {
  // XML-escape the body to prevent injection
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

/**
 * Validate that the request actually came from Twilio using the
 * X-Twilio-Signature header and HMAC-SHA1.
 *
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
async function validateTwilioSignature(request: Request, env: Env): Promise<boolean> {
  // Skip validation in dev
  if (env.ENVIRONMENT === "development") return true;

  const signature = request.headers.get("X-Twilio-Signature");
  if (!signature) return false;

  const url = request.url;
  const body = await request.clone().formData();

  // Sort params and concatenate key+value
  const params: [string, string][] = [];
  body.forEach((value, key) => {
    params.push([key, value as string]);
  });
  params.sort(([a], [b]) => a.localeCompare(b));

  const data = url + params.map(([k, v]) => k + v).join("");

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return expected === signature;
}
