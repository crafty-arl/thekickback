import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Auth check
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Get venue
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership || ownership.role !== "owner") {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const venueId = ownership.venue_id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // Parallel fetch core stats
  const [sessionsRes, todaySessionsRes, membersRes, bookingsRes] = await Promise.all([
    service.from("sessions").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("status", "active"),
    service.from("sessions").select("id", { count: "exact", head: true }).eq("venue_id", venueId).gte("started_at", todayISO),
    service.from("memberships").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
    service.from("venue_bookings").select("id, guest_name, offering_name, starts_at, cal_status").eq("venue_id", venueId).order("starts_at", { ascending: true }),
  ]);

  return Response.json({
    stats: {
      currentOccupancy: sessionsRes.count || 0,
      capacity: 0,
      activeSessions: sessionsRes.count || 0,
      totalToday: todaySessionsRes.count || 0,
      members: membersRes.count || 0,
    },
    bookings: bookingsRes.data || [],
  });
}
