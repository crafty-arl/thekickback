// Maps point_ledger.reason enum values to user-readable copy.
// Mirrors join-app/src/lib/points.ts pointsReasonCopy — keep in sync.

export type PointsReason =
  | "first_visit"
  | "return_visit"
  | "session_complete"
  | "ai_interaction"
  | "request_made"
  | "membership_joined"
  | "referral"
  | "challenge_complete"
  | "multiplier_bonus"
  | "venue_bonus"
  | "perk_redeem"
  | "streak_bonus"
  | "vibe_drop"
  | "photo_drop"
  | "discovery_scout"
  | "purchase_bonus";

const REASON_COPY: Record<PointsReason, string> = {
  first_visit: "First visit",
  return_visit: "Return visit",
  session_complete: "Session ended",
  ai_interaction: "AI chat",
  request_made: "Request sent",
  membership_joined: "Joined membership",
  referral: "Referral",
  challenge_complete: "Challenge complete",
  multiplier_bonus: "Multiplier bonus",
  venue_bonus: "Venue bonus",
  perk_redeem: "Perk redeemed",
  streak_bonus: "Streak bonus",
  vibe_drop: "Vibe drop",
  photo_drop: "Photo drop",
  discovery_scout: "Discovery scout",
  purchase_bonus: "Purchase bonus",
};

export function pointsReasonCopy(reason: string): string {
  return (REASON_COPY as Record<string, string>)[reason] ?? reason.replace(/_/g, " ");
}
