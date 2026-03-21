"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HubPreview } from "@/components/hub-preview";
import { HubPreviewEditable } from "@/components/hub-preview-editable";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { StripeConnect } from "@/components/dashboard/stripe-connect";
import type { HubData } from "@/components/hub-preview";
import type { ChecklistState } from "@/components/onboarding-checklist";
import { submitHubForReview, getOnboardingState } from "./actions";
import { updateVenue, updateVenuePage } from "@/app/settings/actions";
import { uploadGalleryImage } from "@/app/edit/gallery-actions";

// ─── Types ──────────────────────────────────────────────────────────

interface OnboardingMessage {
  id: string;
  sender: "user" | "agent";
  body: string;
  timestamp: number;
  component?: "stripe"; // renders StripeConnect inline
}

type Phase = "chat" | "checklist" | "submitted";

// ─── Data extraction helpers ────────────────────────────────────────

const KNOWN_TYPES = ["bar", "restaurant", "lounge", "club", "cafe", "coworking", "barbershop", "nail salon"];

function extractHubDataFromMessages(messages: OnboardingMessage[]): Partial<HubData> {
  const allUserText = messages.filter((m) => m.sender === "user").map((m) => m.body).join(" ");
  const updates: Partial<HubData> = {};
  for (const t of KNOWN_TYPES) {
    if (allUserText.toLowerCase().includes(t)) { updates.type = t; break; }
  }
  const calledMatch = allUserText.match(/(?:called|named|it's|its)\s+["']?([A-Z][A-Za-z0-9' &-]{1,30})["']?/i);
  if (calledMatch) updates.name = calledMatch[1].trim();
  return updates;
}

function mergePartialData(current: HubData, partial: Record<string, unknown>): HubData {
  return {
    name: (partial.name as string) || current.name,
    type: (partial.type as string) || current.type,
    address: (partial.address as string) || current.address,
    tagline: (partial.tagline as string) || current.tagline,
    description: (partial.description as string) || current.description,
    themeColor: (partial.themeColor as string) || current.themeColor,
    hours: (partial.hours as string) || current.hours,
    capacity: (partial.maxOccupancy as number) || (partial.capacity as number) || current.capacity,
    slug: (partial.slug as string) || current.slug,
  };
}

const DEFAULT_REPLIES = [
  "It\u2019s a cocktail bar called The Rooftop on 6th St in Austin",
  "Coffee shop in Brooklyn, we\u2019re called Drip",
  "Barbershop in Houston called Fresh Cuts",
  "It\u2019s a coworking space",
];

const WELCOME_MESSAGE = "Welcome to theKickBack. Let\u2019s get your hub set up \u2014 tell me about your spot. What\u2019s it called, what kind of place is it, and where is it?";

const DEFAULT_CHECKLIST: ChecklistState = {
  basics: false, location: false, hours: false, branding: false,
  offerings: false, knowledge: false, photos: false, xp: false, stripe: false,
};

// ─── Main Page Component ───────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<OnboardingMessage[]>([
    { id: "welcome", sender: "agent", body: WELCOME_MESSAGE, timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [venueCreated, setVenueCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>(DEFAULT_REPLIES);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(DEFAULT_CHECKLIST);
  const [currentItem, setCurrentItem] = useState<keyof ChecklistState | null>(null);
  const [offerings, setOfferings] = useState<{ id: string; name: string; type: string; price_cents: number; description?: string }[]>([]);
  const [galleryImages, setGalleryImages] = useState<{ id: string; image_url: string }[]>([]);
  const [resumeLoading, setResumeLoading] = useState(true);

  const [hubData, setHubData] = useState<HubData>({
    name: "", type: "", address: "", tagline: "", description: "",
    themeColor: "#F97316", hours: "", capacity: 100, slug: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  // ─── Scroll helper ──────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
  }, []);

  // ─── Virtual keyboard handler ─────────────────────────────────

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => scrollToBottom();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollToBottom]);

  // ─── Resume from saved state ──────────────────────────────────

  useEffect(() => {
    async function checkResume() {
      try {
        const state = await getOnboardingState();
        if (state && state.hasVenue && state.venueId) {
          setVenueId(state.venueId);
          setVenueCreated(true);

          // Populate hub data
          const v = state.venue;
          const p = state.page;
          if (v && p) {
            const hoursStr = Array.isArray(p.hours) && p.hours.length > 0
              ? p.hours.map((h: { day: string; open: string; close: string }) => `${h.day}: ${h.open}${h.close ? `-${h.close}` : ""}`).join(", ")
              : "";
            setHubData({
              name: v.name || "", type: v.type || "", address: v.address || "",
              tagline: p.tagline || "", description: p.description || "",
              themeColor: p.theme_color || "#F97316", hours: hoursStr,
              capacity: v.max_occupancy || 100, slug: p.slug || "",
            });
          }

          // Populate checklist
          if (state.checklist) setChecklist(state.checklist as ChecklistState);
          if (state.offerings) setOfferings(state.offerings);
          if (state.gallery) setGalleryImages(state.gallery);

          if (state.reviewStatus === "pending" || state.reviewStatus === "approved") {
            setPhase("submitted");
            setSubmitted(true);
          } else {
            // Go to checklist phase
            setPhase("checklist");
            // Find first incomplete item
            const cl = (state.checklist as ChecklistState) || DEFAULT_CHECKLIST;
            const firstIncomplete = (Object.keys(cl) as (keyof ChecklistState)[]).find((k) => !cl[k]);
            setCurrentItem(firstIncomplete || null);

            // Set welcome message for checklist phase
            const completed = Object.values(cl).filter(Boolean).length;
            setMessages([{
              id: "checklist-welcome",
              sender: "agent",
              body: `Welcome back! Your hub is ${Math.round((completed / 9) * 100)}% set up. Let\u2019s finish getting ${v?.name || "your hub"} ready. ${firstIncomplete ? getItemPrompt(firstIncomplete) : "Looking good!"}`,
              timestamp: Date.now(),
            }]);
            setSmartReplies([]);
          }
        }
      } catch {
        // No saved state — start fresh
      } finally {
        setResumeLoading(false);
      }
    }
    checkResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Submit for review ────────────────────────────────────────

  const handleSubmitForReview = useCallback(async () => {
    setSubmitting(true);
    const result = await submitHubForReview();
    if (result?.ok) {
      setSubmitted(true);
      setPhase("submitted");
    } else {
      router.push("/");
    }
    setSubmitting(false);
  }, [router]);

  // ─── Update checklist item ────────────────────────────────────

  const markChecklistItem = useCallback(async (item: keyof ChecklistState, completed: boolean) => {
    setChecklist((prev) => ({ ...prev, [item]: completed }));
    // Persist to API
    try {
      await fetch("/api/onboarding/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, completed }),
      });
    } catch { /* best effort */ }
  }, []);

  // ─── Handle editable preview saves ────────────────────────────

  const handleFieldSave = useCallback(async (field: string, value: unknown) => {
    if (!venueId) return;

    if (field === "name_tagline") {
      const { name } = value as { name: string; tagline: string };
      await updateVenue(venueId, { name });
      setHubData((prev) => ({ ...prev, name }));
    } else if (field === "tagline") {
      await updateVenuePage(venueId, { tagline: value as string });
      setHubData((prev) => ({ ...prev, tagline: value as string }));
    } else if (field === "theme_color") {
      await updateVenuePage(venueId, { theme_color: value as string });
      setHubData((prev) => ({ ...prev, themeColor: value as string }));
    } else if (field === "hours") {
      const hoursArr = [{ day: "Daily", open: value as string, close: "" }];
      await updateVenuePage(venueId, { hours: hoursArr });
      setHubData((prev) => ({ ...prev, hours: value as string }));
    } else if (field === "description") {
      await updateVenuePage(venueId, { description: value as string });
      setHubData((prev) => ({ ...prev, description: value as string }));
    }
  }, [venueId]);

  const handlePhotoUpload = useCallback(async (file: File) => {
    if (!venueId) return;
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadGalleryImage(venueId, formData);
    if (result && "url" in result && result.url) {
      setGalleryImages((prev) => [...prev, { id: `new-${Date.now()}`, image_url: result.url as string }]);
    }
  }, [venueId]);

  const handleSectionEdited = useCallback((key: string) => {
    if (key in checklist) {
      markChecklistItem(key as keyof ChecklistState, true);
    }
  }, [checklist, markChecklistItem]);

  // ─── Checklist item click → agent guides through it ───────────

  const handleChecklistItemClick = useCallback((key: keyof ChecklistState) => {
    setCurrentItem(key);
    if (checklist[key]) return; // already done

    const prompt = getItemPrompt(key);

    // Add agent message guiding through this item
    const msg: OnboardingMessage = {
      id: `guide-${key}-${Date.now()}`,
      sender: "agent",
      body: prompt,
      timestamp: Date.now(),
      component: key === "stripe" ? "stripe" : undefined,
    };
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  }, [checklist, scrollToBottom]);

  // ─── Send message ─────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      if (phase === "chat" && venueCreated) return;

      const userMsg: OnboardingMessage = {
        id: `user-${Date.now()}`, sender: "user", body: msg, timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      scrollToBottom();

      if (phase === "chat") {
        // Phase 1 — chat-based setup
        const allMessages = [...messages, userMsg];
        const extracted = extractHubDataFromMessages(allMessages);
        if (Object.keys(extracted).length > 0) {
          setHubData((prev) => ({ ...prev, ...extracted }));
        }
      }

      conversationRef.current.push({ role: "user", content: msg });

      try {
        const bodyPayload: Record<string, unknown> = { messages: conversationRef.current };
        if (phase === "checklist") {
          bodyPayload.phase = "checklist";
          bodyPayload.currentItem = currentItem;
          bodyPayload.checklist = checklist;
        }

        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();
        const reply = data.reply || "Something went wrong. Try again.";

        conversationRef.current.push({ role: "assistant", content: reply });

        const agentMsg: OnboardingMessage = {
          id: `agent-${Date.now()}`, sender: "agent", body: reply, timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, agentMsg]);

        if (data.hubData) setHubData((prev) => mergePartialData(prev, data.hubData));
        if (data.smartReplies?.length > 0) setSmartReplies(data.smartReplies);

        // Phase 1 → Phase 2 transition
        if (data.venueCreated && phase === "chat") {
          setVenueCreated(true);
          setSmartReplies([]);

          // Fetch the created venue state
          const state = await getOnboardingState();
          if (state?.hasVenue && state.venueId) {
            setVenueId(state.venueId);
            if (state.checklist) setChecklist(state.checklist as ChecklistState);
            if (state.offerings) setOfferings(state.offerings);
            if (state.gallery) setGalleryImages(state.gallery);

            // Transition to checklist phase
            setPhase("checklist");
            const cl = (state.checklist as ChecklistState) || DEFAULT_CHECKLIST;
            const firstIncomplete = (Object.keys(cl) as (keyof ChecklistState)[]).find((k) => !cl[k]);
            setCurrentItem(firstIncomplete || null);

            setMessages((prev) => [...prev, {
              id: `phase2-start-${Date.now()}`,
              sender: "agent",
              body: `Your hub is created! Now let\u2019s make it shine. I\u2019ll walk you through each section. ${firstIncomplete ? getItemPrompt(firstIncomplete) : ""}`,
              timestamp: Date.now(),
            }]);
          }
        }

        // Handle checklist updates from AI response
        if (data.checklistUpdate) {
          const { item, completed } = data.checklistUpdate;
          markChecklistItem(item, completed);
          // Move to next incomplete item
          const updated = { ...checklist, [item]: completed };
          const nextIncomplete = (Object.keys(updated) as (keyof ChecklistState)[]).find((k) => !updated[k]);
          setCurrentItem(nextIncomplete || null);
        }
      } catch {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`, sender: "agent",
          body: "Something went wrong. Try again.", timestamp: Date.now(),
        }]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [input, loading, phase, venueCreated, messages, scrollToBottom, currentItem, checklist, markChecklistItem]
  );

  // ─── Quick replies ────────────────────────────────────────────

  const quickReplies = (phase === "chat" && !venueCreated) ? smartReplies : [];

  // ─── Loading state ────────────────────────────────────────────

  if (resumeLoading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange border-t-transparent" />
          <p className="font-sans text-[13px] text-white/30">Loading your hub...</p>
        </div>
      </main>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="flex h-dvh bg-black">
      {/* Left: Checklist + Chat */}
      <div className={`flex w-full flex-col lg:w-1/2 ${showPreview ? "hidden lg:flex" : ""}`}>
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Image src="/logo.png" alt="theKickBack" width={120} height={40} className="h-7 w-auto" />
          <div className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="font-sans text-[13px] font-medium text-white/35">
            {phase === "checklist" ? "Complete your hub" : "Set up your hub"}
          </span>
        </header>

        {/* Checklist (Phase 2 only) */}
        {phase === "checklist" && (
          <div className="border-b border-white/[0.06] overflow-y-auto" style={{ maxHeight: "45%" }}>
            <OnboardingChecklist
              checklist={checklist}
              currentItem={currentItem}
              onItemClick={handleChecklistItemClick}
              onSubmit={handleSubmitForReview}
              submitting={submitting}
            />
          </div>
        )}

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
                className={`mb-3 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.sender === "user"
                      ? "rounded-br-sm bg-orange/15 text-white/90"
                      : "rounded-bl-sm"
                  }`}
                  style={msg.sender === "agent" ? { backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" } : undefined}
                >
                  <p className="font-sans text-[14px] leading-[1.6] whitespace-pre-wrap text-white/85">
                    {msg.body}
                  </p>
                  {/* Inline Stripe Connect */}
                  {msg.component === "stripe" && (
                    <div className="mt-3">
                      <StripeConnect />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading dots */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex justify-start">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex gap-1.5">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="h-2 w-2 rounded-full bg-white/30"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 1: Submit for review (legacy — kept for chat phase only) */}
          {phase === "chat" && venueCreated && !submitted && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-3 flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="mb-3 font-sans text-[14px] leading-[1.6] text-white/85">
                  Your hub is ready. Check the preview on the right, then submit for review.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleSubmitForReview} disabled={submitting} className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: "#F97316" }}>
                    {submitting ? "Submitting..." : "Submit for Review"}
                  </button>
                  <button onClick={() => router.push("/")} className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-medium text-white/40 active:scale-[0.98]" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    Edit Later
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submitted state */}
          {submitted && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-3 flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-4" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-400/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <span className="font-sans text-[14px] font-bold text-green-400">Application Under Review</span>
                </div>
                <p className="mb-1 font-sans text-[13px] leading-[1.6] text-white/60">
                  Your hub has been submitted and is being reviewed. We&apos;ve sent a confirmation to your email.
                </p>
                <p className="mb-3 font-sans text-[13px] leading-[1.6] text-white/40">
                  You can continue setting up from the dashboard while you wait.
                </p>
                <button onClick={() => router.push("/")} className="rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98]" style={{ backgroundColor: "#4ADE80" }}>
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies + Input */}
        <div className="border-t border-white/[0.06]" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          {quickReplies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  onClick={() => sendMessage(reply)}
                  disabled={loading}
                  className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium text-white/50 transition active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-4 pb-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={submitted ? "Hub submitted!" : phase === "checklist" ? "Ask me anything about setup..." : venueCreated ? "Hub created!" : "Tell me about your hub..."}
              disabled={submitted}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className="flex-1 rounded-2xl px-4 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 outline-none disabled:opacity-40"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || submitted}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-orange transition active:scale-95 disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="hidden w-1/2 border-l border-white/[0.06] lg:block">
        {phase === "checklist" && venueId ? (
          <HubPreviewEditable
            data={hubData}
            venueId={venueId}
            offerings={offerings}
            galleryImages={galleryImages}
            onFieldSave={handleFieldSave}
            onPhotoUpload={handlePhotoUpload}
            onSectionEdited={handleSectionEdited}
          />
        ) : (
          <HubPreview data={hubData} />
        )}
      </div>

      {/* Mobile: Preview FAB */}
      <button
        onClick={() => setShowPreview(true)}
        className="fixed bottom-24 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-orange shadow-lg lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Mobile: Preview sheet */}
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 lg:hidden" onClick={() => setShowPreview(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 top-16 rounded-t-3xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="font-sans text-[14px] font-semibold text-white/80">Hub Preview</span>
                <button onClick={() => setShowPreview(false)} className="text-white/40">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {phase === "checklist" && venueId ? (
                <HubPreviewEditable
                  data={hubData}
                  venueId={venueId}
                  offerings={offerings}
                  galleryImages={galleryImages}
                  onFieldSave={handleFieldSave}
                  onPhotoUpload={handlePhotoUpload}
                  onSectionEdited={handleSectionEdited}
                />
              ) : (
                <HubPreview data={hubData} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Helper: prompts for each checklist item ─────────────────────

function getItemPrompt(key: keyof ChecklistState): string {
  const prompts: Record<keyof ChecklistState, string> = {
    basics: "Let\u2019s confirm your hub name and type are right.",
    location: "Let\u2019s make sure your address is correct.",
    hours: "What are your operating hours? You can edit them in the preview too.",
    branding: "Time to set your tagline, description, and theme color. Tap any section in the preview to edit.",
    offerings: "Review the offerings we auto-generated. You can edit them from the preview or your dashboard later.",
    knowledge: "Teach your AI about your spot \u2014 what should it know that isn\u2019t obvious? Signature drinks, house rules, parking tips?",
    photos: "Upload at least one photo. Tap the photos section in the preview to add images.",
    xp: "Review your loyalty program \u2014 we set up XP actions and milestones based on your hub type.",
    stripe: "Last step \u2014 connect Stripe so you can accept payments. Tap the button below to get started.",
  };
  return prompts[key];
}
