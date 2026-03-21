-- ─── Digital Assets: stickers, badges, 3D pins for map decorations ──

-- Asset catalog (hub-specific or network-wide)
CREATE TABLE IF NOT EXISTS digital_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('sticker', 'badge', '3d_pin')),
  asset_url TEXT NOT NULL DEFAULT '',
  xp_cost INTEGER,
  point_cost INTEGER,
  wallet_price_cents INTEGER,
  cash_price_cents INTEGER,
  hub_revenue_share NUMERIC(3,2) DEFAULT 0.70,
  min_tier TEXT CHECK (min_tier IS NULL OR min_tier IN ('explorer', 'regular', 'member', 'vip')),
  min_kickback_score INTEGER,
  hub_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'vibe' CHECK (category IN ('vibe', 'shoutout', 'love', 'event', 'trophy', 'custom')),
  is_animated BOOLEAN DEFAULT false,
  is_3d BOOLEAN DEFAULT false,
  duration_hours INTEGER,  -- null = permanent
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User-placed assets on the map
CREATE TABLE IF NOT EXISTS map_decorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES digital_assets(id) ON DELETE CASCADE,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  placed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_visible BOOLEAN DEFAULT true
);

-- Purchase / unlock ledger
CREATE TABLE IF NOT EXISTS asset_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES digital_assets(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('venue_xp', 'network_points', 'wallet', 'cash')),
  xp_spent INTEGER DEFAULT 0,
  points_spent INTEGER DEFAULT 0,
  amount_charged_cents INTEGER DEFAULT 0,
  stripe_charge_id TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digital_assets_hub ON digital_assets(hub_id);
CREATE INDEX IF NOT EXISTS idx_map_decorations_venue ON map_decorations(venue_id);
CREATE INDEX IF NOT EXISTS idx_map_decorations_user ON map_decorations(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_unlocks_user ON asset_unlocks(user_id);

-- RLS
ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_unlocks ENABLE ROW LEVEL SECURITY;

-- Everyone can read active assets
CREATE POLICY "Anyone can view active assets"
  ON digital_assets FOR SELECT
  USING (active = true);

-- Hub owners can manage their own assets (via service key in practice, but useful for direct queries)
CREATE POLICY "Owners manage own assets"
  ON digital_assets FOR ALL
  USING (hub_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid()));

-- Users can read their own decorations
CREATE POLICY "Users see own decorations"
  ON map_decorations FOR SELECT
  USING (user_id = auth.uid());

-- All visible decorations near a venue are public
CREATE POLICY "Public decorations"
  ON map_decorations FOR SELECT
  USING (is_visible = true);

-- Users can place decorations
CREATE POLICY "Users place decorations"
  ON map_decorations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users see own unlocks
CREATE POLICY "Users see own unlocks"
  ON asset_unlocks FOR SELECT
  USING (user_id = auth.uid());
