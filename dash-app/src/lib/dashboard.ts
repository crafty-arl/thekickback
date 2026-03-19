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
}
