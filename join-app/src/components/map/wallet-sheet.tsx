"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface WalletData {
  id: string;
  balanceCents: number;
  spendingLimitCents: number;
  spentThisPeriodCents: number;
  remainingCents: number;
  period: "daily" | "weekly" | "monthly";
  hasCard: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  autoReload: boolean;
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

const FUND_PRESETS = [1000, 2500, 5000, 10000]; // $10, $25, $50, $100
const STRIPE_FEE_RATE = 0.029; // 2.9%
const STRIPE_FEE_FIXED = 30;   // 30¢
const PLATFORM_FEE_RATE = 0.02; // 2% KickBack platform fee

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function calcFees(amountCents: number) {
  const stripeFee = Math.round(amountCents * STRIPE_FEE_RATE) + STRIPE_FEE_FIXED;
  const platformFee = Math.round(amountCents * PLATFORM_FEE_RATE);
  const totalCharge = amountCents + stripeFee + platformFee;
  return { stripeFee, platformFee, totalCharge, walletCredit: amountCents };
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
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundSuccess, setFundSuccess] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [removingCard, setRemovingCard] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null); // cents — shows confirmation modal

  const loadWallet = useCallback(() => {
    fetch("/api/wallet")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.wallet) setWallet(data.wallet);
        if (data?.transactions) setTransactions(data.transactions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  // Handle return from Stripe Checkout (card saved)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const walletAction = params.get("wallet");

    if (walletAction === "card-saved" && sessionId) {
      // Confirm the card with our backend
      fetch("/api/wallet/confirm-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) loadWallet();
          else setCardError(data.error || "Failed to save card");
        })
        .catch(() => setCardError("Failed to save card"));

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("wallet");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [loadWallet]);

  // Create wallet (first time)
  const createWallet = useCallback(async () => {
    setLoading(true);
    await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spendingLimitCents: 5000, period: "weekly" }),
    });
    loadWallet();
  }, [loadWallet]);

  // Add card — redirect to Stripe Checkout (hosted card form)
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
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        setCardError("No checkout URL returned");
        setAddingCard(false);
      }
    } catch {
      setCardError("Something went wrong");
      setAddingCard(false);
    }
  }, []);

  // Remove card
  const handleRemoveCard = useCallback(async () => {
    setRemovingCard(true);
    try {
      const res = await fetch("/api/wallet/remove-card", { method: "POST" });
      const data = await res.json();
      if (data.ok) loadWallet();
      else setCardError(data.error || "Failed to remove card");
    } catch {
      setCardError("Something went wrong");
    }
    setRemovingCard(false);
  }, [loadWallet]);

  // Add funds — shows confirmation first, then charges
  const handleFundConfirm = useCallback(async () => {
    if (!confirmAmount) return;
    setFunding(true);
    setFundError(null);
    setFundSuccess(null);
    const amountCents = confirmAmount;
    setConfirmAmount(null);
    try {
      const res = await fetch("/api/wallet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (data.ok) {
        setWallet((prev) => prev ? { ...prev, balanceCents: data.balanceCents ?? (prev.balanceCents + amountCents) } : prev);
        setFundSuccess(`Added ${formatDollars(amountCents)} to your wallet`);
        setTimeout(() => setFundSuccess(null), 3000);
      } else {
        setFundError(data.error || "Payment failed");
      }
    } catch {
      setFundError("Something went wrong");
    }
    setFunding(false);
  }, [confirmAmount]);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-32 animate-pulse rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
      </div>
    );
  }

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
          <p className="font-sans text-[10px] text-white/30">Load funds, AI spends for you</p>
        </div>
      </div>

      {/* ── Has wallet + card: show balance + add funds ── */}
      {wallet?.hasCard && (
        <>
          {/* Balance */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-white/25">BALANCE</p>
                <p className="mt-1 font-mono text-[28px] font-bold text-white/90">{formatDollars(wallet.balanceCents)}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <CardBrandIcon brand={wallet.cardBrand} />
                  <span className="font-mono text-[11px] text-white/40">····{wallet.cardLast4}</span>
                </div>
                {wallet.balanceCents > 0 && (
                  <p className="mt-1 font-sans text-[9px] text-white/20">
                    AI can spend up to {formatDollars(wallet.balanceCents)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card management */}
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={handleAddCard}
              disabled={addingCard}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-sans text-[11px] font-medium text-white/40 transition active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              {addingCard ? "Redirecting..." : "Switch Card"}
            </button>
            <button
              onClick={handleRemoveCard}
              disabled={removingCard}
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-sans text-[11px] font-medium text-red-400/60 transition active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)" }}
            >
              {removingCard ? "..." : "Remove"}
            </button>
          </div>

          {/* Add Funds */}
          <div className="mt-3">
            <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/25">ADD FUNDS</p>
            <div className="flex gap-1.5">
              {FUND_PRESETS.map((amount) => (
                <motion.button
                  key={amount}
                  onClick={() => setConfirmAmount(amount)}
                  disabled={funding}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 rounded-xl py-2.5 font-mono text-[13px] font-bold transition disabled:opacity-40"
                  style={{
                    backgroundColor: "rgba(99,91,255,0.1)",
                    color: "#a78bfa",
                    border: "1px solid rgba(99,91,255,0.2)",
                  }}
                >
                  {funding ? "..." : formatDollars(amount)}
                </motion.button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="mt-2 flex gap-1.5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[14px] font-bold text-white/25">$</span>
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="1"
                  placeholder="Custom"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full rounded-xl py-2.5 pl-7 pr-3 font-mono text-[13px] font-bold text-white placeholder:text-white/20 focus:outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
              <motion.button
                onClick={() => {
                  const cents = Math.round(parseFloat(customAmount) * 100);
                  if (cents >= 1000) setConfirmAmount(cents);
                }}
                disabled={funding || !customAmount || parseFloat(customAmount) < 10}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-white transition disabled:opacity-30"
                style={{ backgroundColor: "#635bff" }}
              >
                {funding ? "..." : "Add"}
              </motion.button>
            </div>
            <p className="mt-1 font-sans text-[9px] text-white/15">$10 minimum</p>
          </div>

          {/* Success / Error */}
          {fundSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 rounded-xl px-4 py-2"
              style={{ backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <p className="font-sans text-[12px] text-green-400">{fundSuccess}</p>
            </motion.div>
          )}
          {fundError && (
            <div className="mt-2 rounded-xl px-4 py-2" style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="font-sans text-[12px] text-red-400">{fundError}</p>
            </div>
          )}

          {/* Confirmation modal */}
          {confirmAmount && (() => {
            const fees = calcFees(confirmAmount);
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-2xl p-4"
                style={{ backgroundColor: "rgba(99,91,255,0.06)", border: "1px solid rgba(99,91,255,0.2)" }}
              >
                <p className="font-sans text-[13px] font-semibold text-white/80">Confirm payment</p>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="font-sans text-[12px] text-white/40">Wallet credit</span>
                    <span className="font-mono text-[12px] font-semibold text-white/70">{formatDollars(fees.walletCredit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-[12px] text-white/40">Stripe fee (2.9% + 30¢)</span>
                    <span className="font-mono text-[12px] text-white/40">{formatDollars(fees.stripeFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-[12px] text-white/40">Platform fee (2%)</span>
                    <span className="font-mono text-[12px] text-white/40">{formatDollars(fees.platformFee)}</span>
                  </div>
                  <div className="mt-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                  <div className="flex justify-between">
                    <span className="font-sans text-[13px] font-semibold text-white/70">Total charge</span>
                    <span className="font-mono text-[14px] font-bold text-white/90">{formatDollars(fees.totalCharge)}</span>
                  </div>
                </div>
                <p className="mt-2 font-sans text-[10px] text-white/20">
                  {formatDollars(fees.walletCredit)} will be added to your wallet. Card ····{wallet?.cardLast4} will be charged {formatDollars(fees.totalCharge)}.
                </p>
                <div className="mt-3 flex gap-2">
                  <motion.button
                    onClick={handleFundConfirm}
                    disabled={funding}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 rounded-xl py-2.5 font-sans text-[13px] font-bold text-white transition disabled:opacity-50"
                    style={{ backgroundColor: "#635bff" }}
                  >
                    {funding ? "Processing..." : `Pay ${formatDollars(fees.totalCharge)}`}
                  </motion.button>
                  <button
                    onClick={() => setConfirmAmount(null)}
                    className="rounded-xl px-4 py-2.5 font-sans text-[13px] font-medium text-white/40 transition active:scale-95"
                    style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            );
          })()}

          {/* Recent transactions */}
          {transactions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1px] text-white/25">RECENT</p>
              <div className="flex flex-col gap-1">
                {transactions.slice(0, 5).map((tx) => {
                  const isFund = tx.description?.startsWith("Added funds");
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                      <div>
                        <p className="font-sans text-[11px] text-white/50">{tx.venueName || tx.description || "Transaction"}</p>
                        <p className="font-sans text-[9px] text-white/20">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-[12px] font-bold ${isFund ? "text-green-400" : "text-white/60"}`}>
                          {isFund ? "+" : "-"}{formatDollars(tx.amountCents)}
                        </p>
                        <p className="font-sans text-[8px]" style={{ color: tx.status === "completed" ? "#4ade80" : tx.status === "failed" ? "#f87171" : "#facc15" }}>
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Has wallet, no card yet ── */}
      {wallet && !wallet.hasCard && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(99,91,255,0.05)", border: "1px solid rgba(99,91,255,0.15)" }}>
          <p className="font-sans text-[13px] font-semibold text-white/80">Add a card to load funds</p>
          <p className="mt-1 font-sans text-[11px] text-white/35">
            Save a payment method, then add money. The AI will spend from your balance.
          </p>
          {cardError && <p className="mt-2 font-sans text-[11px] text-red-400">{cardError}</p>}
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

      {/* ── No wallet ── */}
      {!wallet && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-sans text-[13px] font-semibold text-white/80">Let AI handle payments</p>
          <p className="mt-1 font-sans text-[11px] leading-[1.5] text-white/35">
            Load funds into your wallet and the AI orders for you at any venue — no checkout needed.
          </p>
          <button
            onClick={createWallet}
            className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-bold text-white transition active:scale-[0.98]"
            style={{ backgroundColor: "#635bff" }}
          >
            Set Up AI Wallet
          </button>
        </div>
      )}
    </div>
  );
}

// ── Hook: check if user has funded wallet (for AI to know) ──
export function useWalletStatus() {
  const [status, setStatus] = useState<{ active: boolean; balanceCents: number } | null>(null);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.wallet?.active && data.wallet.hasCard && data.wallet.balanceCents > 0) {
          setStatus({ active: true, balanceCents: data.wallet.balanceCents });
        } else {
          setStatus({ active: false, balanceCents: 0 });
        }
      })
      .catch(() => setStatus({ active: false, balanceCents: 0 }));
  }, []);

  return status;
}
