-- Add reminder_sent column to event_rsvps for 24h event reminders
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS reminder_sent boolean;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_reminder
  ON event_rsvps (offering_id, status)
  WHERE reminder_sent IS NULL;
