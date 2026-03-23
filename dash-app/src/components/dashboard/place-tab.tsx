"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlacePreviewEditable } from "@/components/place-preview-editable";
import { OwnerMessageBody } from "@/components/owner-message-body";
import type { ChecklistState } from "@/components/onboarding-checklist";
import type { PlaceData } from "@/components/place-preview";

// ─── Types ──────────────────────────────────────────────────────────

interface OwnerMessage {
  id: string;
  sender: "owner" | "agent";
  body: string;
  timestamp: number;
}

interface PlaceTabProps {
  hubData: PlaceData;
  venueId: string;
  offeringsState: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }[];
  galleryImages: { id: string; image_url: string }[];
  initialXpActions?: { label: string; points: number }[];
  initialXpMilestones?: { name: string; threshold: number }[];
  checklistPercent: number;
  messages: OwnerMessage[];
  loading: boolean;
  input: string;
  onInputChange: (val: string) => void;
  onSendMessage: (text?: string) => void;
  quickReplies: string[];
  onFieldSave: (field: string, value: unknown) => Promise<void>;
  onPhotoUpload: (file: File) => Promise<void>;
  onSectionEdited: (key: string) => void;
  onOfferingTap: (offering: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  }) => void;
  onApproveBooking: (id: string) => Promise<void>;
  onDeclineBooking: (id: string) => Promise<void>;
}

export function PlaceTab({
  hubData,
  venueId,
  offeringsState,
  galleryImages,
  initialXpActions,
  initialXpMilestones,
  checklistPercent,
  messages,
  loading,
  input,
  onInputChange,
  onSendMessage,
  quickReplies,
  onFieldSave,
  onPhotoUpload,
  onSectionEdited,
  onOfferingTap,
  onApproveBooking,
  onDeclineBooking,
}: PlaceTabProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => scrollToBottom();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollToBottom]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Edit fields */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Setup progress (if < 100%) */}
        {checklistPercent < 100 && (
          <div
            className="shrink-0 mx-4 mt-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-[11px] font-semibold text-gray-500">Setup Progress</span>
              <span className="font-sans text-[11px] font-bold" style={{ color: "#F97316" }}>
                {checklistPercent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${checklistPercent}%`, backgroundColor: "#F97316" }}
              />
            </div>
          </div>
        )}

        {/* Place preview editable */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <PlacePreviewEditable
            data={hubData}
            venueId={venueId}
            offerings={offeringsState}
            galleryImages={galleryImages}
            xpActions={initialXpActions}
            xpMilestones={initialXpMilestones}
            onFieldSave={onFieldSave}
            onPhotoUpload={onPhotoUpload}
            onSectionEdited={onSectionEdited}
            onOfferingTap={onOfferingTap}
          />
        </div>

        {/* AI chat at bottom of Place */}
        <div
          className="shrink-0 bg-white"
          style={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: "max(4px, env(safe-area-inset-bottom))",
          }}
        >
          {/* Chat messages (collapsed, shows last message) */}
          {messages.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto px-4 pt-2 no-scrollbar">
              <div ref={messagesContainerRef}>
                <AnimatePresence initial={false}>
                  {messages.slice(-3).map((msg) => (
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
            </div>
          )}

          {/* Quick replies */}
          <div className="flex gap-2 overflow-x-auto px-4 py-1.5 no-scrollbar">
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

          {/* Input */}
          <div className="flex items-end gap-2 px-4 py-2">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: live preview iframe */}
      <div
        className="hidden lg:flex w-[420px] shrink-0 items-center justify-center bg-gray-50"
        style={{ borderLeft: "1px solid rgba(0,0,0,0.08)" }}
      >
        {hubData.slug ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="overflow-hidden rounded-[32px]"
              style={{ width: 375, height: 680, border: "2px solid rgba(0,0,0,0.08)" }}
            >
              <iframe
                src={`https://join.thekickback.net/${hubData.slug}`}
                className="h-full w-full"
                style={{ border: "none", background: "#fff" }}
                title="Place Preview"
              />
            </div>
            <span className="font-mono text-[10px] text-gray-300">
              join.thekickback.net/{hubData.slug}
            </span>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-sans text-[14px] text-gray-400">Preview will appear here</p>
            <p className="mt-1 font-sans text-[12px] text-gray-300">Complete setup to see your live page</p>
          </div>
        )}
      </div>
    </div>
  );
}
