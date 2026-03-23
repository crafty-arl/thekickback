import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { GuestSession, VenueRequest, ChatMessage, VenueStats, VenuePerk, PerkRedemption, VenueMultiplier, PointLeaderboardEntry } from "@/lib/dashboard";
import { type Booking } from "@/components/dashboard/bookings-panel";
import { type Order, type RevenueStats } from "@/components/dashboard/orders-panel";
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
    .select("venue_id, role, venues(id, name, state, vibe, type, address, platform_fee_rate, pos_provider, pos_connected_at)")
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
    vibe: string;
    type: string;
    address: string;
    platform_fee_rate: number | null;
    pos_provider: string | null;
    pos_connected_at: string | null;
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

  // ─── Fetch preview data for hub preview ────────────────────────
  const [pageDataRes, offeringsRes, galleryRes, xpActionsRes, xpMilestonesRes] = await Promise.all([
    serviceEarly
      .from("venue_pages")
      .select("slug, tagline, description, theme_color, hours, hero_image, onboarding_checklist")
      .eq("venue_id", venue.id)
      .single(),
    serviceEarly
      .from("venue_offerings")
      .select("id, name, type, price_cents, description, starts_at, ends_at")
      .eq("venue_id", venue.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    serviceEarly
      .from("venue_gallery")
      .select("id, image_url")
      .eq("venue_id", venue.id)
      .order("sort_order", { ascending: true }),
    serviceEarly
      .from("venue_xp_actions")
      .select("label, points")
      .eq("venue_id", venue.id),
    serviceEarly
      .from("venue_xp_milestones")
      .select("name, threshold")
      .eq("venue_id", venue.id),
  ]);

  const pageData = pageDataRes.data as {
    slug: string; tagline: string | null; description: string | null;
    theme_color: string; hours: { day: string; open: string; close: string }[];
    hero_image: string | null; onboarding_checklist: Record<string, boolean> | null;
  } | null;
  const previewOfferings = (offeringsRes.data || []) as { id: string; name: string; type: string; price_cents: number; description?: string; starts_at?: string; ends_at?: string }[];
  const previewGallery = (galleryRes.data || []) as { id: string; image_url: string }[];
  const previewXpActions = (xpActionsRes.data || []) as { label: string; points: number }[];
  const previewXpMilestones = (xpMilestonesRes.data || []) as { name: string; threshold: number }[];

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
    bookingsRes, ordersRes, walletTxRes,
    xpActivityRes,
    staffRes, knowledgeRes, aiLimitsRes,
  ] = await Promise.all([
    // Active sessions with profile info
    service
      .from("sessions")
      .select("id, user_id, venue_id, started_at, ended_at, status, check_in_method, distance_meters, expires_at, profiles(phone, email, display_name)")
      .eq("venue_id", venue.id)
      .eq("status", "active")
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
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

    // Orders with line items
    service
      .from("orders")
      .select("*, order_items(*), profiles(display_name, email, phone)")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(100),

    // Wallet transactions (payments received from guests)
    service
      .from("wallet_transactions")
      .select("id, amount_cents, description, status, created_at, user_id, profiles(display_name, email)")
      .eq("venue_id", venue.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(100),

    // Recent XP activity
    service
      .from("point_ledger")
      .select("amount, reason, created_at, profiles(display_name)")
      .eq("venue_id", venue.id)
      .gt("amount", 0)
      .order("created_at", { ascending: false })
      .limit(20),

    // Staff for hub settings drawer
    service
      .from("venue_staff")
      .select("id, display_name, role_title, avatar_url, bio, specialties, visible, schedule")
      .eq("venue_id", venue.id)
      .order("sort_order", { ascending: true }),

    // Knowledge base for hub settings drawer
    service
      .from("venue_knowledge")
      .select("id, content, category, created_at")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false }),

    // AI limits for hub settings drawer
    service
      .from("venue_ai_limits")
      .select("*")
      .eq("venue_id", venue.id)
      .maybeSingle(),
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

  // ─── Orders & Revenue ────────────────────────────────────────────
  const rawOrders = (ordersRes.data || []).map((o: Record<string, unknown>) => ({
    ...o,
    profiles: Array.isArray(o.profiles) ? o.profiles[0] : o.profiles,
    order_items: Array.isArray(o.order_items) ? o.order_items : [],
  })) as Order[];

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const nonCancelledOrders = rawOrders.filter((o) => o.status !== "cancelled");
  const todayRevenueTotal = nonCancelledOrders
    .filter((o) => new Date(o.created_at) >= todayStart)
    .reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const weekRevenueTotal = nonCancelledOrders
    .filter((o) => new Date(o.created_at) >= weekStart)
    .reduce((sum, o) => sum + (o.total_cents || 0), 0);

  // Process wallet transactions (payments received)
  const feeRate = venue.platform_fee_rate ?? 0.10;
  const rawTransactions = (walletTxRes.data || []).map((t: Record<string, unknown>) => ({
    ...t,
    profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
  }));
  const venueTransactions = rawTransactions.map((t: Record<string, unknown>) => ({
    id: t.id as string,
    amount_cents: t.amount_cents as number,
    description: t.description as string,
    status: t.status as string,
    created_at: t.created_at as string,
    guest_name: (t.profiles as Record<string, unknown> | null)?.display_name as string | null
      || (t.profiles as Record<string, unknown> | null)?.email as string | null,
  }));
  const totalEarnings = venueTransactions.reduce(
    (sum: number, t: { amount_cents: number }) => sum + t.amount_cents, 0
  );

  const revenueStats: RevenueStats = {
    todayRevenue: todayRevenueTotal,
    weekRevenue: weekRevenueTotal,
    totalOrders: rawOrders.length,
    platformFeeRate: feeRate,
    totalEarnings: Math.round(totalEarnings * (1 - feeRate)),
    pendingBalance: 0,
  };

  // ─── XP Activity ────────────────────────────────────────────────
  const xpActivity = (xpActivityRes.data || []).map((e: Record<string, unknown>) => ({
    amount: e.amount as number,
    reason: e.reason as string,
    created_at: e.created_at as string,
    profiles: Array.isArray(e.profiles) ? e.profiles[0] as { display_name: string | null } : e.profiles as { display_name: string | null } | null,
  }));

  const stats: VenueStats = {
    currentOccupancy: sessions.length,
    capacity: 0,
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
        orders: rawOrders,
        revenueStats,
        transactions: venueTransactions,
        messages,
        perks,
        redemptions,
        multipliers,
        leaderboard,
      }}
      venue={venue}
      reviewStatus={reviewStatus}
      user={{ id: user.id, email: user.email || "" }}
      pageData={pageData ? {
        slug: pageData.slug,
        tagline: pageData.tagline,
        description: pageData.description,
        theme_color: pageData.theme_color,
        hours: pageData.hours,
        hero_image: pageData.hero_image,
      } : undefined}
      offerings={previewOfferings}
      gallery={previewGallery}
      xpActions={previewXpActions}
      xpMilestones={previewXpMilestones}
      checklist={pageData?.onboarding_checklist || undefined}
      xpActivity={xpActivity}
      staff={staffRes.data || []}
      knowledge={knowledgeRes.data || []}
      aiLimits={aiLimitsRes.data || null}
    />
  );
}
