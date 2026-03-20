import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { GuestSession, VenueRequest, ChatMessage, VenueStats, VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { GuestTable } from "@/components/dashboard/guest-table";
import { RequestFeed } from "@/components/dashboard/request-feed";
import { TextLog } from "@/components/dashboard/text-log";
import { OccupancyBar } from "@/components/dashboard/occupancy-bar";
import { PointsPanel } from "@/components/dashboard/points-panel";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { BookingsPanel, type Booking } from "@/components/dashboard/bookings-panel";
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
    <main className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-8">
        {/* Dashboard Header */}
        <header className="flex items-center justify-between border-b border-black/5 bg-[#FAFAFA] py-4">
          <div className="flex items-center gap-4">
            <a href="https://thekickback.net">
              <Image
                src="/logo.png"
                alt="theKickBack"
                width={140}
                height={46}
                className="h-8 w-auto md:h-[46px]"
                priority
              />
            </a>
            <div className="hidden h-6 w-px bg-black/10 sm:block" />
            <span className="hidden font-sans text-sm font-medium text-black/40 sm:block">
              Venue Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
              <span className="font-sans text-sm font-medium text-black/60">
                {venue.name}
              </span>
            </div>
            <a href="/settings" className="rounded-lg bg-black/[0.06] px-3 py-1.5 font-sans text-xs font-medium text-black/50 transition hover:bg-black/[0.1]">
              Settings
            </a>
            <SignOutButton />
          </div>
        </header>

        {/* Venue info bar */}
        <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-black sm:text-3xl">
              {venue.name}
            </h1>
            <p className="font-sans text-sm text-black/45">
              {venue.state === "active" ? "Open" : "Closed"} &middot;{" "}
              {venue.vibe} vibe &middot; {user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black px-4 py-2 font-mono text-xs font-medium text-orange">
              {venue.state === "active" ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Tabbed Dashboard */}
        <DashboardTabs
          bookingCount={bookings.filter((b) => new Date(b.starts_at) > new Date()).length}
          sessionCount={sessions.length}
          pendingRequestCount={requests.filter((r) => r.status === "pending").length}
          conversationCount={messages.filter((m) => m.sender_type === "guest").length}
          overviewContent={
            <>
              {/* Stats grid */}
              <section className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 sm:gap-4">
                <StatCard label="IN VENUE NOW" value={stats.currentOccupancy} sub={`of ${stats.capacity} capacity`} accent />
                <StatCard label="TOTAL TODAY" value={stats.totalToday} sub="visitors today" />
                <StatCard label="MESSAGES TODAY" value={stats.totalMessages} sub="email + chat" />
                <StatCard label="MEMBERS" value={stats.members} sub="active memberships" />
              </section>

              {/* Occupancy */}
              <section className="pb-8">
                <OccupancyBar stats={stats} />
              </section>
            </>
          }
          bookingsContent={
            <section className="pb-8">
              <BookingsPanel bookings={bookings} />
            </section>
          }
          sessionsContent={
            <section className="pb-8">
              <GuestTable sessions={sessions} />
            </section>
          }
          requestsContent={
            <section className="pb-8">
              <RequestFeed requests={requests} />
            </section>
          }
          conversationsContent={
            <section className="pb-8">
              <TextLog messages={messages} />
            </section>
          }
          pointsContent={
            <section className="pb-8">
              <PointsPanel
                perks={perks}
                redemptions={redemptions}
                multipliers={multipliers}
                leaderboard={leaderboard}
                pointsIssuedToday={stats.pointsIssuedToday}
                perksRedeemedToday={stats.perksRedeemedToday}
              />
            </section>
          }
        />
      </div>
    </main>
  );
}
