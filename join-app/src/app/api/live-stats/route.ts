import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const revalidate = 30; // ISR: refresh every 30s

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Run queries in parallel
  const [venuesRes, checkinsRes, challengesRes] = await Promise.all([
    // All approved venues
    supabase
      .from("venue_pages")
      .select("venues(id, name, type, neighborhood, vibe, latitude, longitude, lat, lng)")
      .eq("published", true)
      .eq("review_status", "approved"),
    // Check-ins in the last hour
    supabase
      .from("checkins")
      .select("id, venue_id, created_at")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    // Active challenges
    supabase
      .from("challenges")
      .select("id, title, description, point_reward")
      .eq("active", true),
  ]);

  const pages = venuesRes.data || [];
  const venues = pages
    .map((p: Record<string, unknown>) => p.venues as Record<string, unknown> | null)
    .filter(Boolean) as Record<string, unknown>[];

  const totalVenues = venues.length;
  const recentCheckins = checkinsRes.data?.length || 0;
  const activeChallenges = challengesRes.data?.length || 0;

  // Trending: first 5 venues
  const trending = venues
    .slice(0, 5)
    .map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type || "venue",
      neighborhood: v.neighborhood || "",
      vibe: v.vibe || "quiet",
    }));

  // Vibe breakdown
  const vibeBreakdown = {
    quiet: venues.filter((v) => v.vibe === "quiet").length,
    moderate: venues.filter((v) => v.vibe === "moderate").length,
    busy: venues.filter((v) => v.vibe === "busy").length,
    lit: venues.filter((v) => v.vibe === "lit" || v.vibe === "packed").length,
  };

  return NextResponse.json({
    totalVenues,
    recentCheckins,
    activeChallenges,
    trending,
    vibeBreakdown,
    timestamp: Date.now(),
  });
}
