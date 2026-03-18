export interface GuestSession {
  id: string;
  phone: string; // masked: ***-***-1234
  status: "active" | "held" | "left";
  type: "guest" | "member";
  enteredAt: string;
  location: string;
  lastCommand: string;
}

export interface VenueRequest {
  id: string;
  guestPhone: string;
  type: "booth" | "order" | "question" | "other";
  message: string;
  status: "pending" | "accepted" | "resolved";
  createdAt: string;
}

export interface VenueStats {
  currentOccupancy: number;
  capacity: number;
  totalToday: number;
  totalTexts: number;
  members: number;
  avgSessionMin: number;
  peakHour: string;
  pendingRequests: number;
}

export const MOCK_STATS: VenueStats = {
  currentOccupancy: 28,
  capacity: 60,
  totalToday: 74,
  totalTexts: 213,
  members: 12,
  avgSessionMin: 47,
  peakHour: "8 PM",
  pendingRequests: 3,
};

export const MOCK_SESSIONS: GuestSession[] = [
  { id: "s1", phone: "***-***-4821", status: "active", type: "member", enteredAt: "7:12 PM", location: "Booth 4", lastCommand: "status" },
  { id: "s2", phone: "***-***-9033", status: "active", type: "guest", enteredAt: "7:28 PM", location: "Bar area", lastCommand: "menu" },
  { id: "s3", phone: "***-***-1157", status: "held", type: "guest", enteredAt: "7:35 PM", location: "Booth 2 (held)", lastCommand: "hold" },
  { id: "s4", phone: "***-***-6290", status: "active", type: "member", enteredAt: "6:45 PM", location: "Patio", lastCommand: "request" },
  { id: "s5", phone: "***-***-3847", status: "active", type: "guest", enteredAt: "7:41 PM", location: "Main floor", lastCommand: "join" },
  { id: "s6", phone: "***-***-7712", status: "left", type: "guest", enteredAt: "5:30 PM", location: "—", lastCommand: "leave" },
];

export const MOCK_REQUESTS: VenueRequest[] = [
  { id: "r1", guestPhone: "***-***-9033", type: "order", message: "2x cold brew, 1 matcha", status: "pending", createdAt: "7:32 PM" },
  { id: "r2", guestPhone: "***-***-4821", type: "booth", message: "Move to a quieter booth?", status: "pending", createdAt: "7:38 PM" },
  { id: "r3", guestPhone: "***-***-6290", type: "question", message: "Is the kitchen still open?", status: "pending", createdAt: "7:43 PM" },
  { id: "r4", guestPhone: "***-***-1157", type: "booth", message: "Hold booth 2 for 10 more min", status: "accepted", createdAt: "7:35 PM" },
  { id: "r5", guestPhone: "***-***-3847", type: "other", message: "Can you turn up the music?", status: "resolved", createdAt: "7:20 PM" },
];

export const MOCK_TEXT_LOG = [
  { time: "7:43 PM", phone: "***-***-6290", direction: "in" as const, body: "ask is the kitchen still open?" },
  { time: "7:41 PM", phone: "***-***-3847", direction: "in" as const, body: "join" },
  { time: "7:41 PM", phone: "***-***-3847", direction: "out" as const, body: "Welcome to The Rooftop. 28 people, moderate vibe." },
  { time: "7:38 PM", phone: "***-***-4821", direction: "in" as const, body: "request move to a quieter booth?" },
  { time: "7:35 PM", phone: "***-***-1157", direction: "in" as const, body: "hold" },
  { time: "7:35 PM", phone: "***-***-1157", direction: "out" as const, body: "Booth 2 held for 10 min." },
  { time: "7:32 PM", phone: "***-***-9033", direction: "in" as const, body: "request 2x cold brew, 1 matcha" },
  { time: "7:28 PM", phone: "***-***-9033", direction: "in" as const, body: "join" },
];
