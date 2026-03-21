import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: Request) {
  // Authenticate user
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get("venueId");

  // Build query — match by guest_email or user_id
  let query = supabase
    .from("venue_bookings")
    .select("id, venue_id, offering_id, offering_name, guest_name, starts_at, ends_at, duration_minutes, cal_status, created_at, venues(name)")
    .or(`guest_email.eq.${user.email},user_id.eq.${user.id}`)
    .order("starts_at", { ascending: false })
    .limit(50);

  if (venueId) {
    query = query.eq("venue_id", venueId);
  }

  const { data: bookings, error } = await query;

  if (error) {
    console.error("Bookings query error:", error);
    return Response.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }

  return Response.json({
    bookings: (bookings || []).map((b) => ({
      id: b.id,
      venueId: b.venue_id,
      venueName: (b.venues as { name?: string } | null)?.name || null,
      offeringId: b.offering_id,
      offeringName: b.offering_name,
      guestName: b.guest_name,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      durationMinutes: b.duration_minutes,
      status: b.cal_status,
      createdAt: b.created_at,
    })),
  });
}
