import { LandingExperience } from "@/components/landing-experience";
import Image from "next/image";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-dvh bg-black overflow-x-hidden">
      {/* ═══ HERO: Cinematic Remotion experience ═══ */}
      <section className="relative h-dvh">
        <LandingExperience />
        {/* Scroll hint */}
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center sm:hidden">
          <div className="animate-bounce font-sans text-[10px] tracking-widest text-white/20">
            SCROLL
          </div>
        </div>
      </section>

      {/* ═══ VENUE OWNERS: The pitch ═══ */}
      <section className="relative px-5 pt-24 pb-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-4xl">
          <span className="font-sans text-[10px] font-semibold tracking-[2.5px] text-orange uppercase sm:text-xs">
            FOR VENUE OWNERS
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
            Your venue deserves<br />
            <span className="text-white/30">a smarter front door.</span>
          </h2>
          <p className="mt-6 max-w-2xl font-sans text-base leading-[1.7] text-white/40 sm:text-lg">
            KickBack gives every venue its own AI — one that knows your menu, your hours, your vibe.
            Guests interact through chat, email, or text. You get a dashboard that shows you everything.
            No app downloads. No hardware. Just turn it on.
          </p>

          {/* Feature grid */}
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "AI That Knows Your Venue",
                desc: "Train it with your menu, hours, FAQs, and policies. It responds to guests in your voice — across web chat, email, and SMS.",
                icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
              },
              {
                title: "Real-Time Vibe Dashboard",
                desc: "See who's in, what they're asking, and how your venue feels right now. Occupancy, requests, and member activity — all live.",
                icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
              },
              {
                title: "Memberships Built In",
                desc: "Let guests become members at your venue. Set your own price, perks, and tiers. We handle the billing — you keep the relationship.",
                icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
              },
              {
                title: "Wallet Passes",
                desc: "Guests get an Apple or Google Wallet pass with live updates. Your venue on their lock screen — no app install needed.",
                icon: "M20 14H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM2 10l2-8h16l2 8",
              },
              {
                title: "Multi-Channel Guest Access",
                desc: "Guests reach your venue through web chat, email (venue@thekickback.net), SMS, or QR code. No friction. No sign-ups.",
                icon: "M22 12h-4l-3 9L9 3l-3 9H2",
              },
              {
                title: "The KickBack Network",
                desc: "Your venue shows up on the KickBack map. Guests discover you by vibe, location, and availability. More visibility, zero ad spend.",
                icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-sans text-[15px] font-bold text-white/90">{feature.title}</h3>
                <p className="mt-2 font-sans text-[13px] leading-[1.6] text-white/35">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DASHBOARD PREVIEW ═══ */}
      <section className="relative px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-4xl">
          <span className="font-sans text-[10px] font-semibold tracking-[2.5px] text-white/25 uppercase sm:text-xs">
            THE DASHBOARD
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
            Everything about your venue.<br />
            <span className="text-white/30">One screen.</span>
          </h2>
          <p className="mt-6 max-w-2xl font-sans text-base leading-[1.7] text-white/40">
            The venue dashboard at dash.thekickback.net gives you full control. Train your AI, manage guests,
            track requests, customize your venue page, and watch the vibe in real time.
          </p>

          {/* Dashboard mockup */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D0D0F]">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <span className="ml-2 font-sans text-[11px] text-white/20">dash.thekickback.net</span>
            </div>
            {/* Content */}
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">LIVE GUESTS</p>
                <p className="mt-1 font-sans text-2xl font-bold text-white">28</p>
                <p className="mt-1 font-sans text-[11px] text-green-400">+12% from last week</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">VIBE</p>
                <p className="mt-1 font-sans text-2xl font-bold text-orange">Busy</p>
                <p className="mt-1 font-sans text-[11px] text-white/30">72% capacity</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">MEMBERS</p>
                <p className="mt-1 font-sans text-2xl font-bold text-white">143</p>
                <p className="mt-1 font-sans text-[11px] text-white/30">$25/mo avg</p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">RECENT ACTIVITY</p>
                <div className="mt-3 flex flex-col gap-2">
                  {[
                    { action: "Guest asked about happy hour specials", time: "2m ago", color: "#a78bfa" },
                    { action: "New member joined — Sarah K.", time: "8m ago", color: "#4ade80" },
                    { action: "Booth 4 reserved via SMS", time: "12m ago", color: "#F97316" },
                    { action: "Menu knowledge updated by owner", time: "1h ago", color: "#facc15" },
                  ].map((item) => (
                    <div key={item.action} className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 font-sans text-[12px] text-white/50">{item.action}</span>
                      <span className="shrink-0 font-sans text-[10px] text-white/20">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="relative px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <span className="font-sans text-[10px] font-semibold tracking-[2.5px] text-white/25 uppercase sm:text-xs">
            PRICING
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
            Simple. Fair. Scales with you.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-[1.7] text-white/40">
            Guests always free. Venue owners start free and upgrade when ready.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {/* Free */}
            <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-left">
              <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">FREE</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-white">$0</span>
                <span className="font-sans text-sm text-white/30">/month</span>
              </div>
              <p className="mt-3 font-sans text-[13px] leading-[1.6] text-white/35">
                Get your venue online today. No credit card.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {["1 venue", "AI agent (basic knowledge)", "Web chat channel", "100 guest interactions/mo", "Venue page on the network"].map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="font-sans text-[13px] text-white/50">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-6">
                <a
                  href="https://dash.thekickback.net"
                  className="flex items-center justify-center rounded-xl border border-white/[0.08] py-3 font-sans text-[13px] font-bold text-white/60 transition hover:bg-white/[0.04]"
                >
                  Get Started
                </a>
              </div>
            </div>

            {/* Pro */}
            <div className="flex flex-col rounded-2xl border-2 border-orange/40 bg-orange/[0.04] p-6 text-left">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-orange">PRO</span>
                <span className="rounded-full bg-orange/15 px-2 py-0.5 font-sans text-[9px] font-bold text-orange">POPULAR</span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-white">$49</span>
                <span className="font-sans text-sm text-white/30">/mo per venue</span>
              </div>
              <p className="mt-3 font-sans text-[13px] leading-[1.6] text-white/35">
                Everything you need to run a smarter venue.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {[
                  "Unlimited guest interactions",
                  "All channels (web, email, SMS)",
                  "Full knowledge base",
                  "Wallet passes (Apple + Google)",
                  "Member management",
                  "Vibe dashboard + analytics",
                  "10% fee on memberships",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="font-sans text-[13px] text-white/50">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-6">
                <a
                  href="https://dash.thekickback.net"
                  className="flex items-center justify-center rounded-xl bg-orange py-3 font-sans text-[13px] font-bold text-black transition hover:opacity-90"
                >
                  Start Free Trial
                </a>
              </div>
            </div>

            {/* Network */}
            <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-left">
              <span className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">NETWORK</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-white">$99</span>
                <span className="font-sans text-sm text-white/30">/mo per venue</span>
              </div>
              <p className="mt-3 font-sans text-[13px] leading-[1.6] text-white/35">
                Maximum visibility. Cross-venue intelligence.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {[
                  "Everything in Pro",
                  "Priority on KickBack map",
                  "Cross-venue member recognition",
                  "Guest insights + trends",
                  "Multi-venue dashboard",
                  "Dedicated support",
                  "7% fee on memberships",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="font-sans text-[13px] text-white/50">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-6">
                <a
                  href="https://dash.thekickback.net"
                  className="flex items-center justify-center rounded-xl border border-white/[0.08] py-3 font-sans text-[13px] font-bold text-white/60 transition hover:bg-white/[0.04]"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GUESTS: Waitlist ═══ */}
      <section className="relative px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-sans text-[10px] font-semibold tracking-[2.5px] text-white/25 uppercase sm:text-xs">
            FOR EVERYONE
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
            The kickback is coming<br />
            <span className="text-white/30">to your city.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg font-sans text-base leading-[1.7] text-white/40">
            KickBack is free for guests — always. Join the waitlist and be the first to know
            when venues near you go live. No spam. Just an invite when it's time.
          </p>
          <form
            action="https://formspree.io/f/placeholder"
            method="POST"
            className="mx-auto mt-8 flex max-w-md gap-3"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:border-orange/40 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-orange px-6 py-3 font-sans text-[13px] font-bold text-black transition hover:opacity-90"
            >
              Join Waitlist
            </button>
          </form>
        </div>
      </section>

      {/* ═══ DUAL CTA ═══ */}
      <section className="relative px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {/* Venue owners */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-orange/20 bg-orange/[0.04] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange/15">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
            <h3 className="font-sans text-lg font-bold text-white">Own a venue?</h3>
            <p className="font-sans text-[13px] leading-[1.6] text-white/40">
              Get started today. Free tier, no credit card, live in minutes.
            </p>
            <a
              href="https://dash.thekickback.net"
              className="mt-2 rounded-xl bg-orange px-6 py-3 font-sans text-[13px] font-bold text-black transition hover:opacity-90"
            >
              Set Up Your Venue
            </a>
          </div>

          {/* Guests */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="font-sans text-lg font-bold text-white">Just here to hang?</h3>
            <p className="font-sans text-[13px] leading-[1.6] text-white/40">
              KickBack is always free for guests. Join the waitlist for early access.
            </p>
            <a
              href="#waitlist"
              className="mt-2 rounded-xl border border-white/[0.08] px-6 py-3 font-sans text-[13px] font-bold text-white/60 transition hover:bg-white/[0.04]"
            >
              Join the Waitlist
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.06] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="theKickBack"
              width={100}
              height={30}
              className="h-5 w-auto invert"
            />
            <span className="font-sans text-[11px] text-white/20">The digital front door for real-world venues.</span>
          </div>
          <div className="flex gap-6">
            <a href="https://dash.thekickback.net" className="font-sans text-[12px] text-white/30 transition hover:text-white/50">Dashboard</a>
            <a href="https://join.thekickback.net" className="font-sans text-[12px] text-white/30 transition hover:text-white/50">Join</a>
            <a href="mailto:hello@thekickback.net" className="font-sans text-[12px] text-white/30 transition hover:text-white/50">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
