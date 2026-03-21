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

  /* ──────────────── CHAT PANEL (shared mobile + desktop) ──────────────── */
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
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
            <div className="rounded-2xl px-3 py-2 max-w-[85%] font-sans text-[13px] sm:text-[14px] leading-relaxed"
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
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
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
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          MOBILE — Chat-first full-screen experience
          ══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed inset-0 flex flex-col" style={{ background: "#0a0a0a" }}>
        {/* Mobile nav */}
        <nav className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Image src="/logo.png" alt="theKickBack" width={90} height={28} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-1.5">
            <a href="https://join.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-medium text-white/50" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Explore</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Hub</a>
          </div>
        </nav>

        {/* Mobile hero — minimal */}
        <div className="px-4 pt-5 pb-4 text-center">
          <h1 className="font-sans text-[20px] font-bold leading-tight tracking-tight">
            Every spot deserves <span style={{ color: ORANGE }}>a front door</span>
          </h1>
          <p className="mt-1.5 text-[11px] text-white/30">Barbershops · Salons · Cafes · Leagues · Studios · Communities</p>
        </div>

        {/* Mobile chat */}
        <div className="flex-1 flex flex-col min-h-0 mx-3 mb-2 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {chatPanel}
        </div>

        {/* Mobile footer */}
        <div className="flex justify-center gap-3 py-2">
          <a href="/about" className="text-[9px] text-white/15">About</a>
          <a href="/privacy" className="text-[9px] text-white/15">Privacy</a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP — Full-screen two-column layout
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex fixed inset-0 flex-col" style={{ background: "#0a0a0a" }}>
        {/* Desktop nav */}
        <nav className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Image src="/logo.png" alt="theKickBack" width={130} height={40} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-3">
            <a href="/about" className="text-[12px] text-white/30 hover:text-white/60 transition">About</a>
            <a href="/privacy" className="text-[12px] text-white/30 hover:text-white/60 transition">Privacy</a>
            <a href="https://join.thekickback.net" className="rounded-full px-4 py-1.5 text-[12px] font-medium text-white/60 hover:text-white/90 transition" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Explore Hubs</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 text-[12px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Your Hub — Free</a>
          </div>
        </nav>

        {/* Desktop content — two columns */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — hero + content */}
          <div className="flex-1 overflow-y-auto px-12 py-10">
            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="font-sans text-[48px] font-bold leading-[1.1] tracking-tight max-w-xl">
                Every spot deserves<br />
                <span style={{ color: ORANGE }}>a digital front door.</span>
              </h1>
              <p className="mt-5 text-[17px] leading-relaxed text-white/40 max-w-md">
                If people gather there, it belongs on theKickBack. Barbershops, salons, cafes, leagues, studios, communities — powered by AI.
              </p>
              <div className="flex gap-3 mt-8">
                <a href="https://join.thekickback.net" className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90" style={{ backgroundColor: ORANGE, color: "#fff" }}>Find a Spot Near You</a>
                <a href="https://dash.thekickback.net" className="rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>I Run a Spot</a>
              </div>
            </motion.div>

            {/* How it works — icon row */}
            <div className="mt-16 flex gap-8">
              {[
                { title: "Find", desc: "Live map with real hubs. See what's near you, color-coded by vibe.", img: "/icons-steps.png", crop: "0 0 33% 100%" },
                { title: "Chat", desc: "Each hub has its own AI. Ask about hours, book, browse, or buy.", img: "/icons-steps.png", crop: "33% 0 33% 100%" },
                { title: "Earn", desc: "XP, tiers, perks. Your hub recognizes you as a regular.", img: "/icons-steps.png", crop: "66% 0 34% 100%" },
              ].map((s, i) => (
                <motion.div key={s.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 * i }}
                  className="flex-1"
                >
                  <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-xl" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)" }}>
                    {s.title === "Find" ? "📍" : s.title === "Chat" ? "💬" : "⚡"}
                  </div>
                  <h3 className="font-sans text-[15px] font-semibold text-white/90 mb-1">{s.title}</h3>
                  <p className="font-sans text-[13px] text-white/35 leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Stock photo grid */}
            <div className="mt-14 grid grid-cols-3 gap-3">
              {[
                { src: "/hero-cafe.png", alt: "Lively neighborhood cafe" },
                { src: "/hero-studio.png", alt: "Creative studio community" },
                { src: "/hero-community.png", alt: "Night market gathering" },
              ].map((img) => (
                <motion.div key={img.src} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden"
                >
                  <Image src={img.src} alt={img.alt} fill className="object-cover" sizes="33vw" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.6) 100%)" }} />
                </motion.div>
              ))}
            </div>

            {/* Hub categories */}
            <div className="mt-10 mb-10">
              <p className="text-[11px] text-white/20 uppercase tracking-widest mb-3">Who&apos;s on the platform</p>
              <div className="flex flex-wrap gap-2">
                {["Barbershops", "Nail Salons", "Cafes", "Leagues", "Studios", "Musicians", "Artists", "Coworking", "Restaurants", "Communities", "Pop-ups", "Bars"].map((c) => (
                  <span key={c} className="rounded-full px-3 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: "rgba(249,115,22,0.06)", color: "rgba(249,115,22,0.6)", border: "1px solid rgba(249,115,22,0.1)" }}
                  >{c}</span>
                ))}
              </div>
            </div>

            <p className="text-[12px] text-white/15 mb-8">No app download · No passwords · Free to start · Works on web, SMS & email</p>
          </div>

          {/* RIGHT — Chat panel (fixed height) */}
          <div className="w-[420px] shrink-0 flex flex-col border-l" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <motion.div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORANGE }}
                animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="font-sans text-[12px] text-white/40 font-medium">KickBack Concierge</span>
            </div>
            {chatPanel}
          </div>
        </div>
      </div>
    </>
  );
}
