# theKickBack

Text-first venue protocol. No app. No download. No account. Just text a number and you're in.

theKickBack turns every venue into a live system you interact with through SMS. Check vibes, request a booth, ask the bartender — all from one text thread.

## Architecture

```
User texts "JOIN" to venue number
        │
        ▼
   Twilio (carrier layer)
        │
        ▼
   Cloudflare Worker ── sms-worker/
   (command routing, Twilio signature validation)
        │
        ▼
   TwiML response → reply SMS to user

Landing page ── src/          (Next.js on Docker)
OpenClaw       ── deploy/     (API gateway on Docker)
Caddy          ── deploy/     (reverse proxy, auto-TLS)
```

## Project Structure

```
kickback-app/
├── src/                        # Next.js landing page
│   ├── app/
│   │   ├── page.tsx            # Home page
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Tailwind theme
│   │   └── health/route.ts     # Health check endpoint
│   └── components/
│       ├── header.tsx           # Logo + responsive nav
│       ├── hero.tsx             # Hero section with SMS demo
│       ├── how-it-works.tsx     # 4-step walkthrough
│       ├── features.tsx         # Protocol features
│       ├── venues.tsx           # Venue thread list
│       └── membership.tsx       # Membership CTA
├── public/
│   └── logo.png                # theKickBack logo (v2)
├── sms-worker/                 # Cloudflare Worker — SMS backend
│   ├── src/index.ts            # Twilio webhook handler + command routing
│   ├── wrangler.toml           # Worker config
│   ├── tsconfig.json
│   └── package.json
├── deploy/                     # Docker deployment
│   ├── docker-compose.yml      # Landing page + OpenClaw + Caddy
│   ├── Caddyfile               # Reverse proxy: thekickback.net + claw subdomain
│   ├── deploy.sh               # Blue/green zero-downtime deploy script
│   ├── nginx/nginx.conf        # Nginx config (fallback)
│   └── .env.example            # Environment variables template
├── .github/
│   └── workflows/deploy.yml    # CI/CD: lint → build → deploy to VPS
├── Dockerfile                  # Multi-stage Next.js production image
└── package.json
```

## Local Development

### Landing Page

```bash
npm install
npm run dev
# → http://localhost:3000
```

### SMS Worker

```bash
cd sms-worker
npm install
npm run dev
# → http://localhost:8787
```

Test locally with curl:

```bash
curl -X POST http://localhost:8787/sms \
  -d "From=+15551234567" \
  -d "To=+18777804236" \
  -d "Body=join" \
  -d "MessageSid=test123"
```

## Deployment

### Landing Page (Docker on VPS)

The landing page runs as a Docker container behind Caddy with auto-TLS.

```bash
# On the VPS
cd /opt/thekickback
cp deploy/.env.example deploy/.env
# Edit deploy/.env with your tokens

cd deploy
docker compose up -d
```

**CI/CD**: Pushes to `main` trigger the GitHub Actions workflow which SSHs into the VPS, pulls the latest code, rebuilds the Docker image, and verifies the health check.

**Blue/green deploys**: For zero-downtime deploys, use the deploy script:

```bash
./deploy/deploy.sh
```

### SMS Worker (Cloudflare Workers)

```bash
cd sms-worker

# Set Twilio secrets (never committed to code)
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_MESSAGING_SERVICE_SID

# Deploy
wrangler deploy
```

After deploying, copy the worker URL and set it as the webhook in Twilio:

1. Go to **Twilio Console** → **Messaging** → **Services** → your service
2. Set the **Inbound Request URL** to: `https://kickback-sms.<your-subdomain>.workers.dev/sms`
3. Method: **HTTP POST**

### OpenClaw Gateway

OpenClaw runs as a Docker container alongside the landing page:

```bash
# Included in docker-compose.yml — starts automatically
# Access via: claw.thekickback.net

# For CLI access:
docker compose --profile cli run --rm claw-cli
```

## Services

| Service | URL | Stack |
|---------|-----|-------|
| Landing page | thekickback.net | Next.js, Docker, Caddy |
| OpenClaw gateway | claw.thekickback.net | OpenClaw, Docker |
| SMS backend | *.workers.dev/sms | Cloudflare Workers, Twilio |

## SMS Commands

| Command | Description |
|---------|-------------|
| `JOIN` | Enter a venue |
| `ASK <question>` | Ask the venue anything |
| `REQUEST <item>` | Request a booth, drink, etc. |
| `MENU` | See what's available |
| `HOLD` | Hold a spot |
| `STATUS` | Check your session |
| `LEAVE` | Exit the venue |
| `MEMBERSHIP` | Join as a member |

## Environment Variables

### VPS (deploy/.env)

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | OpenClaw gateway auth token |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for OpenClaw |

### Cloudflare Worker (wrangler secrets)

| Secret | Description |
|--------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio Messaging Service SID (`MG...`) |

### GitHub Actions (repo secrets)

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP/hostname |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key for deploy |
