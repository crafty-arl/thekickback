-- ============================================
-- Loop telemetry (Phase 0)
-- One spine for: customer loop events + AI chat cost.
-- Powers the dash-app loop-health panel and answers
-- "is the loop holding without prompting?"
-- ============================================

-- ─── Enums ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE loop_event_kind AS ENUM (
    'chat_open',
    'chat_message_sent',
    'chat_action_clicked',
    'checkin_started',
    'checkin_completed',
    'points_earned_view',
    'perk_viewed',
    'perk_redeemed',
    'wallet_pass_viewed',
    'return_visit_prompted',
    'return_visit_unprompted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loop_event_source AS ENUM ('join', 'dash', 'root', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── loop_events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loop_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  event loop_event_kind NOT NULL,
  source loop_event_source NOT NULL,
  device_id text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loop_events_user_time
  ON loop_events (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loop_events_venue_event_time
  ON loop_events (venue_id, event, occurred_at DESC) WHERE venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loop_events_event_time
  ON loop_events (event, occurred_at DESC);

ALTER TABLE loop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_owners_read_loop_events" ON loop_events
  FOR SELECT USING (
    venue_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );

-- Service role bypasses RLS for inserts (API routes use service key).

-- ─── chat_cost_log ──────────────────────────────────────────────
-- Decoupled from chat_messages so cost data can be added without
-- mutating the existing chat_messages insert path.

CREATE TABLE IF NOT EXISTS chat_cost_log (
  id bigserial PRIMARY KEY,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  source loop_event_source NOT NULL,
  model text NOT NULL,
  tokens_in int,
  tokens_out int,
  cost_micros bigint,         -- USD micros (1 USD = 1_000_000 micros)
  estimated boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_cost_log_venue_time
  ON chat_cost_log (venue_id, occurred_at DESC) WHERE venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_cost_log_user_time
  ON chat_cost_log (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_cost_log_source_time
  ON chat_cost_log (source, occurred_at DESC);

ALTER TABLE chat_cost_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_owners_read_chat_cost" ON chat_cost_log
  FOR SELECT USING (
    venue_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );

-- ─── loop_health_per_venue view ─────────────────────────────────
-- One row per venue. Powers the dash Today panel.

CREATE OR REPLACE VIEW loop_health_per_venue AS
SELECT
  v.id AS venue_id,
  v.name AS venue_name,

  -- Check-ins in last 7 days
  (
    SELECT COUNT(*)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
  ) AS checkins_7d,

  -- Distinct guests with any check-in in last 7 days
  (
    SELECT COUNT(DISTINCT e.user_id)::int
    FROM loop_events e
    WHERE e.venue_id = v.id
      AND e.event = 'checkin_completed'
      AND e.occurred_at >= now() - INTERVAL '7 days'
      AND e.user_id IS NOT NULL
  ) AS active_guests_7d,

  -- Returns: check-ins by users with at least one prior check-in at this venue
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

  -- Unprompted returns: returns NOT preceded by a return_visit_prompted
  -- event for that user in the prior 24h.
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

  -- Chat cost in last 7 days (USD)
  COALESCE((
    SELECT (SUM(cost_micros)::numeric / 1000000.0)
    FROM chat_cost_log
    WHERE venue_id = v.id
      AND occurred_at >= now() - INTERVAL '7 days'
  ), 0)::numeric(12,4) AS chat_cost_usd_7d,

  -- Perk redemptions in last 7 days
  (
    SELECT COUNT(*)::int
    FROM perk_redemptions
    WHERE venue_id = v.id
      AND created_at >= now() - INTERVAL '7 days'
  ) AS redemptions_7d

FROM venues v;

-- ─── Comments ───────────────────────────────────────────────────

COMMENT ON TABLE loop_events IS
  'Phase 0 loop telemetry. One row per customer-loop event. Read by loop_health_per_venue view.';

COMMENT ON TABLE chat_cost_log IS
  'Per-AI-call cost tracking. Decoupled from chat_messages so the existing chat insert path stays unchanged.';

COMMENT ON COLUMN chat_cost_log.cost_micros IS
  'USD micros: 1 USD = 1,000,000 micros. estimated=true when cost is derived from a static per-model price (no provider-reported usage).';

COMMENT ON VIEW loop_health_per_venue IS
  'Per-venue 7-day loop health. Powers the dash-app Today loop-health panel. One row per venue.';
