-- ============================================
-- Staff Email Invite + Profile Sync
-- Add email and invite_status to venue_staff
-- ============================================

-- Add email column (for invite lookup)
ALTER TABLE venue_staff ADD COLUMN IF NOT EXISTS email text;

-- Add invite status
ALTER TABLE venue_staff ADD COLUMN IF NOT EXISTS invite_status text DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted'));

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_venue_staff_email ON venue_staff(email);

-- Allow staff to update their own row (schedule, bio, specialties)
CREATE POLICY "Staff can update own profile"
  ON venue_staff FOR UPDATE
  USING (user_id = (SELECT id FROM profiles WHERE email = (SELECT auth.jwt() ->> 'email')))
  WITH CHECK (user_id = (SELECT id FROM profiles WHERE email = (SELECT auth.jwt() ->> 'email')));

-- Allow staff to view their own row even if not visible
CREATE POLICY "Staff can view own profile"
  ON venue_staff FOR SELECT
  USING (user_id = (SELECT id FROM profiles WHERE email = (SELECT auth.jwt() ->> 'email')));
