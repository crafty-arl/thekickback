"use client";

import { useState, useEffect } from "react";

interface StripeStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  email?: string;
  error?: string;
  testMode?: boolean;
}

function TestModeBanner() {
  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <p className="font-sans text-[12px] font-semibold text-yellow-700">Test Mode</p>
        <p className="font-sans text-[11px] text-yellow-600/60">
          Using a Stripe test key — no real charges. Switch to a live key in production.
        </p>
      </div>
    </div>
  );
}

export function StripeConnect() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnectError(data.error || "Failed to create Stripe onboarding link");
        setConnecting(false);
      }
    } catch {
      setConnectError("Network error — check your connection and try again");
      setConnecting(false);
    }
  };

  const handleDashboard = async () => {
    const res = await fetch("/api/stripe/dashboard");
    const data = await res.json();
    if (data.url) {
      window.open(data.url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-black/5 bg-white p-5">
        <div className="h-4 w-32 rounded bg-black/5" />
        <div className="mt-3 h-10 w-full rounded-xl bg-black/5" />
      </div>
    );
  }

  const isTestMode = status?.testMode;

  // ── Connected and fully set up ──
  if (status?.connected && status.chargesEnabled && status.payoutsEnabled) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-5">
        {isTestMode && <TestModeBanner />}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(74,222,128,0.1)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-sans text-[14px] font-semibold text-black/80">Stripe Connected</p>
            <p className="font-sans text-[12px] text-black/40">
              Payments active · Payouts enabled{status.email ? ` · ${status.email}` : ""}
            </p>
          </div>
          <button
            onClick={handleDashboard}
            className="rounded-lg bg-black/[0.04] px-3 py-1.5 font-sans text-[12px] font-medium text-black/50 transition hover:bg-black/[0.08]"
          >
            Stripe Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Connected, details submitted, waiting on Stripe verification ──
  if (status?.connected && status.detailsSubmitted) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-5">
        {isTestMode && <TestModeBanner />}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(99,91,255,0.1)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-sans text-[14px] font-semibold text-black/80">Stripe Setup Complete</p>
            <p className="font-sans text-[12px] text-black/40">
              {status.chargesEnabled
                ? "Payments active — waiting on payout verification"
                : "Your account is being verified by Stripe. This usually takes a few minutes."}
              {status.email ? ` · ${status.email}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleDashboard}
            className="flex-1 rounded-xl bg-black/[0.04] py-2.5 font-sans text-[13px] font-medium text-black/50 transition hover:bg-black/[0.08]"
          >
            Open Stripe Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-black/[0.04] px-4 py-2.5 font-sans text-[13px] font-medium text-black/50 transition hover:bg-black/[0.08]"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // ── Connected but onboarding not finished ──
  if (status?.connected && !status.detailsSubmitted) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.03)" }}>
        {isTestMode && <TestModeBanner />}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-sans text-[14px] font-semibold text-black/80">Stripe Setup Incomplete</p>
            <p className="font-sans text-[12px] text-black/40">
              You started but didn&apos;t finish. Continue where you left off.
            </p>
          </div>
        </div>
        {connectError && (
          <div className="mt-2 rounded-xl px-4 py-2" style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <p className="font-sans text-[12px] text-red-500">{connectError}</p>
          </div>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: "#f97316" }}
        >
          {connecting ? "Redirecting to Stripe..." : "Continue Setup"}
        </button>
      </div>
    );
  }

  // ── Not connected ──
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5">
      {isTestMode && <TestModeBanner />}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(99,91,255,0.1)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-sans text-[14px] font-semibold text-black/80">Accept Payments</p>
          <p className="font-sans text-[12px] text-black/40">
            Connect Stripe to receive payments from guests. Takes 5 minutes.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
        <div className="flex flex-col gap-2">
          {[
            "Guests pay through chat — you receive funds directly",
            "Automatic payouts to your bank account",
            "Real-time earnings in your dashboard",
            "Platform fee applied per transaction (based on your plan)",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-sans text-[12px] text-black/50">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {connectError && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p className="font-sans text-[12px] text-red-500">{connectError}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="mt-4 w-full rounded-xl py-3 font-sans text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: "#635bff" }}
      >
        {connecting ? "Redirecting to Stripe..." : "Connect with Stripe"}
      </button>

      <p className="mt-2 text-center font-sans text-[10px] text-black/25">
        Powered by Stripe. Your financial data is never stored on our servers.
      </p>
    </div>
  );
}
