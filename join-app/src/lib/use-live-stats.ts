"use client";

import { useState, useEffect, useCallback } from "react";

export interface LiveStats {
  totalVenues: number;
  recentCheckins: number;
  activeChallenges: number;
  trending: {
    id: string;
    name: string;
    type: string;
    neighborhood: string;
    vibe: string;
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

    return () => {
      clearInterval(interval);
    };
  }, [fetchStats]);

  return stats;
}
