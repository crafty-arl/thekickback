import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Detect sandbox mode from hostname
  const host = request.headers.get("host") || "";
  const isSandbox = host.startsWith("sandbox.");
  if (isSandbox) {
    supabaseResponse.headers.set("x-kickback-mode", "sandbox");
    supabaseResponse.cookies.set("kickback_sandbox", "true", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400,
    });
  } else {
    supabaseResponse.cookies.delete("kickback_sandbox");
  }

  // Refresh the session (keeps cookies alive)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // join-app is public — no auth redirects needed.
  // Auth gating happens at the action level (booking, wallet, checkout),
  // not at the page level. The dock has inline login for when it's needed.

  return supabaseResponse;
}
