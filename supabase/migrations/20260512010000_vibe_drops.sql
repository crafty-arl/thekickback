-- ============================================
-- Vibe drops (Phase 2)
-- Lightweight text contributions: "How's it tonight?" submissions.
-- Reuses point_ledger.reason='vibe_drop' (already in the CHECK constraint).
-- ============================================

CREATE TABLE IF NOT EXISTS vibe_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 280),
  sentiment text CHECK (sentiment IN ('quiet', 'moderate', 'busy', 'packed') OR sentiment IS NULL),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vibe_drops_venue_time
  ON vibe_drops (venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vibe_drops_user_time
  ON vibe_drops (user_id, created_at DESC);

ALTER TABLE vibe_drops ENABLE ROW LEVEL SECURITY;

-- Guests read their own drops
CREATE POLICY "users_read_own_vibe_drops" ON vibe_drops
  FOR SELECT USING (user_id = auth.uid());

-- Venue owners read drops for their venue
CREATE POLICY "venue_owners_read_vibe_drops" ON vibe_drops
  FOR SELECT USING (
    venue_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );

-- Service role inserts (API route uses service key after auth)

COMMENT ON TABLE vibe_drops IS
  'Phase 2 contributions. Single-text vibe submissions tied to a check-in moment.';

-- ─── Recreate loop_health_per_venue with vibe_drops_7d ──────────

DROP VIEW IF EXISTS loop_health_per_venue;

CREATE VIEW loop_health_per_venue AS
SELECT
  v.id AS venue_id,
  v.name AS venue_name,

  (
    SELECT COUNT(*)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
  ) AS checkins_7d,

  (
    SELECT COUNT(DISTINCT e.user_id)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
      AND e.user_id IS NOT NULL
  ) AS active_guests_7d,

  (
    SELECT COUNT(*)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
      AND e.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM loop_events e2
        WHERE e2.venue_id = v.id
          AND e2.event = 'checkin_completed'
          AND e2.user_id = e.user_id
          AND e2.occurred_at < e.occurred_at
      )
  ) AS returns_7d,

  (
    SELECT COUNT(*)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
      AND e.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM loop_events e2
        WHERE e2.venue_id = v.id
          AND e2.event = 'checkin_completed'
          AND e2.user_id = e.user_id
          AND e2.occurred_at < e.occurred_at
      )
      AND NOT EXISTS (
        SELECT 1 FROM loop_events ep
        WHERE ep.user_id = e.user_id
          AND ep.event = 'return_visit_prompted'
          AND ep.occurred_at BETWEEN e.occurred_at - INTERVAL '24 hours' AND e.occurred_at
      )
  ) AS unprompted_returns_7d,

  COALESCE((
    SELECT (SUM(cost_micros)::numeric / 1000000.0)
    FROM chat_cost_log
    WHERE venue_id = v.id
      AND occurred_at >= now() - INTERVAL '7 days'
  ), 0)::numeric(12,4) AS chat_cost_usd_7d,

  (
    SELECT COUNT(*)::int
    FROM perk_redemptions
    WHERE venue_id = v.id
      AND created_at >= now() - INTERVAL '7 days'
  ) AS redemptions_7d,

  -- Phase 2: vibe contribution volume
  (
    SELECT COUNT(*)::int
    FROM vibe_drops
    WHERE venue_id = v.id
      AND created_at >= now() - INTERVAL '7 days'
  ) AS vibe_drops_7d

FROM venues v;

COMMENT ON VIEW loop_health_per_venue IS
  'Per-venue 7-day loop health. Powers the dash-app Today loop-health panel.';
