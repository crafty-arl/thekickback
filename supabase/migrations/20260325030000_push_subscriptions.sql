-- Web push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text UNIQUE NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on push_subscriptions" ON push_subscriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions FOR ALL USING (user_id = auth.uid());
