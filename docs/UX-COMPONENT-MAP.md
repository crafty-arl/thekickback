# theKickBack — UX Component Map

## The Flow

```
NFC Tap → Venue Page → "Join" → Verify (email/phone) → Conversation UI
                                                              ↓
                                                    User types/speaks naturally
                                                              ↓
                                                    AI selects components
                                                              ↓
                                                    Custom view renders
```

---

## Core Components

### 1. VenueHero
**Triggered by:** First load / "Where am I?"
**Shows:** Venue branding, name, vibe, live occupancy, hours
```
┌──────────────────────────────────┐
│  [Venue Logo]                    │
│  The Rooftop                     │
│  Downtown · Open now             │
│                                  │
│  ●  Quiet · 13 / 60 people      │
│  ██████░░░░░░░░░  22%            │
│                                  │
│  "Chill tonight. Good for focus."│
└──────────────────────────────────┘
```

---

### 2. JoinCard
**Triggered by:** First visit, not yet joined
**Shows:** Join prompt + verify method
**Actions:** Enter email or phone → verify → join
```
┌──────────────────────────────────┐
│  You're at The Rooftop           │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Continue with Email       │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Continue with Phone       │  │
│  └────────────────────────────┘  │
│                                  │
│  No app. No account. Just you.   │
└──────────────────────────────────┘
```

---

### 3. MenuCard
**Triggered by:** "What's good here?" / "Show me the menu" / "I'm hungry"
**Shows:** Menu items, categories, prices, dietary tags
**Actions:** Tap item → adds to request
```
┌──────────────────────────────────┐
│  The Rooftop — Menu              │
│                                  │
│  DRINKS                          │
│  ┌──────────────┐ ┌────────────┐ │
│  │ Cold Brew    │ │ Matcha     │ │
│  │ $5    [Add]  │ │ $6  [Add]  │ │
│  └──────────────┘ └────────────┘ │
│                                  │
│  FOOD                            │
│  ┌──────────────┐ ┌────────────┐ │
│  │ Grain Bowl   │ │ Avo Toast  │ │
│  │ $14   [Add]  │ │ $12 [Add]  │ │
│  └──────────────┘ └────────────┘ │
│                                  │
│  "I'm vegan" → filters applied  │
└──────────────────────────────────┘
```

---

### 4. BoothPicker
**Triggered by:** "I need a booth" / "Table for 4" / "Somewhere quiet"
**Shows:** Available booths/tables, location, capacity, hold option
**Actions:** Tap booth → hold → confirmed
```
┌──────────────────────────────────┐
│  Available Seating               │
│                                  │
│  ┌──────────┐  ┌──────────┐     │
│  │ Booth 2   │  │ Booth 4  │     │
│  │ Window    │  │ Corner   │     │
│  │ Seats 4   │  │ Seats 2  │     │
│  │ Quiet     │  │ Quiet    │     │
│  │  [Hold]   │  │  [Hold]  │     │
│  └──────────┘  └──────────┘     │
│                                  │
│  ┌──────────┐                    │
│  │ Patio 1   │                   │
│  │ Outdoor   │                   │
│  │ Seats 6   │                   │
│  │ Moderate  │                   │
│  │  [Hold]   │                   │
│  └──────────┘                    │
└──────────────────────────────────┘
```

---

### 5. ReservationFlow
**Triggered by:** "Book a booth at 8" / "Reserve for Friday"
**Shows:** Date/time picker, party size, available slots
**Actions:** Select time → select size → confirm
```
┌──────────────────────────────────┐
│  Reserve at The Rooftop          │
│                                  │
│  When?                           │
│  [Today ▾]  [8:00 PM ▾]         │
│                                  │
│  Party size?                     │
│  [1] [2] [3] [4] [5] [6+]       │
│                                  │
│  Available:                      │
│  ┌────────────────────────────┐  │
│  │ Booth 4 · Window · 8 PM   │  │
│  │           [Reserve]        │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Patio 1 · Outdoor · 8 PM  │  │
│  │           [Reserve]        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 6. EventCard
**Triggered by:** "What's happening tonight?" / "Any events?" / "Live music?"
**Shows:** Upcoming events, time, description, RSVP
**Actions:** Tap → RSVP or details
```
┌──────────────────────────────────┐
│  Tonight at The Rooftop          │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🎵 DJ Set — Kya            │  │
│  │ 9 PM – 12 AM               │  │
│  │ Rooftop floor               │  │
│  │ Free for members            │  │
│  │              [RSVP]         │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🍷 Wine Tasting             │  │
│  │ 7 PM – 8:30 PM             │  │
│  │ Bar area · $15              │  │
│  │              [RSVP]         │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 7. OrderTracker
**Triggered by:** "Where's my order?" / "Status" / after placing request
**Shows:** Active requests, status, ETA
**Actions:** Cancel, modify
```
┌──────────────────────────────────┐
│  Your Requests                   │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 2x Cold Brew               │  │
│  │ ● Preparing — ~5 min       │  │
│  │              [Cancel]       │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Booth 4 hold               │  │
│  │ ● Confirmed — 8 min left   │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 8. VibeCheck
**Triggered by:** "What's the vibe?" / "Is it busy?" / "Should I come?"
**Shows:** Live vibe, occupancy trend, noise level, crowd type
**Actions:** Informational — may suggest best time
```
┌──────────────────────────────────┐
│  The Rooftop — Right Now         │
│                                  │
│  Vibe:  ● Quiet                  │
│  Crowd: Mostly solo / small groups│
│  Noise: Low                      │
│  Energy: Chill                   │
│                                  │
│  Occupancy trend:                │
│  6PM ░░██████████░░░░░ 11PM      │
│       ↑ you are here             │
│                                  │
│  "Great for focus right now.     │
│   Gets busy around 9 PM."       │
└──────────────────────────────────┘
```

---

### 9. CommunityFeed
**Triggered by:** "Who's here?" / "What are people saying?" / "Any groups?"
**Shows:** Anonymous activity feed, groups, shared interests
**Actions:** Wave, join group, post
```
┌──────────────────────────────────┐
│  The Rooftop — Community         │
│                                  │
│  3 groups · 13 people            │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Study group · Booth 2      │  │
│  │ 4 people · "Calc final"    │  │
│  │              [Wave]         │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Solo · Bar area            │  │
│  │ "Working on a pitch deck"  │  │
│  │              [Wave]         │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ + Share what you're up to  │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 10. MembershipCard
**Triggered by:** "How do I become a member?" / "Membership" / "Perks?"
**Shows:** Tiers, benefits, price, current status
**Actions:** Join, upgrade, cancel
```
┌──────────────────────────────────┐
│  The Rooftop — Membership        │
│                                  │
│  You're a Guest                  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ MEMBER · $25/mo            │  │
│  │                            │  │
│  │ → Priority booths          │  │
│  │ → Skip the wait            │  │
│  │ → Members-only events      │  │
│  │ → 10% off menu             │  │
│  │                            │  │
│  │         [Join — $25/mo]    │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ VIP · $75/mo               │  │
│  │                            │  │
│  │ → Everything in Member     │  │
│  │ → Reserved booth anytime   │  │
│  │ → Bring +1 free            │  │
│  │ → Early access to events   │  │
│  │                            │  │
│  │         [Join — $75/mo]    │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 11. WalletPassPrompt
**Triggered by:** After joining / "Add to wallet" / AI suggests it
**Shows:** Pass preview, add button
**Actions:** Tap → .pkpass downloads → Add to Wallet
```
┌──────────────────────────────────┐
│  Stay connected                  │
│                                  │
│  Add The Rooftop to your Wallet  │
│  for live updates on your        │
│  lock screen.                    │
│                                  │
│  ┌────────────────────────────┐  │
│  │  [pass preview image]      │  │
│  │  Vibe · People · Status    │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │   Add to Apple Wallet 📲   │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │   Save to Google Wallet    │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 12. ConversationInput
**Triggered by:** Always present at bottom
**Shows:** Text input, voice button, quick actions
**Actions:** Type or speak → AI processes → renders components
```
┌──────────────────────────────────┐
│                                  │
│  Quick:                          │
│  [Menu] [Reserve] [Vibe] [Help]  │
│                                  │
│  ┌────────────────────────┐ 🎤  │
│  │ Ask anything...        │ ↑   │
│  └────────────────────────┘     │
└──────────────────────────────────┘
```

---

## AI Component Selection Logic

```
User input → AI classifies intent → selects component(s) → fills with venue data

Examples:
"What's good here?"           → [MenuCard] filtered by popular
"I'm vegan, what can I eat?"  → [MenuCard] filtered by vegan tag
"Book a booth for 4 at 8"    → [ReservationFlow] pre-filled
"What's the vibe?"            → [VibeCheck]
"Who's here?"                 → [CommunityFeed]
"Where's my cold brew?"      → [OrderTracker]
"I want to be a member"      → [MembershipCard]
"Show me everything"         → [VenueHero] + [VibeCheck] + [MenuCard] + [EventCard]
"I'm leaving"                → [OrderTracker] (close out) + [WalletPassPrompt]
```

---

## Component Summary

| # | Component | Trigger | Interactive |
|---|-----------|---------|-------------|
| 1 | VenueHero | First load | No |
| 2 | JoinCard | Not joined | Yes — verify |
| 3 | MenuCard | Food/drink queries | Yes — add items |
| 4 | BoothPicker | Seating queries | Yes — hold/reserve |
| 5 | ReservationFlow | Future booking | Yes — date/time/confirm |
| 6 | EventCard | Event queries | Yes — RSVP |
| 7 | OrderTracker | Status queries | Yes — cancel/modify |
| 8 | VibeCheck | Vibe queries | No |
| 9 | CommunityFeed | Social queries | Yes — wave/post |
| 10 | MembershipCard | Membership queries | Yes — join/upgrade |
| 11 | WalletPassPrompt | After join / leave | Yes — add pass |
| 12 | ConversationInput | Always | Yes — type/speak |
