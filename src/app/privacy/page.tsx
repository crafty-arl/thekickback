import { KBWordmark } from "@/components/kb-logo";
import Link from "next/link";

export const metadata = {
    title: "Privacy Policy — theKickBack",
    description: "How theKickBack handles your data. No ads. No selling. Your data powers your experience.",
};

const ACCENT = "#a78bfa";
const ORANGE = "#f97316";

export default function PrivacyPage() {
    return (
        <div style={{ background: "#0a0a0a", color: "rgba(255,255,255,0.85)", minHeight: "100vh" }}>
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-5 mx-auto" style={{ maxWidth: 900 }}>
                <Link href="/">
                    <KBWordmark height={28} />
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/about" className="text-[12px] text-white/40 hover:text-white/70 transition">About</Link>
                    <a href="https://join.thekickback.net" className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white/60" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>Explore</a>
                    <a href="https://dash.thekickback.net" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Dashboard</a>
                </div>
            </nav>

            {/* Content */}
            <main className="px-6 pb-20 mx-auto" style={{ maxWidth: 720 }}>
                <h1 className="font-sans text-[40px] font-bold leading-tight mt-12 mb-2" style={{ color: "#fff" }}>
                    Privacy Policy
                </h1>
                <p className="text-[15px] text-white/40 mb-10">
                    Last updated: March 2026
                </p>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>The Short Version</h2>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        Your data powers your experience — not ads, not third-party sales, not engagement algorithms. The data we collect about your preferences, visit patterns, and vibe affinities stays in the relationship graph that makes theKickBack work for you. It never powers an ad.
                    </p>
                </section>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>What We Collect</h2>
                    <ul className="space-y-3 text-[14px] text-white/60">
                        <li><strong className="text-white/80">Email address</strong> — Used for passwordless login (one-time codes). We don&apos;t send marketing emails unless you opt in to the daily digest.</li>
                        <li><strong className="text-white/80">Device information</strong> — Fingerprint for multi-device enforcement (max 3 devices). We use this to keep your account secure, not to track you across the web.</li>
                        <li><strong className="text-white/80">Location</strong> — GPS is used to center the map on your city and show nearby places. We do not store your precise location history.</li>
                        <li><strong className="text-white/80">Chat messages</strong> — Your chats with a place&apos;s AI are saved so the conversation keeps going. Place operators can see messages sent to their place.</li>
                        <li><strong className="text-white/80">Visit and engagement data</strong> — Check-ins, points, tiers, and streaks are tracked per-place so each spot remembers you.</li>
                        <li><strong className="text-white/80">Preferences</strong> — Dietary, atmosphere, and interest preferences are stored to personalize your experience (e.g. the daily digest).</li>
                        <li><strong className="text-white/80">Payment info</strong> — Handled entirely by Stripe. We never see or store your card number.</li>
                    </ul>
                </section>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>What We Don&apos;t Do</h2>
                    <ul className="space-y-2 text-[14px] text-white/60">
                        <li>We don&apos;t sell your data to anyone</li>
                        <li>We don&apos;t run ads or use your data for advertising</li>
                        <li>We don&apos;t share your personal information with third parties for marketing</li>
                        <li>We don&apos;t track you across the internet</li>
                        <li>We don&apos;t store your precise location history</li>
                        <li>We don&apos;t require passwords — OTP and passkeys only</li>
                    </ul>
                </section>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>How Payments Work</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-3">
                        When a visitor pays a place, the money goes straight to that place&apos;s own Stripe Connect account. theKickBack does not stand between the barber and the person in the chair.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        A 2% platform fee is collected at wallet-load time — the place always gets 100% of what you pay. Stripe card fees (2.9% + 30¢) are separate and go directly to Stripe.
                    </p>
                </section>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>Third-Party Services</h2>
                    <ul className="space-y-3 text-[14px] text-white/60">
                        <li><strong className="text-white/80">Supabase</strong> — Database and authentication (hosted in the US)</li>
                        <li><strong className="text-white/80">Stripe</strong> — Payment processing. Subject to <a href="https://stripe.com/privacy" className="underline hover:text-white/80 transition" target="_blank" rel="noopener">Stripe&apos;s Privacy Policy</a></li>
                        <li><strong className="text-white/80">Mapbox</strong> — Map rendering. Subject to <a href="https://www.mapbox.com/legal/privacy" className="underline hover:text-white/80 transition" target="_blank" rel="noopener">Mapbox&apos;s Privacy Policy</a></li>
                        <li><strong className="text-white/80">Twilio</strong> — SMS messaging</li>
                        <li><strong className="text-white/80">Resend</strong> — Email delivery</li>
                        <li><strong className="text-white/80">Cloudflare</strong> — Edge workers and CDN</li>
                    </ul>
                </section>

                <section className="mb-10">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>Your Rights</h2>
                    <p className="text-[15px] leading-relaxed text-white/70 mb-3">
                        You can request deletion of your account and all associated data at any time by emailing <a href="mailto:carl@craftthefuture.xyz" className="underline hover:text-white/80 transition">carl@craftthefuture.xyz</a>.
                    </p>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        You can manage your devices, passkeys, and preferences from your profile in the app. You can leave any place at any time, which removes your relationship data with that place.
                    </p>
                </section>

                <section className="mb-14">
                    <h2 className="font-sans text-[18px] font-semibold mb-3" style={{ color: ACCENT }}>Contact</h2>
                    <p className="text-[15px] leading-relaxed text-white/70">
                        Questions about privacy? Email <a href="mailto:carl@craftthefuture.xyz" className="underline hover:text-white/80 transition">carl@craftthefuture.xyz</a>.
                    </p>
                </section>

                <div className="pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[13px] text-white/30">
                        theKickBack · Built by <a href="https://craftthefuture.xyz" className="underline hover:text-white/50 transition" target="_blank" rel="noopener">Craft the Future</a>
                    </p>
                </div>
            </main>
        </div>
    );
}
