import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/google — redirect to Google OAuth consent screen
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 });
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL || "https://dash.thekickback.net"}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
    state: "onboarding",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
