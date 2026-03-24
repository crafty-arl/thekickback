-- Simple per-user memory (replaces complex user_preferences)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS memory text DEFAULT '';
