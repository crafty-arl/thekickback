-- ============================================
-- Phase 4: Chat ROI columns on loop_health_per_venue.
-- Surfaces "is chat actually driving action?" without inventing new tables.
-- chat_cost_per_action_usd_7d: $ cost / clicked actions
-- chat_action_rate_7d: clicked actions / messages sent (0..1)
-- ============================================

DROP VIEW IF EXISTS loop_health_per_venue;

CREATE VIEW loop_health_per_venue AS
WITH chat_msgs AS (
  SELECT venue_id, COUNT(*)::int AS n
  FROM loop_events
  WHERE event = 'chat_message_sent'
    AND occurred_at >= now() - INTERVAL '7 days'
    AND venue_id IS NOT NULL
  GROUP BY venue_id
),
chat_clicks AS (
  SELECT venue_id, COUNT(*)::int AS n
  FROM loop_events
  WHERE event = 'chat_action_clicked'
    AND occurred_at >= now() - INTERVAL '7 days'
    AND venue_id IS NOT NULL
  GROUP BY venue_id
),
chat_cost AS (
  SELECT venue_id, COALESCE(SUM(cost_micros), 0)::numeric AS micros
  FROM chat_cost_log
  WHERE occurred_at >= now() - INTERVAL '7 days'
    AND venue_id IS NOT NULL
  GROUP BY venue_id
)
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

  (
    SELECT COUNT(*)::int
    FROM vibe_drops
    WHERE venue_id = v.id
      AND created_at >= now() - INTERVAL '7 days'
  ) AS vibe_drops_7d,

  -- Phase 4 chat ROI
  COALESCE((SELECT n FROM chat_msgs WHERE venue_id = v.id), 0) AS chat_messages_7d,
  COALESCE((SELECT n FROM chat_clicks WHERE venue_id = v.id), 0) AS chat_action_clicks_7d,

  -- $ per action driven; null when there are zero clicked actions
  CASE
    WHEN COALESCE((SELECT n FROM chat_clicks WHERE venue_id = v.id), 0) = 0 THEN NULL
    ELSE (
      COALESCE((SELECT micros FROM chat_cost WHERE venue_id = v.id), 0)
        / 1000000.0
        / (SELECT n FROM chat_clicks WHERE venue_id = v.id)
    )::numeric(12,4)
  END AS chat_cost_per_action_usd_7d,

  -- Click-through rate from chat to action (0..1); null when zero messages
  CASE
    WHEN COALESCE((SELECT n FROM chat_msgs WHERE venue_id = v.id), 0) = 0 THEN NULL
    ELSE (
      COALESCE((SELECT n FROM chat_clicks WHERE venue_id = v.id), 0)::numeric
        / (SELECT n FROM chat_msgs WHERE venue_id = v.id)
    )::numeric(6,4)
  END AS chat_action_rate_7d

FROM venues v;

COMMENT ON VIEW loop_health_per_venue IS
  'Per-venue 7-day loop health. Powers the dash-app Today loop-health panel.';
