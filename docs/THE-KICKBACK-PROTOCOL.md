# theKickBack Protocol

### A deep dive into the infrastructure that gives every gathering place a voice.

*Written by a founder who believes the most important room you'll ever walk into doesn't have a sign-up page.*

---

> This is a redlining. An act of drawing the lines of a system that doesn't exist yet, but should. An invitation to reimagine what infrastructure, commerce, and community could look like when we stop building for engagement and start building for belonging.

---

## 0. Why This Exists

You had a spot.

Maybe it was a barbershop where the conversation was better than the cut. Maybe it was a basketball court where you didn't need to know anyone's last name to run fives. Maybe it was a nail salon where you finally exhaled. A record shop. A bodega counter. The back patio of a place with no website and a hand-painted sign.

You had a spot, and it knew you.

Not because it tracked your data. Not because it had an app. Because the person behind the chair or behind the counter or behind the booth saw you come back, and one day said "the usual?" — and that was the moment you belonged somewhere.

We lost the infrastructure for that.

Not because the spots disappeared. They're still there — the barbershop on MLK, the taqueria on the corner, the studio that rents hourly, the league that runs Thursday nights. What disappeared was the *connective tissue*. The systems that help a newcomer find the spot. That help the spot find its people. That let the relationship between person and place grow into something that matters.

The internet built infrastructure for everything except the physical places where humans actually become community. We got social networks for strangers and delivery apps for isolation and review sites that reduce your favorite spot to a star rating from someone who visited once.

theKickBack is a protocol. A set of ideas expressed as software. It says: **what if every gathering place — every barbershop, every court, every studio, every kitchen, every corner that pulls people in — could become a living, intelligent, findable destination? What if the relationship between a person and their spot could grow, be recognized, and be rewarded without either side needing a tech degree?**

Open the map. Tap a pin. You're in.

---

## 1. The Redlining: What We're Drawing

### 1.1 The Line Against Apps

We made a conscious decision: **no app store.** Not because we can't build one. Because requiring a download is a gate, and a gate at the door of your neighborhood barbershop is an insult to what that place means.

theKickBack is a PWA — it lives in your browser, pins to your home screen, runs full-screen with a service worker. It also works through a text message or an email. Three channels, zero downloads.

The architecture maps to how people actually find and interact with places:

```
       OPEN THE MAP
            │
            ▼
   join.thekickback.net         (Next.js PWA)
   ├── Full-screen Mapbox GL map
   ├── GPS → fly to your location
   ├── Claimed hubs (Supabase) + Nearby places (Foursquare)
   ├── AI-curated tags: category, vibe, neighborhood, offering
   ├── Tap a pin → hub card → "Chat" or "Go"
   └── TheDock: bottom sheet (idle → explore → chat → profile)

       TEXT "JOIN"
            │
            ▼
   SMS via Twilio → Cloudflare Worker
   ├── Routes commands (JOIN, ASK, MENU, REQUEST, STATUS, LEAVE)
   ├── Same AI, same knowledge base
   └── Plain text

       EMAIL anything@[hub].thekickback.net
            │
            ▼
   Resend webhook → Cloudflare Worker
   ├── Rich HTML replies with hub branding
   └── AI-written daily digest (cron)
```

Each channel is first-class. The web is a full interactive map with AI chat and commerce. SMS is a conversational interface for people who don't want to open a browser. Email is a personalized daily letter from an AI that knows your taste.

### 1.2 The Line Against Accounts

No usernames. No passwords. No "sign up to continue."

You verify with a one-time email code. Your identity accretes over time: email first, then a device fingerprint, then optionally a passkey — your face or your thumb. You never "create an account." The system just starts recognizing you.

```typescript
export async function sendOtp(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error ? { error: error.message } : { success: true };
}
```

That's the complete sign-up flow. One function. No passwords to remember, no profile to fill out, no avatar to upload. Multi-device enforcement (max 3) keeps it secure. Passkeys make it instant.

### 1.3 The Line Against Extraction

When a guest pays a hub, the money flows directly through the hub's own Stripe Connect account. theKickBack does not stand between the barber and the person in the chair. A 2% platform fee is collected at wallet-load time — the hub always receives 100% of the ticket price.

The data we do build — your preferences, your visit patterns, your vibe affinities — stays in the relationship graph. It powers *your* experience. It never powers an ad.

---

## 2. Reimagining Infrastructure

### 2.1 The Map: Your City, Alive

When you open theKickBack, you see your city breathing. A full-screen Mapbox GL map renders in 3D with a 40° pitch. Your GPS fires. The camera sweeps to you. Pins appear.

Some pins are *claimed* — hubs that have set up their presence on theKickBack: a barbershop in Oak Cliff, a jewelry maker in East Austin, a pickup basketball league that runs Tuesday nights. These pins pulse with live data: real-time vibe, occupancy, theme colors chosen by the hub.

Other pins are *discovered* — nearby spots pulled from Foursquare's Places API, sitting there as gray potential. Unclaimed. Waiting for their person to say "that's my spot, I want it on the map."

```
       ┌──────────────────────────────────┐
       │          MAPBOX GL MAP           │
       │       3D pitch • GPS lock        │
       │                                  │
       │  🟢 Metro Barbershop (Quiet)     │
       │  🟡 Thursday Night League (Lively)│
       │  🔴 Studio 512 (Packed)          │
       │  ⚪ Joe's Corner Store (unclaimed)│
       └──────────────────────────────────┘
       ┌──────────────────────────────────┐
       │ TheDock                          │
       │ ✂️ Shops │ 🏋️ Groups │ 🔥 Poppin │
       │ [← Metro Barbershop card    →]  │
       └──────────────────────────────────┘
```

**TheDock** is the control center — a bottom sheet with three snap points and five modes:

| Mode | What It Does |
|------|-------------|
| **Idle** | Collapsed pill — hub name, vibe dot, text input |
| **Explore** | AI-curated shelves of hub cards, sorted by distance, tagged by category/vibe |
| **Concierge** | Network-wide AI — "what's poppin near me?" |
| **Hub Chat** | Full conversation with a specific hub's AI agent |
| **Profile** | Your tier, points, venues, preferences, devices |

Tags aren't static filters. They're lenses:

```typescript
export interface Tag {
  id: string;
  label: string;
  type: "venue" | "category" | "vibe" | "offering" | "neighborhood";
  color: string;
  venueIds: string[];
}
```

Tap "Barbershops" → map flies to the nearest one. Tap "Poppin" → highlights every hub where energy is high. Tap "East Side" → clusters the neighborhood. Navigation is built in — walking and driving directions from Mapbox, rendered on the map with turn-by-turn steps.

### 2.2 What Counts as a Hub

Look at what theKickBack actually supports:

```typescript
export const VENUE_CATEGORIES = [
  { value: "barbershop",  label: "Barbershops" },
  { value: "nail_salon",  label: "Nail Salons" },
  { value: "cafe",        label: "Cafes" },
  { value: "bar",         label: "Bars" },
  { value: "restaurant",  label: "Eats" },
  { value: "lounge",      label: "Lounges" },
  { value: "rooftop",     label: "Rooftops" },
  { value: "club",        label: "Clubs" },
  { value: "coworking",   label: "Cowork" },
  { value: "group",       label: "Groups" },
  { value: "community",   label: "Communities" },
  { value: "league",      label: "Leagues" },
  { value: "org",         label: "Orgs" },
  { value: "artist",      label: "Artists" },
  { value: "musician",    label: "Musicians" },
  { value: "creator",     label: "Creators" },
];
```

A barbershop is a hub. A community running club is a hub. A musician is a hub. An artist's studio is a hub. A recreational league is a hub. A nail salon is a hub. An organization is a hub.

This is the point. **Any center of gravity where humans gather around something real can plug into theKickBack.** Each hub gets its own storefront, its own AI agent, its own offerings, its own staff, its own theme color. The protocol doesn't prescribe what a "venue" is. It provides the infrastructure for any gathering point to become findable, conversational, and transactable.

The barber who's been cutting hair for twenty years has never had a technology platform that understood what he actually is: a gathering point. A place where people come not just for the service but for the *being there*. theKickBack gives him the same digital infrastructure as a venture-backed restaurant chain, in a text conversation.

### 2.3 The Hub Storefront: A Living Front Door

Tap "Go" on a hub card and you enter `join.thekickback.net/[slug]` — the hub's digital front door.

**The Header**: Hero image (uploaded by the owner, or a gradient generated from their theme color). Pulsing "LIVE" badge. Real-time vibe indicator (Quiet/Moderate/Busy/Packed — color-coded green to red). Occupancy as a fraction with percentage. Name. Tagline. Neighborhood and address.

**The Body**: Description. Photo gallery carousel. **Staff profiles** — faces, bios, specialties, linked to their specific services. **Offerings** — the commerce layer. Menu sections. House rules.

Offerings are typed and priced:

```
venue_offerings
├── type: "service"      │ Fade Haircut    │ $35     │ 45 min
├── type: "product"      │ Beard Oil       │ $18     │ one-time
├── type: "membership"   │ Monthly Pass    │ $30/mo  │ recurring
├── type: "event"        │ Open Mic Night  │ $10     │ one-time
├── type: "reservation"  │ Chair Booking   │ $5      │ one-time
├── type: "package"      │ Groom Package   │ $75     │ one-time
└── type: "custom"       │ Gift Card       │ $25     │ one-time
```

Staff members are linked to offerings through `staff_offerings` — so when you browse a barbershop's services, you see *which barbers do which cuts*, with their photos and specialties.

**The Chat Dock**: Fixed at the bottom. Tap it and a chat panel expands to 70% of the screen. Eight tabbed contexts:

| Tab | What It Sends | What You Get Back |
|-----|--------------|-------------------|
| Chat | (freeform) | Anything — ask the hub's AI whatever you want |
| Vibe | "what's the vibe right now?" | Live energy, crowd description, noise level |
| Menu | "show me the menu" | Full menu with AI commentary |
| Events | "any events tonight?" | What's happening, when, who's there |
| Reserve | "I'd like to reserve" | Booking flow |
| Shop | "what can I buy?" | Tappable offering cards with prices and "ADD" buttons |
| Subscribe | "how to stay updated?" | Newsletter/notification options |
| Join | "tell me about this place" | Story, membership info, how to get involved |

When the AI returns purchasable items, they render as **tappable cards** inside the chat — image, name, price, type badge, and an "ADD" button that drops items into a shopping cart. Tap a card to slide open a **Product Drawer** with the full details: hero image, description, duration, add-ons, and "Add to cart."

Chat threads are **persistent** — leave and come back, your conversation is still there.

### 2.4 The AI Wallet: Let the Machine Buy

The AI Wallet changes the mechanic of paying at a hub.

It's a **Stripe-backed prepaid balance**. You create it with one tap. Link a card via Stripe Checkout. Load funds — $10, $25, $50, $100, or a custom amount. The AI spends from your balance at any hub.

```
Fees are transparent:
  Wallet credit:           $25.00
  Stripe fee (2.9% + 30¢):  $1.03
  Platform fee (2%):         $0.50
  ─────────────────────────────
  Total charge:            $26.53
```

Shown upfront in a confirmation modal before you tap "Pay." The hub receives 100% of the item price. Platform fee was collected at load time.

You tell the hub's AI "I want a fade" — it knows the price, knows your wallet has funds, processes the charge. No checkout screen. No payment terminal interaction. The conversation *is* the commerce.

Transaction history is visible in the Wallet drawer: who charged what, when, at which hub, with status indicators.

### 2.5 The Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Map & UI | Next.js PWA + Mapbox GL + Framer Motion | Full-screen 3D map, animated sheets, AI chat |
| Discovery | Foursquare Places API | Nearby unclaimed places in real-time |
| AI Engine | OpenClaw (self-hosted) | Per-hub conversational agent with knowledge base |
| Data | Supabase (Postgres + Auth + Realtime) | 30 migrations: profiles, venues, sessions, offerings, points, wallets, passkeys |
| SMS | Twilio + Cloudflare Worker | Text-based hub interaction |
| Email | Resend + Cloudflare Worker | Inbound commands + rich HTML replies |
| Digest | Cloudflare Worker (cron) | AI-written personalized daily email |
| Wallet Passes | Express + passkit-generator | Apple + Google Wallet hub passes |
| AI Wallet | Stripe + Stripe Checkout | Prepaid balance, AI-driven purchases |
| Commerce | Stripe Connect | Direct hub payments |
| Dashboard | Next.js (dash-app) | Hub owner admin panel |
| Proxy | Caddy (auto-TLS) | HTTPS, service routing |
| Deploy | Docker + GitHub Actions | CI/CD, blue/green |

---

## 3. Reimagining Commerce

### 3.1 The Points Economy

The KickBack Score is an engagement metric that spans the entire network.

```
point_balances
├── available_points  → spendable at hubs
├── lifetime_points   → total ever earned
├── kickback_score    → engagement metric
├── tier              → explorer | regular | member | vip
├── current_streak    → consecutive weeks of engagement
└── venues_visited    → unique hubs
```

**Tiers:**

| Tier | Threshold | What It Means |
|------|-----------|---------------|
| Explorer | 0 | You're new. Welcome. |
| Regular | 500 | You've been around. Places are starting to know you. |
| Member | 1,500 | You belong. Recognition kicks in. |
| VIP | 5,000 | You're part of the fabric. |

Each hub also tracks your XP independently — your relationship with *that* specific place:

```
user_venue_xp
├── venue_id
├── xp        → experience points here
├── visits    → how many times
└── tier      → your tier at this hub
```

The Explore section shows your venue XP as a ⚡ badge on each hub card. You're building a relationship graph — your history with every place you care about, visible at a glance.

**Perks** are how hubs say thank you:

```
venue_perks
├── name: "Free Lineup"
├── point_cost: 500
├── category: "drink" | "food" | "access" | "experience" | "merch"
```

Perks appear in Explore as circular badges — ☕ for drinks, 🔑 for access, ✨ for experiences, 🎁 for merch. Affordable ones glow. Unaffordable ones dim. Tap to redeem.

Points balance is visible on every hub page as a pill in the header. Tap it for a drawer showing your full balance card — tier, streak, score, total earned — and a scrollable transaction history.

### 3.2 The Hub Owner's Story

This protocol isn't just about guests. It's about the person who's been running a barbershop for fifteen years and knows two hundred people by their cut but has no way to tell them Tuesday's schedule changed.

The dashboard (`dash.thekickback.net`) gives hub owners:

- **Guest table**: who's in, how long, pending requests
- **Request feed**: real-time requests from guests
- **Bookings panel**: upcoming reservations, check-ins
- **Text log**: full conversation history across SMS and email
- **Points panel**: manage perks, view redemptions
- **AI agent editor**: teach the hub's AI what to say and know
- **Staff portal**: invite staff by email, staff manage their own hours and profiles
- **Storefront editor**: hero image, tagline, description, hours, offerings, gallery
- **Stripe Connect**: direct payments, sandbox mode for testing

Onboarding is conversational. Not a form. The AI guides you through setup one question at a time, saving as you go. "What's your spot called?" "Where is it?" "What do you offer?" Done.

---

## 4. Reimagining Community

### 4.1 The Vibe Layer

Every hub has a vibe. Not a review. Not a rating. A *vibe* — a single word that captures the energy of the place right now, in this moment.

```
Quiet    → green    — Focus energy. Solo. Calm.
Moderate → yellow   — Some life. Conversation. Warm.
Busy     → orange   — Full room. Buzz. Social.
Packed   → red      — Peak. Electric. Standing room.
```

These colors pulse through the entire UI. Map pins glow with them. Hub cards badge them. The chat dock animates a breathing dot in the vibe color.

When you ask "what's the vibe?", the AI doesn't return a label. It reads the room:

```
"Quiet right now. Mostly regulars this morning — a few people waiting 
for cuts. Gets packed around 3 when school lets out."
```

This is what transforms a pin on Google Maps into a living thing. "Should I go?" isn't answered by a photo from 2019. It's answered by the people who are there right now.

### 4.2 Your Profile: Where You Belong

Profile mode in TheDock shows you yourself through the lens of the places you love:

- **Tier badge** with progress bar to next level
- **KickBack Score** — your engagement across the network
- **Streak** — consecutive weeks showing up
- **Hubs visited** — your range
- **Per-hub XP** — your depth at each place, with milestones
- **Redeemable perks** — what you've earned
- **Preferences** — dietary, atmosphere, interests (power your personalized experience)
- **Devices** — manage registered devices (max 3)
- **Passkeys** — biometric credentials
- **Thread history** — your conversations across hubs

Nobody else sees your tier or score. This isn't a social profile. It's a *mirror* — a way to see your relationship with the physical world around you.

### 4.3 The Daily Digest

Every morning, a cron worker writes you a personal email.

It reads your preferences, your visit patterns, the current state of every hub. Then it writes:

```
"Hey Marcus. Metro Barbershop is quiet this morning if you want to 
slide through before it gets busy. Thursday Night League moved to 
Court 3 this week — heads up. What's your vibe today?"
```

Not an algorithm maximizing engagement. A friend giving you the rundown. That's the prompt:

```typescript
"Open casually — like a friend giving you the rundown",
"Highlight 2-3 venues that match their vibe/preferences",
"Keep it under 100 words. No emojis. Direct, warm, not salesy.",
```

---

## 5. The Protocol Layer

### 5.1 Channel Agnosticism

Ask a hub a question via text, email, or web chat — you get the same conceptual answer from the same AI with the same knowledge base. The web has the richest expression (offering cards, carts, drawers), but the loop is identical everywhere.

### 5.2 Progressive Identity

Email → device fingerprint → passkey. Your identity accretes. You never "sign up." The system just starts recognizing you, like a bartender who remembers your order.

### 5.3 Hub Sovereignty

Each hub controls:
- **Knowledge base** — what the AI knows and how it speaks
- **Storefront** — theme, hero, tagline, gallery, hours
- **Offerings** — products, services, memberships, events, packages — priced and typed
- **Staff** — visible profiles, linked services, self-managed schedules
- **Perks** — how they reward regulars
- **House rules** — the social contract, rendered in the UI

The protocol provides the canvas. Each hub paints its own picture. The barbershop's AI sounds different from the basketball league's AI sounds different from the nail salon's AI — because each one is trained on that hub's specific knowledge, voice, and personality.

---

## 6. The Truth Table

| Feature | Status |
|---------|--------|
| Full-screen Mapbox GL map with 3D pitch | ✅ Live |
| GPS geolocation + fly-to | ✅ Live |
| Foursquare discovery (unclaimed nearby hubs) | ✅ Live |
| AI-curated filter tags (category, vibe, neighborhood, offering) | ✅ Live |
| TheDock: multi-mode bottom sheet (idle/explore/concierge/chat/profile) | ✅ Live |
| Hub storefronts with hero, tagline, hours, gallery, staff, offerings | ✅ Live |
| AI chat with 8 tabbed contexts | ✅ Live |
| Tappable offering cards with images and cart | ✅ Live |
| Product detail drawers | ✅ Live |
| AI Wallet (Stripe-backed prepaid balance, AI spends for you) | ✅ Live |
| Stripe card management (add/switch/remove) | ✅ Live |
| Points economy with tiers (Explorer → Regular → Member → VIP) | ✅ Live |
| Per-hub XP tracking with milestones | ✅ Live |
| Redeemable perks | ✅ Live |
| Points balance drawer with transaction history | ✅ Live |
| Persistent chat threads | ✅ Live |
| Email OTP login with multi-device enforcement | ✅ Live |
| Device manager | ✅ Live |
| Passkey registration and login (WebAuthn) | ✅ Live |
| User preferences (dietary, atmosphere, interests) | ✅ Live |
| SMS channel (JOIN, ASK, REQUEST, MENU, STATUS, LEAVE) | ✅ Live |
| Email channel (inbound + rich HTML outbound) | ✅ Live |
| AI-written daily/weekly digest | ✅ Live |
| Apple + Google Wallet pass generation | ✅ Live |
| Hub owner dashboard (guests, requests, bookings, staff, Stripe) | ✅ Live |
| Staff portal (email invite, self-managed hours) | ✅ Live |
| Storefront editor | ✅ Live |
| Map navigation (walking/driving directions) | ✅ Live |
| Keyboard shortcuts | ✅ Live |
| PWA (service worker, home screen install) | ✅ Live |
| Sandbox mode | ✅ Live |
| Hub onboarding (AI conversational setup) | 🔧 Building |
| WhatsApp Business channel | 📋 Designed |
| Anonymous community feed | 📋 Designed |

---

## 7. The Invitation

The barber doesn't need a social media strategy. The league organizer doesn't need a website. The nail tech doesn't need an app developer. The musician doesn't need a Linktree.

They need infrastructure that understands what they already are: a place where people come to be seen, to be known, to be held for a little while.

That's what theKickBack builds. Not a platform that extracts from the relationship between a person and their spot. *Infrastructure that strengthens it.*

A map that shows you every gathering point near you, pulsing with life. An AI that speaks in the voice of the place you love. A wallet that removes the friction between "I want that" and having it. A points system that says: *we see you coming back, and it matters.*

Every barbershop. Every court. Every studio. Every kitchen. Every salon. Every corner that has ever made someone feel like they belong.

That's a hub. And every hub deserves infrastructure.

---

> The best infrastructure disappears. It doesn't ask you to learn it. It doesn't interrupt what's already happening. It just makes the thing you were already doing — showing up, coming back, being known — a little more possible for a few more people.
>
> That's theKickBack.
>
> Now come find your spot.

---

*theKickBack Protocol · v0.3 · March 2026*
*Built on: Next.js, Mapbox GL, Cloudflare Workers, Supabase, Twilio, Resend, OpenClaw, Stripe, Framer Motion*
*By: Carl, from Craft the Future*
