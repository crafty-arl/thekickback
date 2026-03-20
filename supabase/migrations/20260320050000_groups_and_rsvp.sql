-- ============================================
-- Groups, Orgs, Leagues + RSVP System
-- Extends venues to support community groups
-- ============================================

-- ─── RSVP for event offerings ────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES venue_offerings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES offering_slots(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('interested', 'going', 'attended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_offering ON event_rsvps(offering_id, status);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id, status);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_venue ON event_rsvps(venue_id);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_rsvps" ON event_rsvps
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "service_manage_rsvps" ON event_rsvps
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Add RSVP count to offerings ─────────────────────────────────

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS rsvp_count integer DEFAULT 0;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS max_attendees integer;
-- null = unlimited, number = cap

-- ─── Function: RSVP to an event ──────────────────────────────────

CREATE OR REPLACE FUNCTION rsvp_event(
  p_user_id uuid,
  p_offering_id uuid,
  p_status text DEFAULT 'going'
) RETURNS jsonb AS $$
DECLARE
  v_offering RECORD;
  v_venue_id uuid;
  v_current_count integer;
BEGIN
  -- Get offering
  SELECT * INTO v_offering FROM venue_offerings
  WHERE id = p_offering_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  v_venue_id := v_offering.venue_id;

  -- Check capacity
  IF v_offering.max_attendees IS NOT NULL AND p_status = 'going' THEN
    SELECT count(*) INTO v_current_count FROM event_rsvps
    WHERE offering_id = p_offering_id AND status = 'going';
    IF v_current_count >= v_offering.max_attendees THEN
      RETURN jsonb_build_object('error', 'Event is full');
    END IF;
  END IF;

  -- Upsert RSVP
  INSERT INTO event_rsvps (user_id, offering_id, venue_id, status)
  VALUES (p_user_id, p_offering_id, v_venue_id, p_status)
  ON CONFLICT (user_id, offering_id) DO UPDATE SET
    status = p_status,
    updated_at = now();

  -- Update count
  UPDATE venue_offerings SET rsvp_count = (
    SELECT count(*) FROM event_rsvps
    WHERE offering_id = p_offering_id AND status IN ('going', 'attended')
  ) WHERE id = p_offering_id;

  RETURN jsonb_build_object(
    'status', p_status,
    'offering_id', p_offering_id,
    'rsvp_count', (SELECT rsvp_count FROM venue_offerings WHERE id = p_offering_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
