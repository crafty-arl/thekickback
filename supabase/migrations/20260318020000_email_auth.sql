-- ============================================
-- Add email support to profiles for venue owner auth
-- ============================================

-- Add email column (nullable — existing phone-only profiles won't break)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- ============================================
-- Additional RLS policies for email-based auth
-- ============================================

-- Venue owners can select their own rows (by auth uid)
CREATE POLICY "venue_owners_select_by_uid" ON venue_owners
  FOR SELECT USING (user_id = auth.uid());

-- Authenticated users can insert venue_owner rows for themselves
CREATE POLICY "venue_owners_insert_own" ON venue_owners
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Authenticated users can create venues (for onboarding)
CREATE POLICY "venues_insert_authenticated" ON venues
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Venue owners can update their own venues
CREATE POLICY "venues_update_own" ON venues
  FOR UPDATE USING (
    id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );

-- Authenticated users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can view own profile by uid
CREATE POLICY "profiles_select_by_uid" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update own profile by uid
CREATE POLICY "profiles_update_by_uid" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Venue owners can insert venue_pages for their venues
CREATE POLICY "venue_pages_insert_own" ON venue_pages
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );

-- Venue owners can view their own venue pages (even unpublished)
CREATE POLICY "venue_pages_select_own" ON venue_pages
  FOR SELECT USING (
    venue_id IN (SELECT venue_id FROM venue_owners WHERE user_id = auth.uid())
  );
