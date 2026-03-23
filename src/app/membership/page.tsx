import Link from "next/link";

export const metadata = {
    title: "Place Operator Plans — theKickBack",
    description: "Simple pricing for place operators. Free to start, grow when you're ready.",
};

const CHECK = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 4.5L6.5 11.5L2.5 7.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PLANS = [
    {
        name: "Starter",
        price: "Free",
        period: "forever",
        desc: "Everything you need to get your place on the map.",
        features: [
            "Your place on the map",
            "An AI-powered page that shows what you offer",
            "Up to 10 things you can sell or list",
            "1 staff profile",
            "Guest check-ins and points",
            "An AI that answers questions for your visitors",
            "Basic vibe indicator",
            "Email and web channels",
        ],
        cta: "Get Started — Free",
        ctaHref: "https://dash.thekickback.net",
        highlight: false,
    },
    {
        name: "Growth",
        price: "$19",
        period: "/month",
        desc: "For places ready to grow. More staff, more tools, more ways to reach people.",
        features: [
            "Everything in Starter",
            "Unlimited offerings",
            "Up to 10 staff profiles",
            "SMS channel for guest outreach",
            "Custom theme colors and branding",
            "Photo gallery on your page",
            "Show up first on the map",
            "AI-generated daily digest emails",
            "Menu management with categories",
        ],
        cta: "Start 14-Day Free Trial",
        ctaHref: "https://dash.thekickback.net",
        highlight: true,
    },
    {
        name: "Pro",
        price: "$49",
        period: "/month",
        desc: "Everything we offer. For places that want it all.",
        features: [
            "Everything in Growth",
            "Unlimited staff profiles",
            "Apple Wallet passes for guests",
            "Advanced analytics and insights",
            "Teach the AI to sound like you",
            "Multi-location support",
            "Dedicated onboarding support",
            "Early access to new features",
            "API access for integrations",
        ],
        cta: "Start 14-Day Free Trial",
        ctaHref: "https://dash.thekickback.net",
        highlight: false,
    },
];

export default function MembershipPage() {
    return (
        <div style={{ background: "#0a0a0a", color: "#fff", minHeight: "100vh" }}>
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 sm:px-10 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <Link href="/" className="text-[14px] font-bold" style={{ color: "#f97316" }}>← theKickBack</Link>
                <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 text-[12px] font-semibold" style={{ backgroundColor: "#f97316", color: "#fff" }}>
                    Get Started
                </a>
            </nav>

            {/* Header */}
            <section className="px-6 sm:px-10 pt-16 pb-12 text-center max-w-3xl mx-auto">
                <h1 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight">
                    Simple pricing.<br />
                    <span style={{ color: "#f97316" }}>Built for real spots.</span>
                </h1>
                <p className="mt-4 text-[15px] sm:text-[17px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Every place starts free. No credit card needed. Upgrade when you're ready.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1">
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>✓ 2% fee only on AI Wallet transactions</span>
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>✓ You get 100% of every sale</span>
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>✓ Cancel anytime</span>
                </div>
            </section>

            {/* Plans */}
            <section className="px-4 sm:px-10 pb-20 max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                    {PLANS.map((plan) => (
                        <div key={plan.name} className="rounded-2xl p-6 sm:p-7 flex flex-col"
                            style={{
                                background: plan.highlight ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.02)",
                                border: plan.highlight ? "1px solid rgba(249,115,22,0.2)" : "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            {plan.highlight && (
                                <span className="self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold mb-3"
                                    style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#f97316" }}
                                >Most Popular</span>
                            )}
                            <h2 className="text-[20px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{plan.name}</h2>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-[36px] font-bold tracking-tight" style={{ color: "rgba(255,255,255,0.95)" }}>{plan.price}</span>
                                <span className="text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>{plan.period}</span>
                            </div>
                            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{plan.desc}</p>

                            <a href={plan.ctaHref}
                                className="mt-6 block text-center rounded-full py-2.5 text-[13px] font-semibold transition hover:opacity-90"
                                style={plan.highlight
                                    ? { backgroundColor: "#f97316", color: "#fff" }
                                    : { color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }
                                }
                            >{plan.cta}</a>

                            <ul className="mt-6 space-y-2.5 flex-1">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2">
                                        <span className="shrink-0 mt-0.5">{CHECK}</span>
                                        <span className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>{f}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* Transaction fee callout */}
            <section className="px-6 sm:px-10 pb-20 max-w-3xl mx-auto text-center">
                <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <h3 className="text-[18px] font-bold mb-3" style={{ color: "rgba(255,255,255,0.9)" }}>How payments work</h3>
                    <p className="text-[14px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                        When a visitor loads their wallet, a <strong style={{ color: "rgba(255,255,255,0.85)" }}>2% platform fee</strong> is collected at that point — not from you.
                        You get <strong style={{ color: "rgba(255,255,255,0.85)" }}>100% of every sale</strong>. Stripe card fees (2.9% + 30¢) apply to the visitor&apos;s card charge, which is standard for any card payment.
                    </p>
                    <div className="rounded-xl p-4 text-left font-mono text-[12px]" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)" }}>
                        <div>Guest loads wallet:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$25.00</div>
                        <div>Stripe fee (2.9% + 30¢):&nbsp;&nbsp;&nbsp;$1.03</div>
                        <div>Platform fee (2%):&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$0.50</div>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 8, color: "rgba(255,255,255,0.85)" }}>
                            Guest pays total:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$26.53
                        </div>
                        <div style={{ color: "#f97316", marginTop: 4 }}>
                            You get per sale:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;100%
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="px-6 sm:px-10 pb-20 max-w-3xl mx-auto">
                <h3 className="text-[18px] font-bold mb-6 text-center" style={{ color: "rgba(255,255,255,0.9)" }}>Common Questions</h3>
                <div className="space-y-4">
                    {[
                        { q: "Do I need a credit card to start?", a: "No. The Starter plan is completely free with no credit card required. Set up your place in five minutes by chatting with our AI." },
                        { q: "What's the 2% platform fee?", a: "It's collected from the visitor when they load their wallet — not from you. You always get 100% of every sale. We never take a cut of your money." },
                        { q: "Can I switch plans anytime?", a: "Yes. Upgrade, downgrade, or cancel at any time. If you cancel a paid plan, you keep access through the end of your billing period." },
                        { q: "What happens to my data if I cancel?", a: "Your place stays on the map and your info stays yours. You just lose access to premium features. We don't delete anything." },
                        { q: "Do my visitors need to pay anything?", a: "Visitors explore for free. They only pay when they add money to their wallet to buy things at places." },
                    ].map((item) => (
                        <div key={item.q} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="text-[14px] font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>{item.q}</p>
                            <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{item.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="flex justify-center gap-4 px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Link href="/" className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Home</Link>
                <Link href="/about" className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>About</Link>
                <Link href="/privacy" className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</Link>
            </footer>
        </div>
    );
}
