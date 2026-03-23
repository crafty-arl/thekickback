"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MapBackdrop } from "@/components/map-backdrop";
import { KBWordmark, KBMark } from "@/components/kb-logo";

const O = "#f97316";

type Msg = { role: "user" | "assistant"; content: string };

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function Home() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey — I'm KickBack. Ask me about any place, how things work, or how to get started." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const uCount = msgs.filter(m => m.role === "user").length;

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMsgs(p => [...p, { role: "user", content: text.trim() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), messageCount: uCount + 1 }),
      });
      const d = await res.json();
      setMsgs(p => [...p, { role: "assistant", content: d.reply || "I'm here to help." }]);
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Connection lost. Try again." }]);
    } finally { setLoading(false); }
  }

  function onSubmit(e?: FormEvent) { e?.preventDefault(); send(input); }

  const showCta = uCount >= 5;

  /* ───── chat bubble styles (subdued — no competing colors) ───── */
  const userBubble = { backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.88)", borderBottomRightRadius: 4 };
  const aiBubble = { backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.72)", borderBottomLeftRadius: 4 };

  /* ───── CHAT PANEL ───── */
  const chatPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {msgs.map((m, i) => (
          <AnimatePresence key={i}>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="shrink-0 mr-1.5 mt-1.5">
                  <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: O }}
                    animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
              <div className="rounded-2xl px-3.5 py-2 max-w-[85%] text-[13px] sm:text-[14px] leading-relaxed"
                style={m.role === "user" ? userBubble : aiBubble}
              >{m.content}</div>
            </motion.div>
          </AnimatePresence>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="shrink-0 mr-1.5 mt-1.5">
              <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: O }}
                animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
              />
            </div>
            <div className="rounded-2xl px-3.5 py-2 text-[13px]"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}
            >thinking...</div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {showCta && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-3 mb-2 rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-[12px] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Ready to jump in?</p>
          <div className="flex gap-2">
            <a href="https://join.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ backgroundColor: O, color: "#fff" }}>Explore</a>
            <a href="https://dash.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Add Place</a>
          </div>
        </motion.div>
      )}

      {uCount === 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {["Can AI run my studio?", "Where's the live music?", "My business has no website", "I run a community group"].map((q) => (
            <button key={q} onClick={() => send(q)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/8"
              style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}
            >{q}</button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask anything..."
          className="min-w-0 flex-1 rounded-full px-3 text-[13px] text-white placeholder:text-white/35 focus:outline-none"
          style={{ height: 36, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          aria-label="Chat message"
        />
        {input.trim() && (
          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.88 }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
            style={{ backgroundColor: O }} aria-label="Send message"
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
      {/* ═══ MOBILE ═══ */}
      <div className="lg:hidden fixed inset-0 flex flex-col" style={{ background: "#0a0a0a" }}>
        <nav className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <KBMark size={28} />
          <div className="flex items-center gap-1.5">
            <a href="https://join.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.1)" }}>Explore</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: O, color: "#fff" }}>Add Place</a>
          </div>
        </nav>

        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="px-4 pt-4 pb-3 shrink-0 text-center">
          <h1 className="text-[18px] font-bold leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>
            Every spot deserves <span style={{ color: O }}>to be found</span>
          </h1>
          <p className="mt-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Salons · Cafes · Leagues · Studios · Communities</p>
        </motion.div>

        <div className="flex-1 flex flex-col min-h-0 mx-3 mb-2 rounded-2xl overflow-hidden"
          style={{ background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {chatPanel}
        </div>

        <div className="flex justify-center gap-3 py-1.5 shrink-0">
          <Link href="/membership" className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Membership</Link>
          <Link href="/about" className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>About</Link>
          <Link href="/privacy" className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</Link>
        </div>
      </div>

      {/* ═══ DESKTOP ═══ */}
      <div className="hidden lg:grid fixed inset-0" style={{
        background: "#0a0a0a",
        gridTemplateColumns: "1fr 400px",
        gridTemplateRows: "auto 1fr",
      }}>
        {/* Nav */}
        <nav className="col-span-2 flex items-center justify-between px-8 py-3 relative z-20" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,10,0.8)", backdropFilter: "blur(12px)" }}>
          <KBWordmark height={32} />
          <div className="flex items-center gap-3">
            <Link href="/membership" className="text-[11px] transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>Membership</Link>
            <Link href="/about" className="text-[11px] transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>About</Link>
            <Link href="/privacy" className="text-[11px] transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>Privacy</Link>
            <a href="https://join.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-medium transition hover:bg-white/8" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Explore Places</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: O, color: "#fff" }}>Add Your Place — Free</a>
          </div>
        </nav>

        {/* LEFT — Map with overlaid hero */}
        <div className="relative overflow-hidden">
          {/* Map background */}
          <div className="absolute inset-0">
            <MapBackdrop />
          </div>

          {/* Subtle gradient — lets map show through, text sits at bottom */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.4) 50%, rgba(10,10,10,0.92) 100%)"
          }} />

          {/* Hero content */}
          <div className="relative z-10 flex flex-col justify-end h-full px-10 pb-10">
            <motion.h1 {...fadeUp} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-[44px] font-bold leading-[1.06] tracking-tight max-w-lg"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              Every spot deserves<br />
              <span style={{ color: O }}>to be found.</span>
            </motion.h1>

            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-4 text-[15px] leading-relaxed max-w-md"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Every place gets its own AI helper, a page to show what you offer, and a community — no app to download, ready in five minutes.
            </motion.p>

            <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }} className="flex items-center gap-3 mt-6">
              <a href="https://join.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: O, color: "#fff" }}>Find a Spot</a>
              <a href="https://dash.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition hover:bg-white/8" style={{ color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}>I Run a Spot</a>
            </motion.div>

            <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.3 }} className="flex flex-wrap gap-1.5 mt-6">
              {["Barbershops", "Salons", "Cafes", "Leagues", "Studios", "Musicians", "Communities", "Coworking"].map((c) => (
                <span key={c} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                >{c}</span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* RIGHT — Chat */}
        <div className="flex flex-col min-h-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,10,0.97)" }}>
          <div className="px-4 py-3 shrink-0 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: O }}
              animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>KickBack Concierge</span>
          </div>
          {chatPanel}
        </div>
      </div>
    </>
  );
}
