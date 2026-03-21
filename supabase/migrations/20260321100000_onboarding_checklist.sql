-- Onboarding checklist + reminder email state
ALTER TABLE venue_pages
  ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb DEFAULT '{"basics":false,"location":false,"hours":false,"branding":false,"offerings":false,"knowledge":false,"photos":false,"xp":false,"stripe":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_email_state jsonb DEFAULT '{"welcome_sent":false,"day2_sent":false,"day5_sent":false,"day14_sent":false,"created_at":null}'::jsonb;
