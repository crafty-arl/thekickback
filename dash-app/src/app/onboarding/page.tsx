"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HubPreview } from "@/components/hub-preview";
import type { HubData } from "@/components/hub-preview";
import { submitHubForReview } from "./actions";

// ─── Types ──────────────────────────────────────────────────────────

interface OnboardingMessage {
  id: string;
  sender: "user" | "agent";
  body: string;
  timestamp: number;
}

// ─── Data extraction helpers ────────────────────────────────────────

const KNOWN_TYPES = [
  "bar",
  "restaurant",
  "lounge",
  "club",
  "cafe",
  "coworking",
  "barbershop",
  "nail salon",
];

function extractHubDataFromMessages(
  messages: OnboardingMessage[]
): Partial<HubData> {
  const allUserText = messages
    .filter((m) => m.sender === "user")
    .map((m) => m.body)
    .join(" ");
  const updates: Partial<HubData> = {};

  // Type detection
  for (const t of KNOWN_TYPES) {
    if (allUserText.toLowerCase().includes(t)) {
      updates.type = t;
      break;
    }
  }

  // Try to extract a name — look for quoted text or "called X" / "named X"
  const calledMatch = allUserText.match(
    /(?:called|named|it's|its)\s+["']?([A-Z][A-Za-z0-9' &-]{1,30})["']?/i
  );
  if (calledMatch) {
    updates.name = calledMatch[1].trim();
  }

  return updates;
}

function mergePartialData(
  current: HubData,
  partial: Record<string, unknown>
): HubData {
  return {
    name: (partial.name as string) || current.name,
    type: (partial.type as string) || current.type,
    address: (partial.address as string) || current.address,
    tagline: (partial.tagline as string) || current.tagline,
    description: (partial.description as string) || current.description,
    themeColor: (partial.themeColor as string) || current.themeColor,
    hours: (partial.hours as string) || current.hours,
    capacity:
      (partial.maxOccupancy as number) ||
      (partial.capacity as number) ||
      current.capacity,
    slug: (partial.slug as string) || current.slug,
  };
}

// Default quick replies (before AI generates any)
const DEFAULT_REPLIES = [
  "It\u2019s a cocktail bar called The Rooftop on 6th St in Austin",
  "Coffee shop in Brooklyn, we\u2019re called Drip",
  "Barbershop in Houston called Fresh Cuts",
  "It\u2019s a coworking space",
];

// ─── Welcome message ───────────────────────────────────────────────

const WELCOME_MESSAGE =
  "Welcome to theKickBack. Let\u2019s get your hub set up \u2014 tell me about your spot. What\u2019s it called, what kind of place is it, and where is it?";

// ─── Main Page Component ───────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<OnboardingMessage[]>([
    {
      id: "welcome",
      sender: "agent",
      body: WELCOME_MESSAGE,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [venueCreated, setVenueCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>(DEFAULT_REPLIES);

  const [hubData, setHubData] = useState<HubData>({
    name: "",
    type: "",
    address: "",
    tagline: "",
    description: "",
    themeColor: "#F97316",
    hours: "",
    capacity: 100,
    slug: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // ─── Scroll helper ──────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  // ─── Virtual keyboard handler ─────────────────────────────────

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => scrollToBottom();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollToBottom]);

  // ─── Submit for review ────────────────────────────────────────

  const handleSubmitForReview = useCallback(async () => {
    const result = await submitHubForReview();
    if (result?.ok) {
      setSubmitted(true);
    } else {
      // Still redirect even on error — hub was created
      router.push("/");
    }
  }, [router]);

  // No auto-redirect — user stays on page and sees "under review" state

  // ─── Send message ─────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading || venueCreated) return;

      const userMsg: OnboardingMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        body: msg,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      scrollToBottom();

      // Lightweight extraction from user messages for immediate preview feedback
      const allMessages = [...messages, userMsg];
      const extracted = extractHubDataFromMessages(allMessages);
      if (Object.keys(extracted).length > 0) {
        setHubData((prev) => ({ ...prev, ...extracted }));
      }

      // Track conversation for API
      conversationRef.current.push({ role: "user", content: msg });

      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversationRef.current }),
        });

        const data = await res.json();
        const reply =
          data.reply || "Something went wrong. Try again.";

        conversationRef.current.push({ role: "assistant", content: reply });

        const agentMsg: OnboardingMessage = {
          id: `agent-${Date.now()}`,
          sender: "agent",
          body: reply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, agentMsg]);

        // Update hub data from API partial data
        if (data.hubData) {
          setHubData((prev) => mergePartialData(prev, data.hubData));
        }

        // Update smart replies from AI
        if (data.smartReplies && data.smartReplies.length > 0) {
          setSmartReplies(data.smartReplies);
        }

        // Check if venue was created
        if (data.venueCreated) {
          setVenueCreated(true);
          setSmartReplies([]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: "agent",
            body: "Something went wrong. Try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [input, loading, venueCreated, messages, scrollToBottom]
  );

  // ─── Quick replies ────────────────────────────────────────────

  const userMessageCount = messages.filter((m) => m.sender === "user").length;
  const quickReplies = venueCreated ? [] : smartReplies;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="flex h-dvh bg-black">
      {/* Left: Chat */}
      <div className={`flex w-full flex-col lg:w-1/2 ${showPreview ? "hidden lg:flex" : ""}`}>
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Image
            src="/logo.png"
            alt="theKickBack"
            width={120}
            height={40}
            className="h-7 w-auto"
          />
          <div className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="font-sans text-[13px] font-medium text-white/35">
            Set up your hub
          </span>
        </header>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar"
          style={{ overscrollBehavior: "contain" }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`mb-3 flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.sender === "user"
                      ? "rounded-br-sm bg-orange/15 text-white/90"
                      : "rounded-bl-sm"
                  }`}
                  style={
                    msg.sender === "agent"
                      ? {
                          backgroundColor: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }
                      : undefined
                  }
                >
                  <p className="font-sans text-[14px] leading-[1.6] whitespace-pre-wrap text-white/85">
                    {msg.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading dots */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-3 flex justify-start"
            >
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex gap-1.5">
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: 0,
                    }}
                  />
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: 0.15,
                    }}
                  />
                  <motion.div
                    className="h-2 w-2 rounded-full bg-white/30"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: 0.3,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Hub created — submit for review */}
          {venueCreated && !submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-3 flex justify-start"
            >
              <div
                className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="mb-3 font-sans text-[14px] leading-[1.6] text-white/85">
                  Your hub is ready. Check the preview on the right, then submit for review. Once approved, it goes live.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitForReview}
                    className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98]"
                    style={{ backgroundColor: "#F97316" }}
                  >
                    Submit for Review
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-medium text-white/40 active:scale-[0.98]"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
                    Edit Later
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submitted for review */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-3 flex justify-start"
            >
              <div
                className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-4"
                style={{
                  backgroundColor: "rgba(74,222,128,0.06)",
                  border: "1px solid rgba(74,222,128,0.15)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-400/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <span className="font-sans text-[14px] font-bold text-green-400">Application Under Review</span>
                </div>
                <p className="mb-1 font-sans text-[13px] leading-[1.6] text-white/60">
                  Your hub has been submitted and is being reviewed by our team. We&apos;ve sent a confirmation to your email.
                </p>
                <p className="mb-3 font-sans text-[13px] leading-[1.6] text-white/40">
                  You can continue setting up your hub from the dashboard while you wait for approval.
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98]"
                  style={{ backgroundColor: "#4ADE80" }}
                >
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies + Input */}
        <div
          className="border-t border-white/[0.06]"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          {/* Quick replies */}
          {quickReplies.length > 0 && !venueCreated && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  onClick={() => sendMessage(reply)}
                  disabled={loading}
                  className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium text-white/50 transition active:scale-95 disabled:opacity-40"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-end gap-2 px-4 pb-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                venueCreated
                  ? "Hub created!"
                  : "Tell me about your hub..."
              }
              disabled={venueCreated}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className="flex-1 rounded-2xl px-4 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 outline-none disabled:opacity-40"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || venueCreated}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-orange transition active:scale-95 disabled:opacity-30"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Preview (desktop only) */}
      <div className="hidden w-1/2 border-l border-white/[0.06] lg:block">
        <HubPreview data={hubData} />
      </div>

      {/* Mobile: Preview FAB */}
      <button
        onClick={() => setShowPreview(true)}
        className="fixed bottom-24 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-orange shadow-lg lg:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Mobile: Preview sheet */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 lg:hidden"
            onClick={() => setShowPreview(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 top-16 rounded-t-3xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="font-sans text-[14px] font-semibold text-white/80">
                  Hub Preview
                </span>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-white/40"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <HubPreview data={hubData} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
