"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

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

  const showRedirect = userMsgCount >= 5;

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#fff" }}>
      {/* ═══ NAV ═══ */}
      <nav className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Image src="/logo.png" alt="theKickBack" width={120} height={38} priority style={{ height: "auto" }} />
        <div className="flex items-center gap-2">
          <a href="https://join.thekickback.net"
            className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:text-white/90"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >Explore Hubs</a>
          <a href="https://dash.thekickback.net"
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >List Your Hub — Free</a>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="px-5 pt-14 pb-10 text-center max-w-2xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-sans text-[32px] sm:text-[42px] font-bold leading-tight tracking-tight"
        >
          Every spot deserves<br />
          <span style={{ color: ORANGE }}>a digital front door.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-4 text-[16px] sm:text-[18px] leading-relaxed text-white/50 max-w-lg mx-auto"
        >
          Barbershops. Nail salons. Leagues. Studios. Cafes.<br className="hidden sm:block" />
          If people gather there, it belongs on theKickBack.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center gap-3 mt-8"
        >
          <a href="https://join.thekickback.net"
            className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >Find a Spot Near You</a>
          <a href="https://dash.thekickback.net"
            className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
          >I Run a Spot — Set It Up Free</a>
        </motion.div>
      </section>

      {/* ═══ HOW IT WORKS — 3 steps ═══ */}
      <section className="px-5 pb-12 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "1", icon: "📍", title: "Open the Map", desc: "See every hub near you — live vibes, real-time energy, and what's happening right now." },
            { step: "2", icon: "💬", title: "Chat with Any Hub", desc: "Ask the AI about hours, book an appointment, browse the menu, or buy something — all in the conversation." },
            { step: "3", icon: "⚡", title: "Build Your Rep", desc: "Every visit earns XP. Unlock tiers. Get perks. Your hub knows you're a regular before you say a word." },
          ].map((s) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * parseInt(s.step) }}
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <h3 className="font-sans text-[15px] font-semibold text-white/90 mb-1">{s.title}</h3>
              <p className="font-sans text-[13px] leading-relaxed text-white/45">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ WHO IT'S FOR ═══ */}
      <section className="px-5 pb-12 max-w-2xl mx-auto text-center">
        <p className="text-[13px] text-white/30 mb-3 uppercase tracking-widest font-medium">Hubs on the platform</p>
        <div className="flex flex-wrap justify-center gap-2">
          {["Barbershops", "Nail Salons", "Cafes", "Leagues", "Studios", "Musicians", "Artists", "Coworking", "Restaurants", "Communities", "Pop-ups", "Bars"].map((c) => (
            <span key={c} className="rounded-full px-3 py-1 text-[11px] font-medium"
              style={{ backgroundColor: "rgba(249,115,22,0.08)", color: "rgba(249,115,22,0.7)", border: "1px solid rgba(249,115,22,0.12)" }}
            >{c}</span>
          ))}
        </div>
      </section>

      {/* ═══ DIVIDER ═══ */}
      <div className="max-w-2xl mx-auto px-5 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          <span className="text-[12px] text-white/25 font-medium">Ask KickBack anything</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>

      {/* ═══ CHAT ═══ */}
      <section className="max-w-2xl mx-auto px-5 pb-6">
        <div className="rounded-2xl overflow-hidden flex flex-col" style={{
          background: "rgba(12, 12, 14, 0.97)",
          border: "1px solid rgba(255,255,255,0.06)",
          minHeight: 380,
          maxHeight: 500,
        }}>
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

          {/* Redirect CTA — after 5 interactions */}
          {showRedirect && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mb-2 rounded-2xl p-4"
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

          {/* Quick chips — before first message */}
          {userMsgCount === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {[
                "What is KickBack?",
                "How do I find spots near me?",
                "I own a small business",
                "What hubs are on the platform?",
                "How does the AI Wallet work?",
                "I want to list my hub",
              ].map((q) => (
                <button key={q} onClick={() => sendChat(q)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/10"
                  style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}
                >{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
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
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="px-5 pt-6 pb-12 max-w-2xl mx-auto text-center">
        <p className="text-[14px] text-white/40 mb-1">No app download. No passwords. No fees to start.</p>
        <p className="text-[13px] text-white/25 mb-6">Works on web, SMS, and email.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <a href="https://join.thekickback.net"
            className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >Start Exploring</a>
          <a href="https://dash.thekickback.net"
            className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
          >Set Up Your Hub — It&apos;s Free</a>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="flex justify-center gap-4 px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <a href="/about" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">About</a>
        <a href="/privacy" className="font-sans text-[11px] text-white/30 hover:text-white/60 transition">Privacy</a>
      </footer>
    </div>
  );
}
