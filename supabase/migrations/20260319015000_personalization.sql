-- ============================================
-- Personalization Engine
-- AI-extracted + user-confirmed preferences
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'dietary', 'vibe', 'venue_type', 'group_size',
    'time', 'order', 'neighborhood', 'interest', 'general'
  )),
  key text NOT NULL,
  value text NOT NULL,
  confidence real DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1.0),
  source text DEFAULT 'ai' CHECK (source IN ('ai', 'user', 'behavior')),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, key, venue_id)
);

-- Partial unique index for global preferences (venue_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_global
  ON user_preferences (user_id, key) WHERE venue_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_venue ON user_preferences(user_id, venue_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_manage_own_preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_manage_preferences" ON user_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Function: Upsert Preference ─────────────────────────────────
-- Called by the extraction pipeline. Increases confidence on repeat signals.

CREATE OR REPLACE FUNCTION upsert_preference(
  p_user_id uuid,
  p_category text,
  p_key text,
  p_value text,
  p_confidence real DEFAULT 0.5,
  p_source text DEFAULT 'ai',
  p_venue_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO user_preferences (user_id, category, key, value, confidence, source, venue_id)
  VALUES (p_user_id, p_category, p_key, p_value, p_confidence, p_source, p_venue_id)
  ON CONFLICT (user_id, key, venue_id) DO UPDATE SET
    value = p_value,
    -- Increase confidence on repeated signals (max 0.95 for AI, 1.0 for user)
    confidence = LEAST(
      CASE WHEN p_source = 'user' THEN 1.0
           ELSE user_preferences.confidence + (1.0 - user_preferences.confidence) * 0.3
      END,
      CASE WHEN p_source = 'user' THEN 1.0 ELSE 0.95 END
    ),
    source = CASE WHEN p_source = 'user' THEN 'user' ELSE user_preferences.source END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
