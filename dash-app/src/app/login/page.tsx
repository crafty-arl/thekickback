"use client";

import { useState } from "react";
import Image from "next/image";
import { sendOtp, verifyOtp } from "./actions";

const PERKS = [
  { title: "Live venue dashboard", desc: "Real-time occupancy, vibe, and guest sessions" },
  { title: "AI-powered guest interactions", desc: "Guests email or text — AI handles the rest" },
  { title: "Apple Wallet passes", desc: "Your venue on every guest's lock screen" },
  { title: "Built-in memberships", desc: "Tiers, payments, and member recognition" },
  { title: "No app for guests", desc: "NFC, QR, or email — zero friction entry" },
  { title: "Analytics & insights", desc: "Peak hours, crowd data, guest behavior" },
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
    <main className="flex min-h-svh" style={{ backgroundColor: "#000" }}>
      {/* Left — Perks (hidden on mobile) */}
      <div
        className="hidden w-1/2 flex-col justify-between p-10 md:flex lg:p-14"
        style={{ background: "linear-gradient(180deg, #F97316 0%, #000 100%)" }}
      >
        <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="h-9 w-auto" />

        <div>
          <h1 className="mb-3 font-sans text-[40px] font-bold leading-[1.1] tracking-tight text-white lg:text-[48px]">
            Your venue,<br />powered by AI.
          </h1>
          <p className="max-w-md font-sans text-[15px] leading-relaxed text-white/50">
            theKickBack turns your venue into a live, interactive system.
            Guests text, email, or tap — no app needed.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-start gap-3">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#F97316" }} />
              <div>
                <span className="font-sans text-[13px] font-semibold text-white">{p.title}</span>
                <span className="font-sans text-[13px] text-white/35"> — {p.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="font-sans text-[11px] text-white/15">thekickback.net</p>
      </div>

      {/* Right — Auth */}
      <div className="flex w-full flex-col items-center justify-center px-6 md:w-1/2">
        {/* Mobile logo */}
        <div className="mb-10 md:hidden">
          <Image src="/logo.png" alt="theKickBack" width={140} height={46} className="h-9 w-auto" />
        </div>

        <div className="w-full max-w-sm">
          <h2 className="mb-1 font-sans text-[28px] font-bold text-white">
            {step === "email" ? "Get started" : "Check your email"}
          </h2>
          <p className="mb-8 font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            {step === "email"
              ? "Enter your email — we'll send a login code."
              : `6-digit code sent to ${email}`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@venue.com"
                className="rounded-xl border px-4 py-3.5 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              />
              {error && (
                <p className="rounded-lg px-3 py-2 text-center font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#F97316" }}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="rounded-xl border px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.3em] text-white placeholder:text-white/15 focus:outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              />
              {error && (
                <p className="rounded-lg px-3 py-2 text-center font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#F97316" }}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setOtpCode(""); setError(""); }}
                className="font-sans text-[13px] active:opacity-60"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Use a different email
              </button>
            </form>
          )}

          {/* Mobile perks teaser */}
          <div className="mt-10 md:hidden">
            <p className="mb-4 font-sans text-[11px] font-medium tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              WHY VENUES CHOOSE THEKICKBACK
            </p>
            {PERKS.slice(0, 3).map((p) => (
              <div key={p.title} className="mb-2 flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: "#F97316" }} />
                <span className="font-sans text-[12px] text-white/30">{p.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
