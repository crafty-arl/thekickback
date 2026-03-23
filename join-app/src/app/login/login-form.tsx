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
  const [step, setStep] = useState<"email" | "verify" | "waitlisted">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [refKey, setRefKey] = useState<string | null>(null);

  // Generate device fingerprint and capture referral key on mount
  useEffect(() => {
    getDeviceId().then(setDeviceId);
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        setRefKey(ref);
        localStorage.setItem("kb-ref", ref);
      } else {
        const stored = localStorage.getItem("kb-ref");
        if (stored) setRefKey(stored);
      }
    } catch {}
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

    const result = await verifyOtp(email, otpCode, did, deviceName, returnTo, refKey || undefined);

    if ((result as { waitlisted?: boolean })?.waitlisted) {
      setStep("waitlisted");
      setLoading(false);
      try { localStorage.removeItem("kb-ref"); } catch {}
      return;
    }

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      try { localStorage.removeItem("kb-ref"); } catch {}
    }
  }

  if (step === "waitlisted") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-black px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="h-10 w-auto" priority />
          </div>
          <div className=" p-8 text-center" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center " style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
              <span className="text-[32px]">{"\u23F3"}</span>
            </div>
            <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-white">You're on the waitlist</h1>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              We're letting people in gradually. You'll get an email as soon as you're approved.
            </p>
            <div className=" px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Have a referral key from a friend? Use the invite link they shared to skip the line.
              </p>
            </div>
            <button
              onClick={() => { setStep("email"); setOtpCode(""); setError(""); }}
              className="mt-4 text-sm transition"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Try a different email
            </button>
          </div>
        </div>
      </main>
    );
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

        <div className=" p-8" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-white">
            {step === "email" ? "Sign in" : "Check your email"}
          </h1>
          <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {step === "email"
              ? "Enter your email to get a login code."
              : `We sent a 6-digit code to ${email}`}
          </p>

          {refKey && step === "email" && (
            <div className="mb-4  px-4 py-2.5" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
              <p className="text-center text-xs font-medium" style={{ color: "#4ADE80" }}>
                Referral key detected — you'll skip the waitlist
              </p>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className=" px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className=" bg-orange px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.97] disabled:opacity-50"
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
                className=" px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className=" bg-orange px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.97] disabled:opacity-50"
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
