"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface LiveStats {
  totalVenues: number;
  totalPeopleOut: number;
  recentCheckins: number;
  activeChallenges: number;
  trending: {
    id: string;
    name: string;
    type: string;
    neighborhood: string;
    vibe: string;
    occupancy: number;
    capacity: number;
  }[];
  vibeBreakdown: {
    quiet: number;
    moderate: number;
    busy: number;
    lit: number;
  };
  timestamp: number;
}

export function useLiveStats() {
  const [stats, setStats] = useState<LiveStats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/live-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silent fail — keep last stats
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Poll every 30s as a baseline
    const interval = setInterval(fetchStats, 30_000);

    // Subscribe to realtime venue occupancy changes
    const supabase = createClient();
    const channel = supabase
      .channel("venue-occupancy")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "venues", filter: "occupancy=neq.occupancy" },
        () => {
          // Re-fetch stats when any venue occupancy changes
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return stats;
}
