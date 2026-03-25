"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const O = "#f97316";
const ACCENT = "#a78bfa";

const STEPS = [
  {
    title: "Open the map",
    desc: "Places near you appear as pins — cafes, barbershops, studios, leagues, communities. If people go there, it's on the map.",
    phone: (
      <div className="h-full flex flex-col" style={{ background: "#111" }}>
        {/* Fake map */}
        <div className="flex-1 relative" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
          {/* Pins */}
          {[
            { x: "30%", y: "35%", color: "#4ade80", label: "Anodyne Coffee" },
            { x: "55%", y: "25%", color: "#f97316", label: "Company Brewing" },
            { x: "70%", y: "55%", color: "#a78bfa", label: "The Outsider" },
            { x: "40%", y: "60%", color: "#f97316", label: "Fresh Cuts" },
            { x: "60%", y: "75%", color: "#facc15", label: "Deer District" },
          ].map((pin, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 300 }}
              className="absolute flex flex-col items-center"
              style={{ left: pin.x, top: pin.y }}
            >
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: pin.color, boxShadow: `0 0 8px ${pin.color}60` }} />
              <span className="mt-0.5 font-sans text-[7px] font-medium text-white/60 whitespace-nowrap">{pin.label}</span>
            </motion.div>
          ))}
          {/* User dot */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ delay: 1, duration: 2, repeat: Infinity }}
            className="absolute rounded-full"
            style={{ left: "48%", top: "48%", width: 8, height: 8, backgroundColor: "#3b82f6", border: "2px solid white" }}
          />
        </div>
        {/* Dock */}
        <div className="shrink-0 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(12,12,14,0.95)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="h-6 w-6 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <span className="font-sans text-[10px] text-white/30">What's happening nearby?</span>
        </div>
      </div>
    ),
  },
  {
    title: "Tap a place, start chatting",
    desc: "Every place has an AI that knows the menu, hours, and vibe. Ask anything — it responds like the owner would.",
    phone: (
      <div className="h-full flex flex-col" style={{ background: "#0D0D0F" }}>
        {/* Header */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${O}30, ${O}10)`, border: `1.5px solid ${O}40` }}>
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-[8px] font-bold" style={{ color: O }}>A</span>
            </div>
          </div>
          <div>
            <span className="font-sans text-[10px] font-semibold text-white/90">Anodyne Coffee</span>
            <div className="flex items-center gap-1">
              <div className="h-1 w-1 rounded-full" style={{ backgroundColor: "#4ade80" }} />
              <span className="font-sans text-[7px] text-white/30">quiet</span>
            </div>
          </div>
        </div>
        {/* Chat */}
        <div className="flex-1 px-3 py-2 flex flex-col gap-1.5 overflow-hidden">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="self-start max-w-[80%] px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <p className="font-sans text-[9px] text-white/70 leading-relaxed">Hey — welcome to Anodyne. We're a craft coffee shop in Walker's Point. Ask me anything.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
            className="self-end max-w-[75%] px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: O }}>
            <p className="font-sans text-[9px] text-black leading-relaxed">What's your best latte?</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
            className="self-start max-w-[85%] px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <p className="font-sans text-[9px] text-white/70 leading-relaxed">The house oat milk latte is what most people come for. $5.50. Want me to add it to your cart?</p>
          </motion.div>
        </div>
        {/* Input */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 h-7 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="h-7 w-7 rounded-full" style={{ backgroundColor: O }} />
        </div>
      </div>
    ),
  },
  {
    title: "Browse the shop",
    desc: "Switch to Shop to see everything a place offers — products, services, events, memberships. Tap to add to cart or book a time.",
    phone: (
      <div className="h-full flex flex-col" style={{ background: "#0D0D0F" }}>
        {/* Toggle */}
        <div className="flex mx-3 mt-2 mb-1">
          <div className="flex-1 py-1 text-center font-sans text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.25)", borderBottom: "2px solid transparent" }}>Chat</div>
          <div className="flex-1 py-1 text-center font-sans text-[9px] font-semibold" style={{ color: O, borderBottom: `2px solid ${O}` }}>Shop</div>
        </div>
        {/* Items */}
        <div className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-hidden">
          <span className="font-sans text-[7px] font-semibold tracking-wider text-white/20 mb-1">DRINKS</span>
          {[
            { name: "House Latte", price: "$5.50", icon: "☕" },
            { name: "Cold Brew", price: "$4.00", icon: "☕" },
            { name: "Cortado", price: "$4.50", icon: "☕" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="h-7 w-7 flex items-center justify-center rounded" style={{ backgroundColor: `${O}08`, border: `1px solid ${O}12` }}>
                <span className="text-[10px]">{item.icon}</span>
              </div>
              <span className="flex-1 font-sans text-[9px] font-semibold text-white/80">{item.name}</span>
              <span className="font-mono text-[9px] font-bold" style={{ color: O }}>{item.price}</span>
              <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${O}20` }}>
                <span className="text-[10px] font-bold" style={{ color: O }}>+</span>
              </div>
            </motion.div>
          ))}
          <span className="font-sans text-[7px] font-semibold tracking-wider text-white/20 mt-2 mb-1">MEMBERSHIP</span>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="px-2.5 py-2 rounded" style={{ background: `linear-gradient(180deg, ${O}10, ${O}04)`, border: `1px solid ${O}20` }}>
            <div className="flex items-center gap-1">
              <span className="text-[10px]">👑</span>
              <span className="font-sans text-[9px] font-bold text-white">Regular</span>
              <span className="ml-auto font-mono text-[9px] font-bold" style={{ color: O }}>$25/mo</span>
            </div>
          </motion.div>
        </div>
      </div>
    ),
  },
  {
    title: "Pay with KB Wallet",
    desc: "Load funds once, pay anywhere. The AI handles checkout — no card fumbling, no forms. Just say 'I'll take it.'",
    phone: (
      <div className="h-full flex flex-col items-center justify-center px-4" style={{ background: "#0D0D0F" }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-center">
          <p className="font-mono text-[28px] font-bold text-white">$47.50</p>
          <p className="font-sans text-[9px] text-white/30 mt-1">KB Wallet Balance</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-4 w-full px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <span className="font-sans text-[9px] text-white/60">House Latte</span>
            <span className="font-mono text-[9px] text-white/40">-$5.50</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="font-sans text-[9px] text-white/60">Anodyne Coffee</span>
            <span className="font-sans text-[7px] text-green-400">+10 XP</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="mt-3 w-full py-2 rounded-full text-center font-sans text-[10px] font-bold text-black" style={{ backgroundColor: O }}>
          Confirmed
        </motion.div>
      </div>
    ),
  },
  {
    title: "Earn XP & unlock perks",
    desc: "Every visit, order, and referral earns points. Level up at your favorite spots to unlock free stuff and priority access.",
    phone: (
      <div className="h-full flex flex-col px-4 py-4" style={{ background: "#0D0D0F" }}>
        {/* Score */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center mb-4">
          <span className="font-sans text-[8px] font-bold tracking-wider" style={{ color: "#4ade80", backgroundColor: "rgba(74,222,128,0.15)", padding: "2px 8px", borderRadius: 50 }}>REGULAR</span>
          <p className="font-mono text-[20px] font-bold mt-1" style={{ color: "#4ade80" }}>340 XP</p>
        </motion.div>
        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-sans text-[7px] text-white/30">Regular</span>
            <span className="font-sans text-[7px] text-white/20">Member — 500 XP</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ delay: 0.5, duration: 0.8 }} className="h-full rounded-full" style={{ backgroundColor: "#4ade80" }} />
          </div>
        </div>
        {/* Perks */}
        <span className="font-sans text-[7px] font-semibold tracking-wider text-white/20 mb-1.5">UNLOCKED PERKS</span>
        {[
          { name: "Free lineup", cost: "200 pts", icon: "✂️" },
          { name: "Skip the wait", cost: "300 pts", icon: "⚡" },
        ].map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.15 }}
            className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-[10px]">{p.icon}</span>
            <span className="flex-1 font-sans text-[9px] text-white/70">{p.name}</span>
            <span className="font-mono text-[8px]" style={{ color: O }}>{p.cost}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: "It remembers you",
    desc: "The more you chat, the smarter it gets. Your favorite orders, vibes, and places — remembered across every spot you visit.",
    phone: (
      <div className="h-full flex flex-col px-4 py-4" style={{ background: "#0D0D0F" }}>
        <span className="font-sans text-[8px] font-semibold tracking-wider text-white/20 mb-2">YOUR MEMORY</span>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="font-sans text-[8px] leading-relaxed text-white/40 space-y-1.5">
            <p className="font-semibold text-white/50">## Preferences</p>
            <p>- Drinks: oat milk lattes, cold brew in summer</p>
            <p>- Vibe: quiet spots for working, lively for weekends</p>
            <p>- Diet: vegetarian, likes spicy food</p>
            <p className="font-semibold text-white/50 mt-2">## Places</p>
            <p>- Regular at Anodyne Coffee (cortado with oat milk)</p>
            <p>- Wants to try Company Brewing</p>
            <p className="font-semibold text-white/50 mt-2">## Notes</p>
            <p>- Birthday in March, prefers window seats</p>
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="mt-3 font-sans text-[8px] text-white/20 text-center">
          Built automatically from your conversations
        </motion.p>
      </div>
    ),
  },
];

export function AppTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => {
      if (isLast) { setAutoPlay(false); return; }
      setStep((s) => s + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [step, autoPlay, isLast]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100]"
        style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="fixed inset-4 z-[105] flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10"
      >
        {/* Phone frame */}
        <div className="relative shrink-0" style={{ width: 240, height: 480 }}>
          <div className="absolute inset-0 rounded-[28px] overflow-hidden" style={{ border: "2px solid rgba(255,255,255,0.1)", backgroundColor: "#000" }}>
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 z-10 flex justify-center">
              <div className="h-5 w-24 rounded-b-2xl" style={{ backgroundColor: "#000" }} />
            </div>
            {/* Screen */}
            <div className="absolute inset-[2px] rounded-[26px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  {current.phone}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Text + controls */}
        <div className="max-w-sm text-center lg:text-left">
          {/* Step dots */}
          <div className="flex gap-1.5 justify-center lg:justify-start mb-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setStep(i); setAutoPlay(false); }}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 24 : 8,
                  backgroundColor: i === step ? O : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="font-sans text-[22px] font-bold text-white mb-2">{current.title}</h3>
              <p className="font-sans text-[14px] leading-relaxed text-white/50">{current.desc}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-3 mt-6 justify-center lg:justify-start">
            {step > 0 && (
              <button
                onClick={() => { setStep(step - 1); setAutoPlay(false); }}
                className="rounded-full px-5 py-2.5 font-sans text-[13px] font-medium text-white/50"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) onClose();
                else { setStep(step + 1); setAutoPlay(false); }
              }}
              className="rounded-full px-5 py-2.5 font-sans text-[13px] font-bold text-black"
              style={{ backgroundColor: O }}
            >
              {isLast ? "Try it free" : "Next"}
            </button>
          </div>

          <button onClick={onClose} className="mt-4 font-sans text-[11px] text-white/25 transition hover:text-white/40">
            Skip tutorial
          </button>
        </div>
      </motion.div>
    </>
  );
}
