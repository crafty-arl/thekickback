"use client";

import { useState } from "react";
import Image from "next/image";
import { sendOtp, verifyOtp } from "./actions";

const PERKS = [
  { icon: "📊", title: "Live Dashboard", desc: "Real-time occupancy, vibe tracking, and guest activity" },
  { icon: "🤖", title: "AI Interactions", desc: "Guests email or text — AI handles responses automatically" },
  { icon: "📲", title: "Wallet Passes", desc: "Your venue lives on every guest's lock screen" },
  { icon: "💳", title: "Memberships", desc: "Built-in tiers, payments, and member recognition" },
  { icon: "⚡", title: "Zero Friction", desc: "NFC, QR, or email — no app download needed for guests" },
  { icon: "📈", title: "Analytics", desc: "Peak hours, crowd patterns, and guest behavior insights" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await sendOtp(email);
    if (result.error) { setError(result.error); setLoading(false); return; }
    setStep("verify");
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await verifyOtp(email, otpCode);
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <main className="flex min-h-svh flex-col md:flex-row" style={{ backgroundColor: "#000" }}>
      {/* Left — Marketing (stacks on top for mobile) */}
      <div className="flex w-full flex-col md:w-1/2 lg:w-[55%]" style={{ background: "linear-gradient(180deg, #F97316 0%, #1a0a00 60%, #000 100%)" }}>
        {/* Top nav area */}
        <div className="flex items-center justify-between p-6 lg:p-10">
          <Image src="/logo.png" alt="theKickBack" width={140} height={46} className="h-8 w-auto lg:h-10" />
          <a href="https://thekickback.net" className="hidden font-sans text-[13px] font-medium text-white/40 underline md:block">
            Learn more
          </a>
        </div>

        {/* Hero text */}
        <div className="flex flex-1 flex-col justify-center px-6 pb-8 md:pb-0 lg:px-10">
          <h1 className="mb-4 font-sans text-[32px] font-bold leading-[1.1] tracking-tight text-white sm:text-[40px] lg:text-[52px]">
            Your venue,<br />powered by AI.
          </h1>
          <p className="mb-8 max-w-lg font-sans text-[15px] leading-relaxed text-white/45 lg:text-[16px]">
            theKickBack turns your venue into a live, interactive system.
            Guests text, email, or tap to enter — no app needed for them. Full control for you.
          </p>

          {/* Perks grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-[20px]">{p.icon}</span>
                <div className="min-w-0">
                  <p className="font-sans text-[13px] font-semibold text-white">{p.title}</p>
                  <p className="font-sans text-[12px] leading-relaxed text-white/35">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="hidden px-6 pb-6 md:block lg:px-10">
          <p className="font-sans text-[11px] text-white/15">thekickback.net — Venue infrastructure for the modern world</p>
        </div>
      </div>

      {/* Right — Auth */}
      <div className="flex w-full flex-col justify-center px-6 py-10 md:w-1/2 md:px-10 lg:w-[45%] lg:px-16">
        <div className="w-full max-w-md">
          {/* Mobile logo (redundant on desktop) */}
          <div className="mb-8 md:hidden">
            <Image src="/logo.png" alt="theKickBack" width={120} height={40} className="h-8 w-auto" />
          </div>

          <h2 className="mb-1 font-sans text-[28px] font-bold text-white sm:text-[32px]">
            {step === "email" ? "Get started" : "Check your email"}
          </h2>
          <p className="mb-8 font-sans text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            {step === "email"
              ? "Enter your email to sign in or create an account. We'll send you a code."
              : `We sent a 6-digit code to ${email}. Enter it below.`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@venue.com"
                  autoFocus
                  className="rounded-xl border px-4 py-3.5 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                />
              </div>
              {error && <p className="rounded-lg px-3 py-2 font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>}
              <button type="submit" disabled={loading} className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Verification Code</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="rounded-xl border px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.3em] text-white placeholder:text-white/15 focus:outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                />
              </div>
              {error && <p className="rounded-lg px-3 py-2 font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>}
              <button type="submit" disabled={loading || otpCode.length < 6} className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button type="button" onClick={() => { setStep("email"); setOtpCode(""); setError(""); }} className="font-sans text-[13px] active:opacity-60" style={{ color: "rgba(255,255,255,0.3)" }}>
                Use a different email
              </button>
            </form>
          )}

          <div className="mt-8 rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <p className="font-sans text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.25)" }}>
              No password needed. We use a secure one-time code sent to your email.
              Works for both new and existing accounts.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
