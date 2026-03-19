-- Fix upsert_preference to handle NULL venue_id correctly.
-- PostgreSQL's ON CONFLICT doesn't match NULL = NULL,
-- so we use a manual check-then-insert/update pattern.

CREATE OR REPLACE FUNCTION upsert_preference(
  p_user_id uuid,
  p_category text,
  p_key text,
  p_value text,
  p_confidence real DEFAULT 0.5,
  p_source text DEFAULT 'ai',
  p_venue_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  existing_id uuid;
  new_confidence real;
BEGIN
  -- Find existing preference (handle NULL venue_id with IS NOT DISTINCT FROM)
  SELECT id INTO existing_id
  FROM user_preferences
  WHERE user_id = p_user_id
    AND key = p_key
    AND venue_id IS NOT DISTINCT FROM p_venue_id;

  IF existing_id IS NOT NULL THEN
    -- Update: increase confidence on repeated signals
    new_confidence := CASE
      WHEN p_source = 'user' THEN 1.0
      ELSE LEAST(
        (SELECT confidence FROM user_preferences WHERE id = existing_id)
          + (1.0 - (SELECT confidence FROM user_preferences WHERE id = existing_id)) * 0.3,
        0.95
      )
    END;

    UPDATE user_preferences SET
      value = p_value,
      confidence = new_confidence,
      source = CASE WHEN p_source = 'user' THEN 'user' ELSE source END,
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    -- Insert new preference
    INSERT INTO user_preferences (user_id, category, key, value, confidence, source, venue_id)
    VALUES (p_user_id, p_category, p_key, p_value, p_confidence, p_source, p_venue_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
