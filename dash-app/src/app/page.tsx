import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { GuestSession, VenueRequest, ChatMessage, VenueStats, VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";
import { type Booking } from "@/components/dashboard/bookings-panel";
import { OwnerDock } from "@/components/owner-dock";
import { isSandbox } from "@/lib/stripe";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has a venue
  const { data: ownership } = await supabase
    .from("venue_owners")
    .select("venue_id, role, venues(id, name, state, occupancy, max_occupancy, vibe)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) {
    redirect("/onboarding");
  }

  // Staff role → redirect to staff portal
  if (ownership.role === "staff") {
    redirect("/staff");
  }

  const venue = ownership.venues as unknown as {
    id: string;
    name: string;
    state: string;
    occupancy: number;
    max_occupancy: number;
    vibe: string;
  };

  const sandboxMode = await isSandbox();
  const mode = sandboxMode ? "test" : "live";

  // ─── Check review status ─────────────────────────────────────────
  const serviceEarly = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
  const { data: venuePage } = await serviceEarly
    .from("venue_pages")
    .select("review_status, published, slug")
    .eq("venue_id", venue.id)
    .single();

  const reviewStatus = venuePage?.review_status || "draft";

  // ─── Use service client for data queries (bypasses RLS) ──────────
  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // ─── Parallel queries for dashboard data ─────────────────────────
  const [
    sessionsRes, requestsRes, messagesRes, membersRes,
    todaySessionsRes, todayMessagesRes,
    perksRes, redemptionsRes, multipliersRes,
    leaderboardRes, pointsTodayRes, perksTodayRes,
    bookingsRes,
  ] = await Promise.all([
    // Active sessions with profile info
    service
      .from("sessions")
      .select("id, user_id, venue_id, started_at, ended_at, status, profiles(phone, email, display_name)")
      .eq("venue_id", venue.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),

    // Recent requests with profile info
    service
      .from("requests")
      .select("id, user_id, venue_id, session_id, type, body, status, created_at, profiles(phone, email)")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(20),

    // Recent chat messages
    service
      .from("chat_messages")
      .select("id, venue_id, sender_phone, sender_type, body, created_at")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(50),

    // Total members
    service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id),

    // Total sessions today
    service
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .gte("started_at", todayISO),

    // Total messages today
    service
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .gte("created_at", todayISO),

    // ─── Points Protocol queries ───────────────────────────────────
    // Venue perks
    service
      .from("venue_perks")
      .select("*")
      .eq("venue_id", venue.id)
      .order("sort_order", { ascending: true }),

    // Recent redemptions at this venue
    service
      .from("perk_redemptions")
      .select("*, profiles(phone, email, display_name), venue_perks(name, category)")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(20),

    // Active multipliers
    service
      .from("venue_multipliers")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("active", true),

    // Top earners at this venue (users who earned the most points here)
    service
      .from("point_ledger")
      .select("user_id, profiles(phone, email, display_name)")
      .eq("venue_id", venue.id)
      .gt("amount", 0)
      .order("created_at", { ascending: false })
      .limit(100),

    // Points issued today at this venue
    service
      .from("point_ledger")
      .select("amount")
      .eq("venue_id", venue.id)
      .gt("amount", 0)
      .gte("created_at", todayISO),

    // Perks redeemed today
    service
      .from("perk_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .gte("created_at", todayISO),

    // Bookings
    service
      .from("venue_bookings")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("mode", mode)
      .order("starts_at", { ascending: true }),
  ]);

  // Supabase joins return related records as arrays — extract first element
  const rawSessions = (sessionsRes.data || []).map((s: Record<string, unknown>) => ({
    ...s,
    profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
  })) as GuestSession[];

  // Enrich sessions with kickback score, venue XP, and membership status
  const sessionUserIds = rawSessions.map((s) => s.user_id).filter(Boolean);
  let scoreMap = new Map<string, { kickback_score: number; tier: string }>();
  let xpMap = new Map<string, { xp: number; visits: number }>();
  let memberSet = new Set<string>();

  if (sessionUserIds.length > 0) {
    const [scoresRes, xpRes, membershipsRes] = await Promise.all([
      service.from("point_balances").select("user_id, kickback_score, tier").in("user_id", sessionUserIds),
      service.from("user_venue_xp").select("user_id, xp, visits").eq("venue_id", venue.id).in("user_id", sessionUserIds),
      service.from("memberships").select("user_id").eq("venue_id", venue.id).in("user_id", sessionUserIds),
    ]);
    for (const r of (scoresRes.data || []) as { user_id: string; kickback_score: number; tier: string }[]) {
      scoreMap.set(r.user_id, { kickback_score: r.kickback_score, tier: r.tier });
    }
    for (const r of (xpRes.data || []) as { user_id: string; xp: number; visits: number }[]) {
      xpMap.set(r.user_id, { xp: r.xp, visits: r.visits });
    }
    for (const r of (membershipsRes.data || []) as { user_id: string }[]) {
      memberSet.add(r.user_id);
    }
  }

  const sessions: GuestSession[] = rawSessions.map((s) => ({
    ...s,
    kickback_score: scoreMap.get(s.user_id)?.kickback_score || 0,
    tier: scoreMap.get(s.user_id)?.tier || "explorer",
    venue_xp: xpMap.get(s.user_id)?.xp || 0,
    venue_visits: xpMap.get(s.user_id)?.visits || 0,
    is_member: memberSet.has(s.user_id),
  }));

  const requests: VenueRequest[] = (requestsRes.data || []).map((r: Record<string, unknown>) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
  })) as VenueRequest[];

  const messages = (messagesRes.data || []) as ChatMessage[];
  const bookings = (bookingsRes.data || []) as Booking[];
  const perks = (perksRes.data || []) as VenuePerk[];

  const redemptions: PerkRedemption[] = (redemptionsRes.data || []).map((r: Record<string, unknown>) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
    venue_perks: Array.isArray(r.venue_perks) ? r.venue_perks[0] : r.venue_perks,
  })) as PerkRedemption[];

  const multipliers = (multipliersRes.data || []) as VenueMultiplier[];

  // Aggregate leaderboard from ledger entries
  const ledgerEntries = leaderboardRes.data || [];
  const userTotals = new Map<string, { total: number; profile: Record<string, unknown> }>();
  for (const entry of ledgerEntries) {
    const e = entry as Record<string, unknown>;
    const uid = e.user_id as string;
    const existing = userTotals.get(uid);
    if (existing) {
      existing.total += 1; // count interactions
    } else {
      userTotals.set(uid, { total: 1, profile: (Array.isArray(e.profiles) ? e.profiles[0] : e.profiles) as Record<string, unknown> });
    }
  }
  const leaderboard: PointLeaderboardEntry[] = Array.from(userTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([uid, data]) => ({
      user_id: uid,
      total_earned: data.total,
      balance: 0,
      tier: "explorer",
      current_streak: 0,
      profiles: data.profile as PointLeaderboardEntry["profiles"],
    }));

  const pointsIssuedToday = (pointsTodayRes.data || []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + ((r.amount as number) || 0),
    0
  );

  const stats: VenueStats = {
    currentOccupancy: venue.occupancy,
    capacity: venue.max_occupancy,
    totalToday: todaySessionsRes.count || 0,
    totalMessages: todayMessagesRes.count || 0,
    members: membersRes.count || 0,
    pointsIssuedToday,
    perksRedeemedToday: perksTodayRes.count || 0,
  };

  return (
    <OwnerDock
      initialData={{
        stats,
        sessions,
        requests,
        bookings,
        messages,
        perks,
        redemptions,
        multipliers,
        leaderboard,
      }}
      venue={venue}
      reviewStatus={reviewStatus}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
