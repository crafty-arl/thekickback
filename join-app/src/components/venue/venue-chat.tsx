"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo } from "framer-motion";

interface Message {
  id: string;
  sender: "guest" | "ai";
  body: string;
  timestamp: number;
}

interface NextAction {
  label: string;
  href: string | null;
  kind: string;
}

interface Props {
  venue: { id: string; name: string; vibe: string };
  page: { theme_color: string };
  table?: string;
  onClose: () => void;
}

// Phase 1: chat is a router, not a destination. Default CTA when the API
// hasn't surfaced anything more specific is the check-in deeplink.
function defaultNextAction(venueId: string): NextAction {
  return { label: "Check in here", href: `/checkin/${venueId}`, kind: "checkin" };
}

export function VenueChat({ venue, page, table, onClose }: Props) {
  const welcomeMsg: Message = {
    id: "welcome",
    sender: "ai",
    body: `Hey — welcome to ${venue.name}. ${venue.vibe === "quiet" ? "Quiet right now." : venue.vibe === "busy" ? "Pretty lively." : "Moderate crowd."} Ask me anything.`,
    timestamp: Date.now(),
  };
  const [messages, setMessages] = useState<Message[]>([welcomeMsg]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction>(defaultNextAction(venue.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag-to-dismiss state
  const [dismissed, setDismissed] = useState(false);

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/threads?venueId=${venue.id}&limit=50`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.messages?.length) {
          setHistoryLoaded(true);
          return;
        }
        const history: Message[] = data.messages.map((m: { id: string; sender_type: string; body: string; created_at: string }) => ({
          id: m.id,
          sender: m.sender_type === "guest" ? "guest" as const : "ai" as const,
          body: m.body,
          timestamp: new Date(m.created_at).getTime(),
        }));
        setMessages(history);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
    return () => { cancelled = true; };
  }, [venue.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input after mount (slight delay for drawer animation)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "guest",
      body: msg,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          venueId: venue.id,
          venueName: venue.name,
          vibe: venue.vibe,
          table,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          body: data.reply || "Couldn't reach the venue right now. Try again.",
          timestamp: Date.now(),
        },
      ]);
      // Phase 1: pick up the API-suggested next action when present, else
      // keep the default check-in deeplink so the chip is always actionable.
      if (data?.next_action?.label) {
        setNextAction(data.next_action as NextAction);
      } else {
        setNextAction(defaultNextAction(venue.id));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          body: "Something went wrong. Try again in a moment.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, venue, table]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      setDismissed(true);
      setTimeout(onClose, 300);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />

      {/* Drawer */}
      <motion.div
        initial={{ y: "100%" }}
        animate={dismissed ? { y: "100%" } : { y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] max-h-[700px] flex-col overflow-hidden [20px] bg-[#0D0D0F]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-3" style={{ touchAction: "none" }}>
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-2.5 w-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: page.theme_color }}
            />
            <span className="font-sans text-[15px] font-semibold text-white">
              {venue.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full active:opacity-60"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4" style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />

        {/* Messages — scrollable */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex flex-col gap-2.5">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%]  px-3.5 py-2.5 ${
                    msg.sender === "guest"
                      ? " text-black"
                      : " text-white/80"
                  }`}
                  style={
                    msg.sender === "guest"
                      ? { backgroundColor: page.theme_color }
                      : { backgroundColor: "rgba(255,255,255,0.06)" }
                  }
                >
                  <p className="font-sans text-[14px] leading-[1.5]">{msg.body}</p>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="  px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)", animationDelay: "300ms" }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Phase 1: single next_action chip — chat is a router, not a destination */}
        <div className="px-4 py-2">
          <button
            onClick={() => {
              // Fire-and-forget telemetry so we can prove chat drives action
              fetch("/api/loop-events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "chat_action_clicked",
                  venueId: venue.id,
                  properties: { kind: nextAction.kind, label: nextAction.label },
                }),
              }).catch(() => {});
              if (nextAction.href) {
                window.location.href = nextAction.href;
              }
            }}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-full px-4 font-sans text-[13px] font-semibold active:opacity-80 disabled:opacity-40"
            style={{
              backgroundColor: page.theme_color,
              color: "black",
              height: 38,
            }}
          >
            {nextAction.label} &nbsp;&rarr;
          </button>
        </div>

        {/* Input — safe area bottom */}
        <div
          className="flex items-center gap-2.5 px-4 pb-2 pt-2"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything..."
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 rounded-full border px-4 font-sans text-[14px] text-white placeholder:text-white/25 focus:outline-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.08)",
              height: 46,
              minHeight: 44,
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex shrink-0 items-center justify-center rounded-full active:scale-90 disabled:opacity-30"
            style={{
              backgroundColor: page.theme_color,
              width: 44,
              height: 44,
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </>
  );
}
