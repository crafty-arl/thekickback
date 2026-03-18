"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! Let's get your venue on theKickBack. Tell me about your spot — name, what kind of place, and where it is.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json() as { reply: string; venueCreated?: boolean };

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
      ]);

      if (data.venueCreated) {
        setDone(true);
        // Delay to let user see success, then hard reload to pick up new venue ownership
        setTimeout(() => window.location.href = "/", 3000);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, router]);

  return (
    <main className="flex min-h-svh flex-col" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="theKickBack" width={120} height={40} className="h-7 w-auto" />
          <div className="h-4 w-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="font-sans text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
            Venue Setup
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "#F97316" }} />
          <span className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
            AI Onboarding
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        style={{ WebkitOverflowScrolling: "touch" as const }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "rounded-br-sm"
                    : "rounded-bl-sm"
                }`}
                style={
                  msg.role === "user"
                    ? { backgroundColor: "#F97316", color: "#000" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)" }
                }
              >
                <p className="whitespace-pre-wrap font-sans text-[14px] leading-[1.6]">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="flex justify-center py-4">
              <div className="rounded-xl px-5 py-3 text-center" style={{ backgroundColor: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
                <p className="font-sans text-[14px] font-medium" style={{ color: "#4ADE80" }}>
                  Venue submitted for review! Redirecting to dashboard...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-3 border-t px-4 py-3 sm:px-6"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={done ? "All done!" : "Type your answer..."}
            disabled={done}
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 rounded-full border px-4 font-sans text-[14px] text-white placeholder:text-white/25 focus:outline-none disabled:opacity-30"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.08)",
              height: 46,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || done}
            className="flex shrink-0 items-center justify-center rounded-full active:scale-90 disabled:opacity-30"
            style={{ backgroundColor: "#F97316", width: 44, height: 44 }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
