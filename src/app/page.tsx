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
    <>
      {/* ══════════════════════════════════════════════════════════════════
          MOBILE — fixed, no scroll, chat-first
          ══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed inset-0 flex flex-col" style={{ background: "#0a0a0a" }}>
        {/* Nav */}
        <nav className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Image src="/logo.png" alt="theKickBack" width={90} height={28} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-1.5">
            <a href="https://join.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-medium text-white/50" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Explore</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Hub</a>
          </div>
        </nav>

        {/* Mini hero */}
        <div className="px-4 pt-4 pb-3 shrink-0 text-center">
          <h1 className="font-sans text-[18px] font-bold leading-tight">
            Every spot deserves <span style={{ color: ORANGE }}>a front door</span>
          </h1>
          <p className="mt-1 text-[10px] text-white/25">Salons · Cafes · Leagues · Studios · Communities</p>
        </div>

        {/* Chat — fills remaining space */}
        <div className="flex-1 flex flex-col min-h-0 mx-3 mb-2 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
                <div className="rounded-2xl px-3 py-2 max-w-[85%] font-sans text-[13px] leading-relaxed"
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

          {showRedirect && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-3 mb-2 rounded-xl p-3"
              style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
            >
              <p className="font-sans text-[11px] text-white/50 mb-2">Ready to jump in?</p>
              <div className="flex gap-2">
                <a href="https://join.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Explore</a>
                <a href="https://dash.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>Create Hub</a>
              </div>
            </motion.div>
          )}

          {userMsgCount === 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {["Can AI run my studio?", "Where's the live music?", "My business has no website", "I run a community group"].map((q) => (
                <button key={q} onClick={() => sendChat(q)}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium transition hover:bg-white/8"
                  style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
                >{q}</button>
              ))}
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..."
              className="min-w-0 flex-1 rounded-full px-3 font-sans text-[12px] text-white placeholder:text-white/20 focus:outline-none"
              style={{ height: 34, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            />
            {input.trim() && (
              <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.9 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                style={{ backgroundColor: ORANGE }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </motion.button>
            )}
          </form>
        </div>

        <div className="flex justify-center gap-3 py-1.5 shrink-0">
          <a href="/about" className="text-[9px] text-white/15">About</a>
          <a href="/privacy" className="text-[9px] text-white/15">Privacy</a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP — fixed, no scroll, photo-forward
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid fixed inset-0" style={{
        background: "#0a0a0a",
        gridTemplateColumns: "1fr 400px",
        gridTemplateRows: "auto 1fr",
      }}>
        {/* Nav — spans full width */}
        <nav className="col-span-2 flex items-center justify-between px-8 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Image src="/logo.png" alt="theKickBack" width={120} height={38} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-3">
            <a href="/about" className="text-[11px] text-white/25 hover:text-white/50 transition">About</a>
            <a href="/privacy" className="text-[11px] text-white/25 hover:text-white/50 transition">Privacy</a>
            <a href="https://join.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/80 transition" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Explore Hubs</a>
            <a href="https://dash.thekickback.net" className="rounded-full px-4 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>List Your Hub — Free</a>
          </div>
        </nav>

        {/* LEFT — photo-forward with overlaid text */}
        <div className="relative overflow-hidden">
          {/* Photo grid fills the space */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
            <div className="relative col-span-2">
              <Image src="/art-storefront.png" alt="" fill className="object-cover" sizes="60vw" priority />
            </div>
            <div className="relative">
              <Image src="/art-gathering.png" alt="" fill className="object-cover" sizes="30vw" />
            </div>
            <div className="relative">
              <Image src="/art-connection.png" alt="" fill className="object-cover" sizes="30vw" />
            </div>
          </div>

          {/* Dark gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.5) 40%, rgba(10,10,10,0.85) 100%)" }} />

          {/* Content overlaid on photos */}
          <div className="relative z-10 flex flex-col justify-end h-full px-10 pb-10">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-sans text-[44px] font-bold leading-[1.08] tracking-tight max-w-lg"
            >
              Every spot deserves<br />
              <span style={{ color: ORANGE }}>a digital front door.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-4 text-[15px] leading-relaxed text-white/50 max-w-md"
            >
              If people gather there, it belongs on theKickBack. Each hub gets its own AI, storefront, and front door — no app download, no code.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-3 mt-6"
            >
              <a href="https://join.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: ORANGE, color: "#fff" }}>Find a Spot</a>
              <a href="https://dash.thekickback.net" className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition hover:opacity-90" style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}>I Run a Spot</a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-wrap gap-1.5 mt-6"
            >
              {["Barbershops", "Salons", "Cafes", "Leagues", "Studios", "Musicians", "Communities", "Coworking"].map((c) => (
                <span key={c} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
                >{c}</span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* RIGHT — Chat panel */}
        <div className="flex flex-col min-h-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.05)", background: "rgba(5,5,7,0.95)" }}>
          <div className="px-4 py-3 shrink-0 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <motion.div className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }}
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="font-sans text-[11px] text-white/35 font-medium">KickBack Concierge</span>
          </div>

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
                <div className="rounded-2xl px-3 py-2 max-w-[90%] font-sans text-[13px] leading-relaxed"
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

          {showRedirect && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-3 mb-2 rounded-xl p-3"
              style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
            >
              <p className="font-sans text-[11px] text-white/50 mb-2">Ready to jump in?</p>
              <div className="flex gap-2">
                <a href="https://join.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ backgroundColor: ORANGE, color: "#fff" }}>Explore</a>
                <a href="https://dash.thekickback.net" className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>Create Hub</a>
              </div>
            </motion.div>
          )}

          {userMsgCount === 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {["Can AI run my studio?", "Where's the live music?", "My business has no website", "I run a community group"].map((q) => (
                <button key={q} onClick={() => sendChat(q)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/8"
                  style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
                >{q}</button>
              ))}
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..."
              className="min-w-0 flex-1 rounded-full px-3 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none"
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
      </div>
    </>
  );
}
