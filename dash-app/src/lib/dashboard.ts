// ─── Interfaces matching real Supabase tables ─────────────────────

export interface GuestSession {
  id: string;
  user_id: string;
  venue_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  profiles: {
    phone: string;
    email: string | null;
    display_name: string | null;
  };
  // Enriched by dashboard
  kickback_score?: number;
  tier?: string;
  venue_xp?: number;
  venue_visits?: number;
  is_member?: boolean;
}

export interface VenueRequest {
  id: string;
  user_id: string;
  venue_id: string;
  session_id: string | null;
  type: string;
  body: string;
  status: string;
  created_at: string;
  profiles: {
    phone: string;
    email: string | null;
  };
}

export interface ChatMessage {
  id: string;
  venue_id: string;
  sender_phone: string | null;
  sender_type: string;
  body: string;
  created_at: string;
}

export interface VenueStats {
  currentOccupancy: number;
  capacity: number;
  totalToday: number;
  totalMessages: number;
  members: number;
  pointsIssuedToday: number;
  perksRedeemedToday: number;
}

// ─── Points Protocol interfaces ────────────────────────────────

export interface VenuePerk {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  point_cost: number;
  category: string;
  inventory: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface PerkRedemption {
  id: string;
  user_id: string;
  perk_id: string;
  venue_id: string;
  points_spent: number;
  status: string;
  created_at: string;
  fulfilled_at: string | null;
  expires_at: string | null;
  profiles: {
    phone: string;
    email: string | null;
    display_name: string | null;
  };
  venue_perks: {
    name: string;
    category: string;
  };
}

export interface VenueMultiplier {
  id: string;
  venue_id: string;
  multiplier: number;
  reason: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

export interface PointLeaderboardEntry {
  user_id: string;
  total_earned: number;
  balance: number;
  tier: string;
  current_streak: number;
  profiles: {
    phone: string;
    email: string | null;
    display_name: string | null;
  };
}

// ─── Digital Assets interfaces ─────────────────────────────────

export interface DigitalAsset {
  id: string;
  name: string;
  description: string | null;
  asset_type: string;
  asset_url: string;
  xp_cost: number | null;
  point_cost: number | null;
  wallet_price_cents: number | null;
  cash_price_cents: number | null;
  hub_revenue_share: number;
  min_tier: string | null;
  min_kickback_score: number | null;
  hub_id: string | null;
  category: string;
  is_animated: boolean;
  is_3d: boolean;
  duration_hours: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}
