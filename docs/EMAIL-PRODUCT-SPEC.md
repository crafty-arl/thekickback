# theKickBack — Email Product Spec

## Two Products, One Backend

### Product 1: Email Channel (US/Western)
- User's inbox IS the venue experience
- Rich HTML emails with venue branding
- Threaded conversations per venue
- Scheduled digests for connected venues
- Wallet pass link in every email

### Product 2: WhatsApp Business (Global)
- Same experience, WhatsApp as transport
- Rich messages, buttons, media
- Same backend (Supabase + OpenClaw)

---

## Email Experience — End to End

### 1. Welcome Email (on JOIN)

Triggered when user enters email on venue page or emails join@thekickback.net

```
From: The Rooftop via theKickBack <the-rooftop@thekickback.net>
Subject: Welcome to The Rooftop ✦

┌──────────────────────────────────────────┐
│                                          │
│  [Hero image / gradient]                 │
│                                          │
│  ● LIVE                                  │
│  The Rooftop                             │
│  Downtown · Quiet · 14 people            │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  You're in. Here's what you can do:      │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │  Menu    │  │ Reserve  │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐             │
│  │  Events  │  │  Status  │             │
│  └──────────┘  └──────────┘             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  📲 Add to Apple/Google Wallet     │  │
│  │  Live updates on your lock screen  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Or just reply to this email with:       │
│  MENU · ASK · REQUEST · STATUS           │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  House Rules:                            │
│  • Quiet after 6 PM                      │
│  • Members get priority booths           │
│  • Free Wi-Fi for all guests             │
│                                          │
├──────────────────────────────────────────┤
│  powered by theKickBack                  │
│  Unsubscribe · Privacy                   │
└──────────────────────────────────────────┘
```

### 2. Command Response Emails

When user replies with a command, the response is also rich HTML:

**"MENU" reply:**
```
From: The Rooftop via theKickBack
Subject: Re: Welcome to The Rooftop ✦

┌──────────────────────────────────────────┐
│  The Rooftop — Menu                      │
│                                          │
│  DRINKS                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │Cold    │ │Matcha  │ │Sparkling│     │
│  │Brew $5 │ │$6      │ │Water $3│      │
│  │[Order] │ │[Order] │ │[Order] │      │
│  └────────┘ └────────┘ └────────┘      │
│                                          │
│  FOOD                                    │
│  ┌────────┐ ┌────────┐                  │
│  │Grain   │ │Avo     │                  │
│  │Bowl $14│ │Toast$12│                  │
│  │[Order] │ │[Order] │                  │
│  └────────┘ └────────┘                  │
│                                          │
│  Reply ORDER [item] to place an order    │
└──────────────────────────────────────────┘
```

**"STATUS" reply:**
```
┌──────────────────────────────────────────┐
│  Your Session — The Rooftop              │
│                                          │
│  Status    Guest                         │
│  Vibe      ● Quiet (14 people)           │
│  Time      47 min                        │
│  Requests  0 pending                     │
│                                          │
│  ████████░░░░░░░  28% full               │
│                                          │
│  Reply LEAVE to exit · MEMBERSHIP for ⬆  │
└──────────────────────────────────────────┘
```

### 3. Venue Push Emails (Proactive)

Sent by the venue through the dashboard:

```
From: The Rooftop via theKickBack
Subject: Happy hour starts in 15 min 🍊

┌──────────────────────────────────────────┐
│  [Event image]                           │
│                                          │
│  Happy Hour at The Rooftop               │
│  5 PM – 7 PM · 50% off all drinks       │
│                                          │
│  Currently: ● Moderate · 28 people       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Reserve a Booth →             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      View Full Menu →              │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 4. Scheduled Digest

Weekly or configurable per user. Shows all connected venues:

```
From: theKickBack <digest@thekickback.net>
Subject: What's happening at your spots this week

┌──────────────────────────────────────────┐
│  theKickBack Weekly                      │
│  3 venues · 12 visits this month         │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  The Rooftop                             │
│  ● Quiet now · DJ set Friday 9 PM       │
│  New menu items: Spiced Cider, Fall Bowl │
│  [Open The Rooftop →]                    │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Daily Grind                             │
│  ● Busy now · Extended hours this week   │
│  Member special: Free pastry with coffee │
│  [Open Daily Grind →]                    │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  The Loft                                │
│  ● Quiet now · Wine tasting Saturday     │
│  New: Private room bookings available    │
│  [Open The Loft →]                       │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Manage preferences · Unsubscribe        │
│  powered by theKickBack                  │
└──────────────────────────────────────────┘
```

---

## Technical Architecture

### Email Sending Stack
- **Resend** or **Cloudflare Email Service** for sending rich HTML
- **React Email** for templating (JSX → HTML email)
- **Cloudflare Email Worker** for receiving replies (already built)

### Components Needed
1. `WelcomeEmail` — on JOIN
2. `CommandResponseEmail` — rich reply to MENU/STATUS/ASK etc.
3. `VenuePushEmail` — proactive venue notifications
4. `DigestEmail` — weekly/configurable recap
5. `MembershipEmail` — upgrade confirmation
6. `WalletPassEmail` — pass delivery

### Supabase Tables Needed
- `email_subscriptions` — user ↔ venue connections + preferences
- `email_logs` — sent emails for tracking
- `digest_preferences` — frequency, time, enabled

### Cron Jobs
- Weekly digest: Cloudflare Worker cron trigger
- Venue push: triggered from dashboard by venue owner

---

## WhatsApp Business (Phase 2)

Same templates, same backend, different transport:
- Register WhatsApp Business account
- Use WhatsApp Cloud API (free for user-initiated, templates cost ~$0.005-0.05)
- Same component rendering but as WhatsApp interactive messages
- Buttons, list pickers, media supported natively

---

## Priority Order

1. Rich HTML welcome email (on JOIN) — with Resend or CF Email Service
2. Rich command response emails (MENU, STATUS, etc.)
3. Wallet pass link in every email
4. Scheduled digest
5. Venue push emails (from dashboard)
6. WhatsApp Business channel
