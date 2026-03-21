"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapBackdrop } from "@/components/map-backdrop";

const ORANGE = "#f97316";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey. I'm KickBack — the concierge for every hub on the platform. Ask me about any spot, how it all works, or how to get started. What's on your mind?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const userMsgCount = chatMsgs.filter(m => m.role === "user").length;

  async function sendChat(text: string) {
    if (!text.trim() || loading) return;
    setChatMsgs((p) => [...p, { role: "user", content: text.trim() }]);
    setInput("");
    setLoading(true);
    try {
      const count = userMsgCount + 1;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), messageCount: count }),
      });
      const data = await res.json();
      setChatMsgs((p) => [...p, { role: "assistant", content: data.reply || "I'm here to help." }]);
    } catch {
      setChatMsgs((p) => [...p, { role: "assistant", content: "Connection lost. Try again." }]);
    } finally { setLoading(false); }
  }

  function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    sendChat(input);
  }

  // After 5 interactions, show the redirect CTA
  const showRedirect = userMsgCount >= 5;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a0a0a" }}>
      {/* ── Subtle map background (desktop), hidden on mobile ── */}
      <div className="absolute inset-0 hidden lg:block" style={{ opacity: 0.35 }}>
        <MapBackdrop />
      </div>

      {/* ── Dark overlay on map ── */}
      <div className="absolute inset-0 hidden lg:block" style={{ background: "linear-gradient(135deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.6) 50%, rgba(10,10,10,0.85) 100%)" }} />

      {/* ── Main chat container ── */}
      <div className="relative z-10 flex flex-col h-full max-w-[640px] mx-auto"
        style={{
          background: "rgba(12, 12, 14, 0.97)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Image src="/logo.png" alt="theKickBack" width={120} height={38} priority style={{ height: "auto" }} />
          <div className="ml-auto flex items-center gap-2">
            <a href="https://join.thekickback.net"
              className="flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:text-white/90"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >Explore</a>
            <a href="https://dash.thekickback.net"
              className="flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ backgroundColor: ORANGE, color: "#fff" }}
            >Dashboard</a>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {chatMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="shrink-0 mr-2 mt-1">
                  <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORANGE }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                </div>
              )}
              <div className="rounded-2xl px-4 py-2.5 max-w-[85%] font-sans text-[14px] leading-relaxed"
                style={m.role === "user"
                  ? { backgroundColor: `${ORANGE}20`, color: "rgba(255,255,255,0.9)", borderBottomRightRadius: 4 }
                  : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)", borderBottomLeftRadius: 4 }
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="shrink-0 mr-2 mt-1">
                <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORANGE }}
                  animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                />
              </div>
              <div className="rounded-2xl px-4 py-2.5 font-sans text-[14px]"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
              >thinking...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Redirect CTA — appears after 5 interactions */}
        {showRedirect && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 mb-2 rounded-2xl p-4"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)" }}
          >
            <p className="font-sans text-[13px] text-white/70 mb-3">Ready to dive in?</p>
            <div className="flex gap-2">
              <a href="https://join.thekickback.net"
                className="flex-1 text-center rounded-full py-2 text-[12px] font-semibold transition hover:opacity-90"
                style={{ backgroundColor: ORANGE, color: "#fff" }}
              >Explore Hubs</a>
              <a href="https://dash.thekickback.net"
                className="flex-1 text-center rounded-full py-2 text-[12px] font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              >Create Your Hub — Free</a>
            </div>
          </motion.div>
        )}

        {/* Quick action chips — only before first message */}
        {userMsgCount === 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {[
              "What is KickBack?",
              "How do I find spots near me?",
              "I own a small business",
              "What hubs are on the platform?",
              "How does the AI Wallet work?",
              "I want to list my venue",
            ].map((q) => (
              <button key={q} onClick={() => sendChat(q)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}
              >{q}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="flex items-center gap-2 px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about KickBack..."
            className="min-w-0 flex-1 rounded-full px-4 font-sans text-[13px] text-white placeholder:text-white/25 focus:outline-none"
            style={{ height: 40, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {input.trim() && (
            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
              style={{ backgroundColor: ORANGE, boxShadow: `0 2px 10px ${ORANGE}40` }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </motion.button>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-center gap-4 px-4 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <a href="https://join.thekickback.net" className="font-sans text-[11px] font-semibold" style={{ color: ORANGE }}>Find Your Spot</a>
          <a href="https://dash.thekickback.net" className="font-sans text-[11px] font-semibold" style={{ color: ORANGE }}>Set Up Your Hub</a>
          <span className="text-white/10">·</span>
          <a href="/about" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">About</a>
          <a href="/privacy" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">Privacy</a>
        </div>
      </div>
    </div>
  );
}
