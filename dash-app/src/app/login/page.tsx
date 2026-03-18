"use client";

import { useState } from "react";
import Image from "next/image";
import { sendOtp, verifyOtp } from "./actions";

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

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep("verify");
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await verifyOtp(email, otpCode);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, the server action redirects to /
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="theKickBack"
            width={160}
            height={53}
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-8">
          <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-dark">
            {step === "email" ? "Sign in" : "Check your email"}
          </h1>
          <p className="mb-6 text-sm text-black/45">
            {step === "email"
              ? "Enter your email to receive a login code."
              : `We sent a 6-digit code to ${email}`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <input
                type="email"
                required
                placeholder="you@venue.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-orange px-4 py-3 font-sans text-sm font-semibold text-white transition hover:bg-orange/90 disabled:opacity-50"
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
                placeholder="000000"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="rounded-xl border border-black/10 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="rounded-xl bg-orange px-4 py-3 font-sans text-sm font-semibold text-white transition hover:bg-orange/90 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtpCode("");
                  setError("");
                }}
                className="font-sans text-sm text-black/40 transition hover:text-black/60"
              >
                Use a different email
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-red-500">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-black/30">
          Venue owners only. Need access?{" "}
          <a
            href="https://thekickback.net"
            className="text-orange underline"
          >
            Get in touch
          </a>
        </p>
      </div>
    </main>
  );
}
