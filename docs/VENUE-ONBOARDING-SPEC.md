# Venue Onboarding — Spec

## Channels
- **Web:** `dash.thekickback.net/onboarding` — chat UI
- **Email:** venue owner emails, OpenClaw AI conducts onboarding via Resend replies

## Flow

### Step 1: Start
- Venue owner signs up (email auth on dash.thekickback.net)
- Redirected to `/onboarding` — conversational chat interface
- OR venue owner emails `onboard@chat.thekickback.net` to start

### Step 2: AI Conversation (OpenClaw)
OpenClaw guides through these questions (not a form — natural conversation):

1. **Venue name** → `venues.name`
2. **Address** → Nominatim geocode → `venues.lat`, `venues.lng`, `venues.address`, `venues.neighborhood`
3. **Type** (bar, cafe, restaurant, lounge, cowork) → `venues.type` (new column)
4. **Capacity** → `venues.max_occupancy`
5. **Hours** → `venue_pages.hours`
6. **Menu highlights** → `venue_pages.menu_sections`
7. **House rules** → `venues.rules`
8. **Tagline** (one sentence vibe) → `venue_pages.tagline`
9. **Hero image** → owner uploads → `venue_pages.hero_image`
10. **Theme color** → AI suggests based on type, owner can override → `venue_pages.theme_color`

AI progressively saves each answer to Supabase as the conversation progresses (not all at the end).

### Step 3: Preview
- AI renders a preview card of the venue page
- Owner can say "change the tagline" or "update hours" — AI adjusts
- Preview shows exactly what `join.thekickback.net/[slug]` will look like

### Step 4: Submit for Review
- Owner confirms → venue saved with `venue_pages.published = false`
- Admin gets notified (email + dash.thekickback.net admin view)
- Admin reviews on dashboard → approves or requests changes
- On approval → `venue_pages.published = true` → venue page goes live

## Database Changes

### Add to `venues` table:
```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS type text DEFAULT 'venue';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS lng double precision;
```

### New column on `venue_pages`:
```sql
ALTER TABLE venue_pages ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending';
-- Values: 'pending', 'approved', 'changes_requested'
ALTER TABLE venue_pages ADD COLUMN IF NOT EXISTS review_notes text;
```

## OpenStreetMap / Nominatim Integration

```
Owner: "We're at 123 Main St Indianapolis"
        ↓
GET https://nominatim.openstreetmap.org/search?q=123+Main+St+Indianapolis&format=json&limit=1
        ↓
Response: { lat, lon, display_name }
        ↓
AI: "Found it — 123 Main St, Indianapolis, IN 46204. Is that right?"
        ↓
Owner confirms → save lat, lng, address, neighborhood to venues table
```

- Nominatim is free, no API key
- Rate limit: 1 request/second (fine for onboarding)
- User-Agent header required: `theKickBack/1.0`

## OpenClaw Agent Prompt

The onboarding agent needs a system prompt that:
- Knows the venue schema (all fields)
- Asks one question at a time
- Validates answers (e.g. hours format, address exists)
- Saves progressively to Supabase after each confirmed answer
- Can handle corrections ("actually change that to...")
- Generates slug from venue name
- Suggests theme color based on venue type
- Generates description from the conversation context
- Shows preview when all required fields are filled
- Knows that hero image must be uploaded (not AI generated)

## Email Onboarding Flow

Same conversation but via email:

```
Owner emails: onboard@chat.thekickback.net
Subject: "I want to add my venue"

Resend webhook → email worker → OpenClaw processes
        ↓
Rich HTML reply: "Welcome! Let's get your venue set up. What's the name of your spot?"
        ↓
Owner replies: "The Rooftop"
        ↓
Next question sent as rich HTML email
        ↓
... continues until all fields collected
        ↓
Final email: "Here's your venue preview" [rendered card]
Owner replies: "Looks great" or "Change X"
        ↓
Submitted for admin review
```

## Admin Review (dash.thekickback.net)

- New section on dashboard: "Pending Reviews"
- Shows venue submissions with all data
- Preview of how the venue page will look
- Approve button → sets published = true, notifies owner
- Request Changes button → sends email to owner with notes

## Priority Order

1. Database migrations (add columns)
2. OpenClaw agent prompt for onboarding
3. Nominatim geocoding integration
4. Chat UI on dash.thekickback.net/onboarding
5. Progressive save to Supabase
6. Preview component
7. Admin review on dashboard
8. Email onboarding channel
9. Owner notification on approval
