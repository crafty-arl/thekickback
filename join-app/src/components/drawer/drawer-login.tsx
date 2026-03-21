"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { sendOtp, verifyOtp } from "@/app/login/actions";
import { getDeviceId } from "@/lib/device-id";
import { ACCENT } from "./the-drawer";
import Image from "next/image";

interface DrawerLoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function DrawerLogin({ onSuccess, onBack }: DrawerLoginProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "waitlisted">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refKey = useRef<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) { refKey.current = ref; localStorage.setItem("kb-ref", ref); }
      else { refKey.current = localStorage.getItem("kb-ref") || null; }
    } catch {}
  }, []);

  const handleSend = async () => {
    if (!email || loading) return;
    setError(""); setLoading(true);
    const r = await sendOtp(email);
    if (r.error) { setError(r.error); setLoading(false); return; }
    setStep("otp"); setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 6 || loading) return;
    setError(""); setLoading(true);
    const did = await getDeviceId();
    const ua = navigator.userAgent;
    const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser";
    const os = /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : "Device";
    const r = await verifyOtp(email, otp, did, `${browser} on ${os}`, undefined, refKey.current || undefined);
    if ((r as { waitlisted?: boolean })?.waitlisted) { setStep("waitlisted"); setLoading(false); try { localStorage.removeItem("kb-ref"); } catch {} return; }
    if (r?.error) { setError(r.error); setLoading(false); return; }
    try { localStorage.removeItem("kb-ref"); } catch {}
    onSuccess();
  };

  if (step === "waitlisted") {
    return (
      <div className="flex flex-1 flex-col items-center px-6 py-8">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
          <span className="text-[28px]">{"\u23F3"}</span>
        </div>
        <h2 className="mb-1 font-sans text-[18px] font-bold text-white">You're on the waitlist</h2>
        <p className="mb-4 max-w-[280px] text-center font-sans text-[15px] leading-relaxed text-white/40">
          We're letting people in gradually. You'll get an email as soon as you're approved.
        </p>
        <button onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="mt-4 font-sans text-[15px] text-white/30">Try a different email</button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-8">
      <Image src="/logo.png" alt="theKickBack" width={160} height={53} className="mb-4 h-10 w-auto" />
      <h2 className="mb-1 font-sans text-[18px] font-bold text-white">Sign in to explore</h2>
      <p className="mb-5 font-sans text-[15px] text-white/35">
        {step === "email" ? "Enter your email to get a code" : `Code sent to ${email}`}
      </p>

      {refKey.current && step === "email" && (
        <div className="mb-3 w-full max-w-xs rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <p className="text-center font-sans text-[12px] font-medium" style={{ color: "#4ADE80" }}>Referral key detected - you'll skip the waitlist</p>
        </div>
      )}

      {step === "email" ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="you@email.com"
            autoComplete="email"
            className="w-full rounded-xl px-4 font-sans text-[16px] text-white outline-none placeholder:text-white/20"
            style={{ height: 48, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !email}
            className="w-full rounded-xl font-sans text-[15px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ height: 48, backgroundColor: ACCENT }}
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="000000"
            autoComplete="one-time-code"
            className="w-full rounded-xl px-4 text-center font-mono text-[24px] tracking-[0.3em] text-white outline-none"
            style={{ height: 48, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleVerify}
            disabled={loading || otp.length < 6}
            className="w-full rounded-xl font-sans text-[15px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
            style={{ height: 48, backgroundColor: ACCENT }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="font-sans text-[15px] text-white/30">Use a different email</button>
        </div>
      )}
      {error && <p className="mt-3 font-sans text-[15px] text-red-400">{error}</p>}
    </div>
  );
}
