"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WalletData {
  id: string;
  spendingLimitCents: number;
  spentThisPeriodCents: number;
  remainingCents: number;
  period: "daily" | "weekly" | "monthly";
  periodStartedAt: string;
  hasCard: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  autoReload: boolean;
  autoReloadAmountCents: number;
  active: boolean;
}

interface Transaction {
  id: string;
  amountCents: number;
  description: string | null;
  status: string;
  venueName: string | null;
  createdAt: string;
}

const PRESETS = [2500, 5000, 10000, 25000]; // $25, $50, $100, $250
const PERIOD_LABELS: Record<string, string> = { daily: "day", weekly: "week", monthly: "month" };

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function CardBrandIcon({ brand }: { brand: string | null }) {
  const label = brand === "visa" ? "Visa" : brand === "mastercard" ? "MC" : brand === "amex" ? "Amex" : brand || "Card";
  return (
    <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-white/40">
      {label}
    </span>
  );
}

export function WalletSheet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Setup state
  const [limit, setLimit] = useState(5000);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [autoReload, setAutoReload] = useState(false);

  // Card setup
  const [addingCard, setAddingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Load wallet
  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.wallet) {
          setWallet(data.wallet);
          setLimit(data.wallet.spendingLimitCents);
          setPeriod(data.wallet.period);
          setAutoReload(data.wallet.autoReload);
        }
        if (data?.transactions) setTransactions(data.transactions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Save wallet settings
  const saveSettings = useCallback(async (newLimit?: number, newPeriod?: string, newAutoReload?: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spendingLimitCents: newLimit ?? limit,
          period: newPeriod ?? period,
          autoReload: newAutoReload ?? autoReload,
          autoReloadAmountCents: newLimit ?? limit,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Reload wallet
        const r = await fetch("/api/wallet");
        const fresh = await r.json();
        if (fresh.wallet) setWallet(fresh.wallet);
      }
    } catch {}
    setSaving(false);
  }, [limit, period, autoReload]);

  // Add card — uses Stripe Checkout in setup mode
  const handleAddCard = useCallback(async () => {
    setAddingCard(true);
    setCardError(null);
    try {
      const res = await fetch("/api/wallet/setup-intent", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setCardError(data.error);
        setAddingCard(false);
        return;
      }

      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        setCardError("Stripe not configured");
        setAddingCard(false);
        return;
      }

      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(stripeKey);
      if (!stripe) {
        setCardError("Failed to load Stripe");
        setAddingCard(false);
        return;
      }

      // Use Stripe's collectPaymentMethod with redirect for mobile-friendly card entry
      const { error } = await stripe.confirmCardSetup(data.clientSecret, {
        return_url: `${window.location.origin}/?wallet=card-saved`,
      });

      if (error) {
        setCardError(error.message || "Card setup failed");
        setAddingCard(false);
      }
      // On success, Stripe redirects to return_url which reloads the page
    } catch {
      setCardError("Something went wrong");
      setAddingCard(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-32 animate-pulse rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
      </div>
    );
  }

  const pct = wallet ? Math.min(100, Math.round((wallet.spentThisPeriodCents / Math.max(1, wallet.spendingLimitCents)) * 100)) : 0;
  const hasWallet = !!wallet;

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(99,91,255,0.1)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <div>
          <p className="font-sans text-[13px] font-semibold text-white/80">AI Wallet</p>
          <p className="font-sans text-[10px] text-white/30">Let AI spend on your behalf</p>
        </div>
      </div>

      {/* ── Active wallet ── */}
      {hasWallet && wallet.hasCard && (
        <>
          {/* Balance card */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">REMAINING THIS {wallet.period.toUpperCase()}</p>
                <p className="mt-1 font-mono text-[24px] font-bold text-white/90">{formatDollars(wallet.remainingCents)}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <CardBrandIcon brand={wallet.cardBrand} />
                  <span className="font-mono text-[11px] text-white/40">····{wallet.cardLast4}</span>
                </div>
                <p className="mt-1 font-sans text-[9px] text-white/20">
                  {formatDollars(wallet.spentThisPeriodCents)} of {formatDollars(wallet.spendingLimitCents)} / {PERIOD_LABELS[wallet.period]}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct > 80 ? "#f87171" : pct > 50 ? "#facc15" : "#4ade80",
                }}
              />
            </div>
          </div>

          {/* Spending limit presets */}
          <div className="mt-3">
            <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/25">SPENDING LIMIT</p>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setLimit(p); saveSettings(p); }}
                  className="flex-1 rounded-xl py-2 font-mono text-[12px] font-bold transition active:scale-95"
                  style={{
                    backgroundColor: limit === p ? "rgba(99,91,255,0.15)" : "rgba(255,255,255,0.04)",
                    color: limit === p ? "#a78bfa" : "rgba(255,255,255,0.35)",
                    border: `1px solid ${limit === p ? "rgba(99,91,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {formatDollars(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Period selector */}
          <div className="mt-3 flex gap-1.5">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); saveSettings(undefined, p); }}
                className="flex-1 rounded-xl py-2 font-sans text-[11px] font-medium capitalize transition active:scale-95"
                style={{
                  backgroundColor: period === p ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: period === p ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                  border: `1px solid ${period === p ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Auto-reload toggle */}
          <button
            onClick={() => { setAutoReload(!autoReload); saveSettings(undefined, undefined, !autoReload); }}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="font-sans text-[12px] font-medium text-white/60">Auto-reload</p>
              <p className="font-sans text-[10px] text-white/25">Refill limit each {PERIOD_LABELS[period]}</p>
            </div>
            <div
              className="flex h-6 w-10 items-center rounded-full px-0.5 transition-colors"
              style={{ backgroundColor: autoReload ? "#4ade80" : "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: autoReload ? "translateX(16px)" : "translateX(0)" }}
              />
            </div>
          </button>

          {/* Recent transactions */}
          {transactions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/25">RECENT</p>
              <div className="flex flex-col gap-1">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div>
                      <p className="font-sans text-[11px] text-white/50">{tx.venueName || tx.description || "Transaction"}</p>
                      <p className="font-sans text-[9px] text-white/20">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[12px] font-bold text-white/60">-{formatDollars(tx.amountCents)}</p>
                      <p className="font-sans text-[8px]" style={{ color: tx.status === "completed" ? "#4ade80" : tx.status === "failed" ? "#f87171" : "#facc15" }}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Setup — no card yet ── */}
      {hasWallet && !wallet.hasCard && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(99,91,255,0.05)", border: "1px solid rgba(99,91,255,0.15)" }}>
          <p className="font-sans text-[13px] font-semibold text-white/80">Add a card to activate</p>
          <p className="mt-1 font-sans text-[11px] text-white/35">
            Your AI wallet is set to {formatDollars(wallet.spendingLimitCents)}/{PERIOD_LABELS[wallet.period]}. Add a payment method to start.
          </p>
          {cardError && (
            <p className="mt-2 font-sans text-[11px] text-red-400">{cardError}</p>
          )}
          <button
            onClick={handleAddCard}
            disabled={addingCard}
            className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#635bff" }}
          >
            {addingCard ? "Setting up..." : "Add Payment Method"}
          </button>
        </div>
      )}

      {/* ── No wallet yet ── */}
      {!hasWallet && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-sans text-[13px] font-semibold text-white/80">Let AI handle payments</p>
          <p className="mt-1 font-sans text-[11px] leading-[1.5] text-white/35">
            Set a spending limit and the AI will order for you — no checkout screens. You control the max per {PERIOD_LABELS[period]}.
          </p>

          {/* Limit presets */}
          <div className="mt-3 flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setLimit(p)}
                className="flex-1 rounded-xl py-2 font-mono text-[12px] font-bold transition active:scale-95"
                style={{
                  backgroundColor: limit === p ? "rgba(99,91,255,0.15)" : "rgba(255,255,255,0.04)",
                  color: limit === p ? "#a78bfa" : "rgba(255,255,255,0.35)",
                  border: `1px solid ${limit === p ? "rgba(99,91,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {formatDollars(p)}
              </button>
            ))}
          </div>

          {/* Period */}
          <div className="mt-2 flex gap-1.5">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="flex-1 rounded-xl py-1.5 font-sans text-[10px] font-medium capitalize transition active:scale-95"
                style={{
                  backgroundColor: period === p ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: period === p ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                  border: `1px solid ${period === p ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                }}
              >
                per {p.replace("ly", "")}
              </button>
            ))}
          </div>

          <button
            onClick={() => saveSettings()}
            disabled={saving}
            className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#635bff" }}
          >
            {saving ? "Setting up..." : `Set ${formatDollars(limit)}/${PERIOD_LABELS[period]} Limit`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Hook: check if user has active wallet (for AI to know) ──
export function useWalletStatus() {
  const [status, setStatus] = useState<{ active: boolean; remainingCents: number } | null>(null);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.wallet?.active && data.wallet.hasCard) {
          setStatus({ active: true, remainingCents: data.wallet.remainingCents });
        } else {
          setStatus({ active: false, remainingCents: 0 });
        }
      })
      .catch(() => setStatus({ active: false, remainingCents: 0 }));
  }, []);

  return status;
}
