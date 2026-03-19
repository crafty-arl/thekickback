import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { GuestSession, VenueRequest, ChatMessage, VenueStats } from "@/lib/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { GuestTable } from "@/components/dashboard/guest-table";
import { RequestFeed } from "@/components/dashboard/request-feed";
import { TextLog } from "@/components/dashboard/text-log";
import { OccupancyBar } from "@/components/dashboard/occupancy-bar";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

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

  const venue = ownership.venues as unknown as {
    id: string;
    name: string;
    state: string;
    occupancy: number;
    max_occupancy: number;
    vibe: string;
  };

  // ─── Use service client for data queries (bypasses RLS) ──────────
  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // ─── Parallel queries for dashboard data ─────────────────────────
  const [sessionsRes, requestsRes, messagesRes, membersRes, todaySessionsRes, todayMessagesRes] =
    await Promise.all([
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
    ]);

  // Supabase joins return related records as arrays — extract first element
  const sessions: GuestSession[] = (sessionsRes.data || []).map((s: Record<string, unknown>) => ({
    ...s,
    profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
  })) as GuestSession[];

  const requests: VenueRequest[] = (requestsRes.data || []).map((r: Record<string, unknown>) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
  })) as VenueRequest[];

  const messages = (messagesRes.data || []) as ChatMessage[];

  const stats: VenueStats = {
    currentOccupancy: venue.occupancy,
    capacity: venue.max_occupancy,
    totalToday: todaySessionsRes.count || 0,
    totalMessages: todayMessagesRes.count || 0,
    members: membersRes.count || 0,
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

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 sm:gap-4">
          <StatCard
            label="IN VENUE NOW"
            value={stats.currentOccupancy}
            sub={`of ${stats.capacity} capacity`}
            accent
          />
          <StatCard
            label="TOTAL TODAY"
            value={stats.totalToday}
            sub="visitors today"
          />
          <StatCard
            label="MESSAGES TODAY"
            value={stats.totalMessages}
            sub="email + chat"
          />
          <StatCard
            label="MEMBERS"
            value={stats.members}
            sub="active memberships"
          />
        </section>

        {/* Occupancy */}
        <section className="pb-6">
          <OccupancyBar stats={stats} />
        </section>

        {/* Main content: two columns */}
        <section className="flex flex-col gap-6 pb-8 lg:flex-row">
          {/* Left: Sessions + Requests */}
          <div className="flex flex-1 flex-col gap-6">
            <GuestTable sessions={sessions} />
            <RequestFeed requests={requests} />
          </div>

          {/* Right: Live text feed */}
          <div className="w-full lg:w-[400px]">
            <TextLog messages={messages} />
          </div>
        </section>
      </div>
    </main>
  );
}
