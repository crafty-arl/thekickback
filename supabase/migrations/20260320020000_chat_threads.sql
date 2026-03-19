-- ============================================
-- Persistent Chat Threads
-- One thread per user per venue (+ one master thread)
-- ============================================

CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  -- NULL venue_id = master concierge thread
  thread_type text NOT NULL DEFAULT 'venue' CHECK (thread_type IN ('venue', 'master')),
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  unread boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- One venue thread per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_user_venue
  ON chat_threads (user_id, venue_id) WHERE venue_id IS NOT NULL;

-- One master thread per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_master
  ON chat_threads (user_id) WHERE venue_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_recent
  ON chat_threads (user_id, last_message_at DESC);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_threads" ON chat_threads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "service_manage_threads" ON chat_threads
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Add thread_id and user_id to chat_messages ─────────────────

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES chat_threads(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
  ON chat_messages (thread_id, created_at ASC);

-- ─── Function: Upsert thread + save message atomically ──────────

CREATE OR REPLACE FUNCTION save_thread_message(
  p_user_id uuid,
  p_venue_id uuid,       -- NULL for master
  p_sender_type text,     -- 'guest' or 'ai'
  p_body text
) RETURNS uuid AS $$
DECLARE
  v_thread_id uuid;
  v_thread_type text;
BEGIN
  v_thread_type := CASE WHEN p_venue_id IS NULL THEN 'master' ELSE 'venue' END;

  -- Upsert thread
  IF p_venue_id IS NULL THEN
    INSERT INTO chat_threads (user_id, venue_id, thread_type, last_message, last_message_at, message_count)
    VALUES (p_user_id, NULL, 'master', p_body, now(), 1)
    ON CONFLICT (user_id) WHERE venue_id IS NULL
    DO UPDATE SET
      last_message = p_body,
      last_message_at = now(),
      message_count = chat_threads.message_count + 1,
      unread = CASE WHEN p_sender_type = 'ai' THEN true ELSE chat_threads.unread END
    RETURNING id INTO v_thread_id;
  ELSE
    INSERT INTO chat_threads (user_id, venue_id, thread_type, last_message, last_message_at, message_count)
    VALUES (p_user_id, p_venue_id, 'venue', p_body, now(), 1)
    ON CONFLICT (user_id, venue_id) WHERE venue_id IS NOT NULL
    DO UPDATE SET
      last_message = p_body,
      last_message_at = now(),
      message_count = chat_threads.message_count + 1,
      unread = CASE WHEN p_sender_type = 'ai' THEN true ELSE chat_threads.unread END
    RETURNING id INTO v_thread_id;
  END IF;

  -- Save message
  INSERT INTO chat_messages (venue_id, thread_id, user_id, sender_type, body)
  VALUES (p_venue_id, v_thread_id, p_user_id, p_sender_type, p_body);

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
