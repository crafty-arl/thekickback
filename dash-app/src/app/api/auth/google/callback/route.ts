import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// GET /api/auth/google/callback — exchange code for tokens, fetch business locations
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/onboarding?google_error=denied", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL || "https://dash.thekickback.net"}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/onboarding?google_error=token_failed", req.url));
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Save refresh token to user's profile
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && tokens.refresh_token) {
    const service = createServiceClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
    await service.from("profiles").update({
      google_refresh_token: tokens.refresh_token,
    }).eq("id", user.id);
  }

  // Fetch their business accounts
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  let accountName = "";
  if (accountsRes.ok) {
    const accountsData = await accountsRes.json() as { accounts?: { name: string }[] };
    accountName = accountsData.accounts?.[0]?.name || "";
  }

  if (!accountName) {
    return NextResponse.redirect(new URL("/onboarding?google_error=no_account", req.url));
  }

  // Fetch locations for the first account
  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,regularHours,phoneNumbers,categories,websiteUri,profile`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!locationsRes.ok) {
    console.error("Google locations fetch failed:", locationsRes.status, await locationsRes.text());
    return NextResponse.redirect(new URL("/onboarding?google_error=locations_failed", req.url));
  }

  const locationsData = await locationsRes.json() as {
    locations?: {
      name: string;
      title: string;
      storefrontAddress?: {
        addressLines?: string[];
        locality?: string;
        administrativeArea?: string;
        postalCode?: string;
      };
      regularHours?: {
        periods?: { openDay: string; openTime: { hours: number; minutes?: number }; closeDay: string; closeTime: { hours: number; minutes?: number } }[];
      };
      phoneNumbers?: { primaryPhone?: string };
      categories?: { primaryCategory?: { displayName: string } };
      websiteUri?: string;
      profile?: { description?: string };
    }[];
  };

  const locations = locationsData.locations || [];

  // Encode locations data in URL params (base64 for safety)
  const locationsJson = JSON.stringify(locations.map((loc) => {
    const addr = loc.storefrontAddress;
    const address = addr
      ? [addr.addressLines?.join(", "), addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean).join(", ")
      : "";

    const hours = (loc.regularHours?.periods || []).map((p) => {
      const open = `${p.openTime.hours}:${String(p.openTime.minutes || 0).padStart(2, "0")}`;
      const close = `${p.closeTime.hours}:${String(p.closeTime.minutes || 0).padStart(2, "0")}`;
      return `${p.openDay} ${open}-${close}`;
    }).join(", ");

    return {
      googleName: loc.name,
      name: loc.title,
      address,
      phone: loc.phoneNumbers?.primaryPhone || "",
      category: loc.categories?.primaryCategory?.displayName || "",
      hours,
      website: loc.websiteUri || "",
      description: loc.profile?.description || "",
    };
  }));

  const encoded = Buffer.from(locationsJson).toString("base64url");

  return NextResponse.redirect(new URL(`/onboarding?google_data=${encoded}`, req.url));
}
