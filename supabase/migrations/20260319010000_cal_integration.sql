-- Add Cal.com integration fields
-- cal_event_type_id on offerings links to the Cal.com event type
-- cal_api_key on venues stores the venue's Cal.com API key

alter table venue_offerings
  add column if not exists cal_event_type_id integer;

alter table venues
  add column if not exists cal_api_key text;
