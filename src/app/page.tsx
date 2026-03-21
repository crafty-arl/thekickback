"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const ORANGE = "#f97316";

type Msg = { role: "user" | "assistant"; content: string };

/* Framer Motion presets for high-end feel */
const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.12 } } };

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), messageCount: userMsgCount + 1 }),
      });
      const data = await res.json();
      setChatMsgs((p) => [...p, { role: "assistant", content: data.reply || "I'm here to help." }]);
    } catch {
      setChatMsgs((p) => [...p, { role: "assistant", content: "Connection lost. Try again." }]);
    } finally { setLoading(false); }
  }

  function sendMessage(e?: FormEvent) { e?.preventDefault(); sendChat(input); }

  const showRedirect = userMsgCount >= 5;

  /* ──────────── CHAT MESSAGES (shared) ──────────── */
  const chatMessages = (
    <>
      {chatMsgs.map((m, i) => (
        <AnimatePresence key={i}>
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="shrink-0 mr-1.5 mt-1.5">
                <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            )}
            <div className="rounded-2xl px-3 py-2 max-w-[85%] text-[13px] sm:text-[14px] leading-relaxed"
              style={m.role === "user"
                ? { backgroundColor: `${ORANGE}18`, color: "rgba(255,255,255,0.9)", borderBottomRightRadius: 4 }
                : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.78)", borderBottomLeftRadius: 4 }
              }
            >{m.content}</div>
          </motion.div>
        </AnimatePresence>
      ))}
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="shrink-0 mr-1.5 mt-1.5">
            <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
              animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
            />
          </div>
          <div className="rounded-2xl px-3 py-2 text-[13px]"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
          >thinking...</div>
        </motion.div>
      )}
      <div ref={chatEndRef} />
    </>
  );

  /* ──────────── REDIRECT CTA (shared) ──────────── */
  const redirectCta = showRedirect && (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 20 }}
      className="mx-3 mb-2 rounded-xl p-3"
      style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.14)" }}
    >
      <p className="text-[12px] text-white/70 mb-2">Ready to jump in?</p>
      <div className="flex gap-2">
        <a href="https://join.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Explore</a>
        <a href="https://dash.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }}>Create Hub</a>
      </div>
    </motion.div>
  );

  /* ──────────── QUICK CHIPS (shared) ──────────── */
  const quickChips = userMsgCount === 0 && (
    <motion.div {...stagger} className="flex flex-wrap gap-1.5 px-3 pb-2">
      {["Can AI run my studio?", "Where's the live music?", "My business has no website", "I run a community group"].map((q, i) => (
        <motion.button key={q} {...fadeUp} transition={{ delay: 0.05 * i, duration: 0.3 }}
          onClick={() => sendChat(q)}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
        >{q}</motion.button>
      ))}
    </motion.div>
  );

  /* ──────────── INPUT BAR (shared) ──────────── */
  const inputBar = (
    <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..."
        className="min-w-0 flex-1 rounded-full px-3 text-[13px] text-white placeholder:text-white/40 focus:outline-none"
        style={{ height: 36, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        aria-label="Chat message"
      />
      {input.trim() && (
        <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.05 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
          style={{ backgroundColor: ORANGE }}
          aria-label="Send message"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
          </svg>
        </motion.button>
      )}
    </form>
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          MOBILE — fixed, no scroll, chat-first
          ══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed inset-0 flex flex-col" style={{ background: "#0a0a0a" }}>
        <nav className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Image src="/logo.png" alt="theKickBack" width={90} height={28} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-1.5">
            <a href="https://join.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Explore</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Hub</a>
          </div>
        </nav>

        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="px-4 pt-4 pb-3 shrink-0 text-center">
          <h1 className="text-[18px] font-bold leading-tight">
            Every spot deserves <span style={{ color: ORANGE }}>a front door</span>
          </h1>
          <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>Salons · Cafes · Leagues · Studios · Communities</p>
        </motion.div>

        <div className="flex-1 flex flex-col min-h-0 mx-3 mb-2 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">{chatMessages}</div>
          {redirectCta}
          {quickChips}
          {inputBar}
        </div>

        <div className="flex justify-center gap-3 py-1.5 shrink-0">
          <a href="/about" className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>About</a>
          <a href="/privacy" className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP — fixed, no scroll, photo-forward with elevated motion
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid fixed inset-0" style={{
        background: "#0a0a0a",
        gridTemplateColumns: "1fr 400px",
        gridTemplateRows: "auto 1fr",
      }}>
        {/* Nav */}
        <nav className="col-span-2 flex items-center justify-between px-8 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Image src="/logo.png" alt="theKickBack" width={120} height={38} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-3">
            <a href="/about" className="text-[11px] transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>About</a>
            <a href="/privacy" className="text-[11px] transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>Privacy</a>
            <a href="https://join.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-medium transition hover:bg-white/10" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Explore Hubs</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Your Hub — Free</a>
          </div>
        </nav>

        {/* LEFT — Photo grid with overlaid content */}
        <div className="relative overflow-hidden">
          {/* Photo mosaic — 3 inclusive editorial images */}
          <div className="absolute inset-0 grid grid-rows-2 grid-cols-3 gap-[2px]">
            {/* Top — cafe scene (wide) */}
            <motion.div className="relative col-span-2" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}>
              <Image src="/art-cafe.png" alt="Diverse cafe community" fill className="object-cover" sizes="40vw" priority />
            </motion.div>
            {/* Top right — salon */}
            <motion.div className="relative" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}>
              <Image src="/art-salon.png" alt="Modern salon experience" fill className="object-cover" sizes="20vw" />
            </motion.div>
            {/* Bottom left — league */}
            <motion.div className="relative" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}>
              <Image src="/art-league.png" alt="Community recreation league" fill className="object-cover" sizes="20vw" />
            </motion.div>
            {/* Bottom center — gathering */}
            <motion.div className="relative" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}>
              <Image src="/art-gathering.png" alt="Community gathering" fill className="object-cover" sizes="20vw" />
            </motion.div>
            {/* Bottom right — storefront */}
            <motion.div className="relative" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}>
              <Image src="/art-storefront.png" alt="Neighborhood storefront" fill className="object-cover" sizes="20vw" />
            </motion.div>
          </div>

          {/* Gradient overlay — bottom-heavy so photos show through top */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.35) 40%, rgba(10,10,10,0.88) 100%)"
          }} />

          {/* Hero text over photos */}
          <div className="relative z-10 flex flex-col justify-end h-full px-10 pb-10">
            <motion.h1 {...fadeUp} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-[46px] font-bold leading-[1.06] tracking-tight max-w-lg"
            >
              Every spot deserves<br />
              <span style={{ color: ORANGE }}>a digital front door.</span>
            </motion.h1>

            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-4 text-[15px] leading-relaxed max-w-md"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              If people gather there, it belongs on theKickBack. Each hub gets its own AI, storefront, and community — no app, no code, five minutes.
            </motion.p>

            <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.24 }} className="flex items-center gap-3 mt-6">
              <a href="https://join.thekickback.net"
                className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all hover:brightness-110 hover:shadow-lg"
                style={{ backgroundColor: ORANGE, color: "#fff", boxShadow: `0 4px 20px ${ORANGE}30` }}
              >Find a Spot</a>
              <a href="https://dash.thekickback.net"
                className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all hover:bg-white/12"
                style={{ color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}
              >I Run a Spot</a>
            </motion.div>

            <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.36 }} className="flex flex-wrap gap-1.5 mt-6">
              {["Barbershops", "Salons", "Cafes", "Leagues", "Studios", "Musicians", "Communities", "Coworking"].map((c) => (
                <span key={c} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                >{c}</span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* RIGHT — Chat */}
        <div className="flex flex-col min-h-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,7,0.97)" }}>
          <div className="px-4 py-3 shrink-0 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>KickBack Concierge</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">{chatMessages}</div>
          {redirectCta}
          {quickChips}
          {inputBar}
        </div>
      </div>
    </>
  );
}
