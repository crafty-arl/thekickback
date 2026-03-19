"use client";

import { useState } from "react";
import Image from "next/image";
import { sendOtp, verifyOtp } from "./actions";

const PERKS = [
  { icon: "\ud83d\udcca", title: "Live Dashboard", desc: "Real-time occupancy, vibe tracking, and guest activity" },
  { icon: "\ud83e\udd16", title: "AI Interactions", desc: "Guests email or text \u2014 AI handles responses automatically" },
  { icon: "\ud83d\udcf2", title: "Wallet Passes", desc: "Your venue lives on every guest's lock screen" },
  { icon: "\ud83d\udcb3", title: "Memberships", desc: "Built-in tiers, payments, and member recognition" },
  { icon: "\u26a1", title: "Zero Friction", desc: "NFC, QR, or email \u2014 no app download needed for guests" },
  { icon: "\ud83d\udcc8", title: "Analytics", desc: "Peak hours, crowd patterns, and guest behavior insights" },
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
    <main className="flex min-h-svh flex-col md:flex-row" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Left — Brand + Marketing */}
      <div className="flex w-full flex-col md:w-1/2 lg:w-[55%]" style={{ background: "linear-gradient(165deg, #FFF7ED 0%, #FFFFFF 40%, #F8FAFC 100%)" }}>
        {/* Logo — large and prominent */}
        <div className="flex items-center justify-between px-8 pt-8 lg:px-14 lg:pt-12">
          <Image
            src="/logo.png"
            alt="theKickBack"
            width={400}
            height={200}
            className="h-16 w-auto sm:h-20 lg:h-24"
            priority
          />
          <a
            href="https://thekickback.net"
            className="hidden rounded-full border px-4 py-2 font-sans text-[13px] font-medium text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700 md:block"
            style={{ borderColor: "#E5E5E5" }}
          >
            Learn more
          </a>
        </div>

        {/* Hero */}
        <div className="flex flex-1 flex-col justify-center px-8 pb-10 md:pb-0 lg:px-14">
          <h1 className="mb-4 font-sans text-[34px] font-extrabold leading-[1.08] tracking-tight text-neutral-900 sm:text-[42px] lg:text-[54px]">
            Your venue,<br />powered by AI.
          </h1>
          <p className="mb-10 max-w-lg font-sans text-[15px] leading-relaxed text-neutral-400 lg:text-[16px]">
            theKickBack turns your venue into a live, interactive system.
            Guests text, email, or tap to enter — no app needed for them. Full control for you.
          </p>

          {/* Perks */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-3.5 rounded-2xl border p-4 transition hover:shadow-sm"
                style={{ backgroundColor: "#FFFFFF", borderColor: "#F0F0F0" }}
              >
                <span className="text-[22px]">{p.icon}</span>
                <div className="min-w-0">
                  <p className="font-sans text-[13px] font-semibold text-neutral-800">{p.title}</p>
                  <p className="font-sans text-[12px] leading-relaxed text-neutral-400">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="hidden px-8 pb-8 md:block lg:px-14">
          <p className="font-sans text-[11px] text-neutral-300">thekickback.net — Venue infrastructure for the modern world</p>
        </div>
      </div>

      {/* Right — Auth form */}
      <div
        className="flex w-full flex-col justify-center border-l px-8 py-12 md:w-1/2 md:px-12 lg:w-[45%] lg:px-20"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#F0F0F0" }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 md:hidden">
            <Image src="/logo.png" alt="theKickBack" width={200} height={100} className="h-14 w-auto" />
          </div>

          <h2 className="mb-1.5 font-sans text-[28px] font-bold tracking-tight text-neutral-900 sm:text-[32px]">
            {step === "email" ? "Get started" : "Check your email"}
          </h2>
          <p className="mb-8 font-sans text-[14px] leading-relaxed text-neutral-400">
            {step === "email"
              ? "Enter your email to sign in or create an account. We\u2019ll send you a code."
              : `We sent a 6-digit code to ${email}. Enter it below.`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-semibold text-neutral-500">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@venue.com"
                  autoFocus
                  className="rounded-xl border px-4 py-3.5 font-sans text-[14px] text-neutral-900 placeholder:text-neutral-300 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#E5E5E5" }}
                />
              </div>
              {error && (
                <p className="rounded-lg border px-3 py-2.5 font-sans text-[13px]" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#F97316" }}
              >
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-semibold text-neutral-500">Verification Code</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="rounded-xl border px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.3em] text-neutral-900 placeholder:text-neutral-200 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#E5E5E5" }}
                />
              </div>
              {error && (
                <p className="rounded-lg border px-3 py-2.5 font-sans text-[13px]" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#F97316" }}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setOtpCode(""); setError(""); }}
                className="font-sans text-[13px] text-neutral-400 transition hover:text-neutral-600 active:opacity-60"
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="mt-8 rounded-xl border p-4" style={{ borderColor: "#F0F0F0", backgroundColor: "#FAFAFA" }}>
            <p className="font-sans text-[12px] leading-relaxed text-neutral-400">
              No password needed. We use a secure one-time code sent to your email.
              Works for both new and existing accounts.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
