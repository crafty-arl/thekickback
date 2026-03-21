"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const ORANGE = "#f97316";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey — I'm KickBack. Ask me about any hub on the platform, how it all works, or how to get started." },
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
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", color: "#fff" }}>

      {/* ═══ NAV ═══ */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Image src="/logo.png" alt="theKickBack" width={100} height={32} priority style={{ height: "auto" }} />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href="https://join.thekickback.net"
            className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-medium text-white/50 transition hover:text-white/80"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >Explore</a>
          <a href="https://dash.thekickback.net"
            className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >List Your Hub</a>
        </div>
      </nav>

      {/* ═══ HERO — compact on mobile ═══ */}
      <section className="px-4 sm:px-6 pt-8 sm:pt-14 pb-6 sm:pb-10 text-center max-w-xl mx-auto w-full">
        <h1 className="font-sans text-[24px] sm:text-[38px] font-bold leading-[1.15] tracking-tight">
          Every spot deserves<br />
          <span style={{ color: ORANGE }}>a digital front door</span>
        </h1>
        <p className="mt-3 text-[13px] sm:text-[16px] leading-relaxed text-white/40 max-w-sm mx-auto">
          Barbershops · Salons · Leagues · Cafes · Studios<br className="sm:hidden" />
          <span className="hidden sm:inline"> · Musicians · Communities · Pop-ups</span>
        </p>
      </section>

      {/* ═══ HOW IT WORKS — single row on mobile ═══ */}
      <section className="px-4 sm:px-6 pb-6 sm:pb-10 max-w-xl mx-auto w-full">
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          {[
            { icon: "📍", title: "Find", desc: "Live map with real hubs" },
            { icon: "💬", title: "Chat", desc: "AI concierge for each spot" },
            { icon: "⚡", title: "Earn", desc: "XP, tiers, and perks" },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="flex-shrink-0 w-[130px] sm:w-auto rounded-xl p-3 sm:p-4 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="text-lg sm:text-xl mb-1">{s.icon}</div>
              <p className="font-sans text-[12px] sm:text-[13px] font-semibold text-white/80">{s.title}</p>
              <p className="font-sans text-[10px] sm:text-[11px] text-white/30 mt-0.5">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ CTA buttons ═══ */}
      <section className="px-4 sm:px-6 pb-6 sm:pb-8 max-w-xl mx-auto w-full">
        <div className="flex gap-2">
          <a href="https://join.thekickback.net"
            className="flex-1 text-center rounded-full py-2.5 text-[12px] sm:text-[13px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >Find a Spot Near You</a>
          <a href="https://dash.thekickback.net"
            className="flex-1 text-center rounded-full py-2.5 text-[12px] sm:text-[13px] font-semibold transition hover:opacity-90"
            style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
          >Set Up Your Hub — Free</a>
        </div>
        <p className="text-center text-[10px] sm:text-[11px] text-white/20 mt-2">No app download · No passwords · Works on web, SMS & email</p>
      </section>

      {/* ═══ CHAT ═══ */}
      <section className="px-4 sm:px-6 pb-6 max-w-xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
          <span className="text-[10px] sm:text-[11px] text-white/20 font-medium whitespace-nowrap">Ask KickBack anything</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
        </div>

        <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          minHeight: 280,
          maxHeight: 420,
        }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2.5">
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="shrink-0 mr-1.5 mt-1.5">
                    <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </div>
                )}
                <div className="rounded-2xl px-3 sm:px-4 py-2 max-w-[85%] font-sans text-[13px] sm:text-[14px] leading-relaxed"
                  style={m.role === "user"
                    ? { backgroundColor: `${ORANGE}15`, color: "rgba(255,255,255,0.85)", borderBottomRightRadius: 4 }
                    : { backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.65)", borderBottomLeftRadius: 4 }
                  }
                >{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="shrink-0 mr-1.5 mt-1.5">
                  <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
                    animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </div>
                <div className="rounded-2xl px-3 py-2 font-sans text-[13px]"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}
                >thinking...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Redirect CTA */}
          {showRedirect && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mx-3 mb-2 rounded-xl p-3"
              style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
            >
              <p className="font-sans text-[12px] text-white/60 mb-2">Ready to jump in?</p>
              <div className="flex gap-2">
                <a href="https://join.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Explore Hubs</a>
                <a href="https://dash.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>Create Hub — Free</a>
              </div>
            </motion.div>
          )}

          {/* Quick chips */}
          {userMsgCount === 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
              {["Can AI run my studio?", "Where's the live music tonight?", "My business has no website", "I run a community group"].map((q) => (
                <button key={q} onClick={() => sendChat(q)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/8"
                  style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
                >{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..."
              className="min-w-0 flex-1 rounded-full px-3 font-sans text-[12px] sm:text-[13px] text-white placeholder:text-white/20 focus:outline-none"
              style={{ height: 36, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            />
            {input.trim() && (
              <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.9 }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{ backgroundColor: ORANGE }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            )}
          </form>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="flex justify-center gap-3 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <a href="/about" className="font-sans text-[10px] text-white/20 hover:text-white/50 transition">About</a>
        <a href="/privacy" className="font-sans text-[10px] text-white/20 hover:text-white/50 transition">Privacy</a>
      </footer>
    </div>
  );
}
