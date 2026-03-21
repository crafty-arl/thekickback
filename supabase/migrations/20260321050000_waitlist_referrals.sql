-- Waitlist entries
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  referred_by uuid, -- user who referred them
  referral_key text, -- the key they used
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Referral keys per user
CREATE TABLE IF NOT EXISTS referral_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL UNIQUE,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_keys_user ON referral_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_keys_key ON referral_keys(key);
