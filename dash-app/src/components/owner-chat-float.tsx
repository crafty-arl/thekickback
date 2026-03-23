"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OwnerMessageBody } from "./owner-message-body";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  sender: "owner" | "agent";
  body: string;
  timestamp: number;
}

export interface OwnerChatFloatProps {
  messages: Message[];
  loading: boolean;
  input: string;
  onInputChange: (val: string) => void;
  onSendMessage: (text?: string) => void;
  quickReplies: string[];
  onApproveBooking: (id: string) => Promise<void>;
  onDeclineBooking: (id: string) => Promise<void>;
}

export interface OwnerChatFloatHandle {
  open: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const OwnerChatFloat = forwardRef<OwnerChatFloatHandle, OwnerChatFloatProps>(
  function OwnerChatFloat(
    {
      messages,
      loading,
      input,
      onInputChange,
      onSendMessage,
      quickReplies,
      onApproveBooking,
      onDeclineBooking,
    },
    ref,
  ) {
    const [chatOpen, setChatOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /* Track message count so we can flag unread while closed */
    const lastSeenCount = useRef(messages.length);

    useEffect(() => {
      if (chatOpen) {
        lastSeenCount.current = messages.length;
        setHasUnread(false);
      } else if (messages.length > lastSeenCount.current) {
        setHasUnread(true);
      }
    }, [messages.length, chatOpen]);

    /* Auto-scroll when new messages arrive */
    useEffect(() => {
      if (chatOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [messages, loading, chatOpen]);

    /* Focus input when panel opens */
    useEffect(() => {
      if (chatOpen) {
        setTimeout(() => inputRef.current?.focus(), 350);
      }
    }, [chatOpen]);

    /* Expose imperative open() */
    useImperativeHandle(ref, () => ({ open: () => setChatOpen(true) }), []);

    const toggle = useCallback(() => setChatOpen((prev) => !prev), []);

    /* ---------------------------------------------------------------- */
    /*  Render                                                           */
    /* ---------------------------------------------------------------- */

    return (
      <>
        {/* ---- Floating button ---- */}
        <AnimatePresence>
          {!chatOpen && (
            <motion.button
              key="fab"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={toggle}
              className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/25 active:scale-95 transition-transform"
              aria-label="Open chat"
            >
              {/* Chat icon */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>

              {/* Unread indicator */}
              {hasUnread && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* ---- Chat panel ---- */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              key="panel"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 right-0 z-40 flex flex-col bg-white shadow-2xl border border-gray-200/60
                         w-full max-h-[70vh]
                         lg:bottom-6 lg:right-6 lg:w-[380px] lg:rounded-2xl lg:max-h-[70vh]"
            >
              {/* --- Header --- */}
              <div
                className="flex items-center justify-between shrink-0 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
              >
                <span className="font-sans text-sm font-semibold text-gray-900">
                  AI Assistant
                </span>
                <button
                  onClick={toggle}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 transition"
                  aria-label="Close chat"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-500"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* --- Messages --- */}
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-1 no-scrollbar">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className={`mb-2 flex ${msg.sender === "owner" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          msg.sender === "owner"
                            ? "rounded-br-sm text-gray-900"
                            : "rounded-bl-sm"
                        }`}
                        style={
                          msg.sender === "agent"
                            ? { backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }
                            : { backgroundColor: "rgba(249,115,22,0.08)" }
                        }
                      >
                        {msg.sender === "agent" ? (
                          <OwnerMessageBody
                            body={msg.body}
                            onApproveBooking={onApproveBooking}
                            onDeclineBooking={onDeclineBooking}
                          />
                        ) : (
                          <p className="font-sans text-[13px] leading-[1.5]">{msg.body}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing indicator */}
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-2">
                    <div
                      className="rounded-2xl rounded-bl-sm px-3 py-2"
                      style={{ backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <div className="flex gap-1.5">
                        <motion.div className="h-1.5 w-1.5 rounded-full bg-gray-300" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                        <motion.div className="h-1.5 w-1.5 rounded-full bg-gray-300" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                        <motion.div className="h-1.5 w-1.5 rounded-full bg-gray-300" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* --- Quick replies --- */}
              {quickReplies.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-1.5 no-scrollbar shrink-0">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => onSendMessage(reply)}
                      className="shrink-0 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 font-sans text-[11px] font-medium text-gray-500 active:scale-95 transition"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {/* --- Input bar --- */}
              <div
                className="flex items-end gap-2 px-4 py-2 shrink-0"
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  paddingBottom: "max(8px, env(safe-area-inset-bottom))",
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSendMessage();
                    }
                  }}
                  placeholder="What do you want to change?"
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  className="flex-1 rounded-2xl bg-gray-100 border border-gray-200 px-4 py-2.5 font-sans text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
                />
                <button
                  onClick={() => onSendMessage()}
                  disabled={!input.trim() || loading}
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30"
                  style={{ backgroundColor: "#F97316" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  },
);
