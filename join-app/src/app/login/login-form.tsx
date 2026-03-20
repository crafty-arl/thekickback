"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { sendOtp, verifyOtp } from "./actions";
import { getDeviceId } from "@/lib/device-id";

export function LoginForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  // Generate device fingerprint on mount
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

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

    // Ensure we have a device ID
    const did = deviceId || (await getDeviceId());

    // Build a human-readable device name
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|Android/i.test(ua);
    const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : "Browser";
    const os = /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Device";
    const deviceName = isMobile ? `${browser} on ${os}` : `${browser} on ${os}`;

    const result = await verifyOtp(email, otpCode, did, deviceName, returnTo);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-black px-4">
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

        <div className="rounded-2xl p-8" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-white">
            {step === "email" ? "Sign in" : "Check your email"}
          </h1>
          <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {step === "email"
              ? "Enter your email to get a login code."
              : `We sent a 6-digit code to ${email}`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-orange px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.97] disabled:opacity-50"
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
                className="rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="rounded-xl bg-orange px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.97] disabled:opacity-50"
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
                className="text-sm transition"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Use a different email
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          Sign in to discover and chat with venues near you.
        </p>
      </div>
    </main>
  );
}
