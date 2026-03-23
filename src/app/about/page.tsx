import Image from "next/image";
import Link from "next/link";

export const metadata = {
    title: "About — theKickBack",
    description: "Helping people find and support their favorite spots.",
};

const ACCENT = "#a78bfa";
const ORANGE = "#f97316";

export default function AboutPage() {
    return (
        <div style={{ background: "#0a0a0a", color: "rgba(255,255,255,0.85)", minHeight: "100vh" }}>
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-5 mx-auto" style={{ maxWidth: 900 }}>
                <Link href="/">
                    <Image src="/logo.png" alt="theKickBack" width={140} height={46} style={{ height: "auto" }} priority />
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/privacy" className="text-[12px] text-white/40 hover:text-white/70 transition">Privacy</Link>
                    <a href="https://join.thekickback.net" className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white/60" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>Explore</a>
                    <a href="https://dash.thekickback.net" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Dashboard</a>
                </div>
            </nav>

            {/* Content */}
            <main className="px-6 pb-20 mx-auto" style={{ maxWidth: 720 }}>
                <h1 className="font-sans text-[40px] font-bold leading-tight mt-12 mb-2" style={{ color: "#fff" }}>
                    What is theKickBack?
                </h1>
                <p className="text-[15px] text-white/40 mb-10">
                    A better way to find cool spots · March 2026
                </p>

                {/* Section: Why This Exists */}
                <section className="mb-14">
                    <h2 className="font-sans text-[22px] font-semibold mb-4" style={{ color: ACCENT }}>Why We Built This</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-4">
                        You had a spot. Maybe it was a barbershop where the conversation was better than the cut. Maybe it was a basketball court where you didn&apos;t need to know anyone&apos;s last name to run fives. Maybe it was a nail salon where you finally exhaled.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-4">
                        You had a spot, and it knew you. Not because it tracked your data. Not because it had an app. Because the person behind the chair or behind the counter saw you come back, and one day said &ldquo;the usual?&rdquo; — and that was the moment you belonged somewhere.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        The internet has tools for everything — except the real places where people actually hang out. theKickBack says: <strong style={{ color: "#fff" }}>what if every spot could have its own page, its own AI, and a way for people to find it?</strong>
                    </p>
                </section>

                {/* Section: What It Is */}
                <section className="mb-14">
                    <h2 className="font-sans text-[22px] font-semibold mb-4" style={{ color: ACCENT }}>What It Is</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-4">
                        theKickBack gives every place its own AI helper, a page that shows what they offer, and a way for people to find them. Barbershops, nail salons, leagues, communities, artists, musicians, cafes, coworking spaces — if people go there, it belongs on the map.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        No app to download. It works on your phone&apos;s browser, by text, and by email. Open the map. Tap a pin. You&apos;re in.
                    </p>
                </section>

                {/* Section: How It Works */}
                <section className="mb-14">
                    <h2 className="font-sans text-[22px] font-semibold mb-4" style={{ color: ACCENT }}>How It Works</h2>

                    <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <h3 className="font-sans text-[14px] font-semibold mb-2" style={{ color: ORANGE }}>For Visitors</h3>
                        <ul className="space-y-2 text-[14px] text-white/60">
                            <li>Open the map — see every spot near you, with colors showing how busy they are</li>
                            <li>Tap a pin — you can ask the place&apos;s AI about what&apos;s going on, what they sell, or when they&apos;re open</li>
                            <li>See things you can buy right in the chat and check out</li>
                            <li>Every visit earns you points. The more you go, the higher your level: Explorer → Regular → Member → VIP</li>
                            <li>Load money into your wallet. The AI helps you buy stuff while you chat.</li>
                            <li>Works on your phone, by text, and by email. Sign in with your email — no password needed.</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <h3 className="font-sans text-[14px] font-semibold mb-2" style={{ color: ORANGE }}>For Place Operators</h3>
                        <ul className="space-y-2 text-[14px] text-white/60">
                            <li>Set up in 5 minutes by chatting with our AI</li>
                            <li>You get: an AI helper, a dashboard, a page for your stuff, staff tools, and a photo gallery</li>
                            <li>List events — visitors find them and RSVP through the map</li>
                            <li>Stripe Connect for direct payments — you keep 100% of every sale</li>
                            <li>Staff portal: invite by email, staff manage their own hours</li>
                            <li>We only charge 2% when someone loads their wallet. Card fees from Stripe are separate.</li>
                        </ul>
                    </div>
                </section>

                {/* Section: What Counts as a Place */}
                <section className="mb-14">
                    <h2 className="font-sans text-[22px] font-semibold mb-4" style={{ color: ACCENT }}>What Counts as a Place</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-4">
                        A barbershop is a place. A running club is a place. A musician&apos;s studio is a place. If people go there, it&apos;s a place.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {["Barbershops", "Nail Salons", "Cafes", "Bars", "Lounges", "Rooftops", "Coworking", "Leagues", "Communities", "Artists", "Musicians", "Creators", "Groups", "Orgs", "Restaurants", "Clubs"].map((cat) => (
                            <span key={cat} className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ backgroundColor: "rgba(167,139,250,0.12)", color: ACCENT, border: "1px solid rgba(167,139,250,0.15)" }}>{cat}</span>
                        ))}
                    </div>
                </section>

                {/* Section: The Invitation */}
                <section className="mb-14">
                    <h2 className="font-sans text-[22px] font-semibold mb-4" style={{ color: ACCENT }}>The Invitation</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-4">
                        The barber doesn&apos;t need a marketing plan. The nail tech doesn&apos;t need to build a website. The league organizer doesn&apos;t need an app developer.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        They just need a way for people to find them and come back. That&apos;s what we build.
                    </p>
                </section>

                {/* Section: Built By */}
                <section className="mb-14 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[13px] text-white/30">
                        Built by Carl, from <a href="https://craftthefuture.xyz" className="underline hover:text-white/50 transition" target="_blank" rel="noopener">Craft the Future</a>
                    </p>
                    <p className="text-[13px] text-white/20 mt-1">
                        Next.js · Mapbox GL · Supabase · Cloudflare Workers · Twilio · Resend · OpenClaw · Stripe · Framer Motion
                    </p>
                </section>

                {/* CTA */}
                <div className="flex gap-3 mt-8">
                    <a href="https://join.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: ORANGE, color: "#fff" }}>Find Your Spot</a>
                    <a href="https://dash.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-medium transition hover:opacity-90" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Set Up Your Place</a>
                </div>
            </main>
        </div>
    );
}
