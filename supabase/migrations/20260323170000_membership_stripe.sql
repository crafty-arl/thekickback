ALTER TABLE memberships ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_sub ON memberships (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
