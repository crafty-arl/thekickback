"use client";

import { useState, useMemo } from "react";
import { ChatMessage } from "@/lib/dashboard";

// ─── Topic detection ─────────────────────────────────────────────
const TOPIC_RULES: { id: string; label: string; color: string; keywords: RegExp }[] = [
  { id: "menu", label: "Menu & Drinks", color: "#F97316", keywords: /\b(menu|food|drink|cocktail|beer|wine|coffee|latte|eat|hungry|specials?|appetizer|entree|dessert|vegan|gluten)\b/i },
  { id: "reserve", label: "Reservations", color: "#a78bfa", keywords: /\b(reserv|book|booth|table|seat|spot|tonight|tomorrow|friday|saturday|party|group|private)\b/i },
  { id: "vibe", label: "Vibe & Crowd", color: "#4ade80", keywords: /\b(vibe|busy|crowd|packed|quiet|loud|energy|atmosphere|wait|line|full|empty|scene)\b/i },
  { id: "events", label: "Events", color: "#60a5fa", keywords: /\b(event|show|live|music|dj|performance|tonight|happening|schedule|open mic|comedy)\b/i },
  { id: "hours", label: "Hours & Location", color: "#facc15", keywords: /\b(hour|open|close|when|where|address|direction|parking|located|find you)\b/i },
  { id: "membership", label: "Membership & Perks", color: "#f87171", keywords: /\b(member|join|sign up|perk|reward|points|xp|loyalty|tier|vip|upgrade|subscription)\b/i },
  { id: "order", label: "Orders & Prices", color: "#2dd4bf", keywords: /\b(order|price|cost|how much|pay|buy|purchase|checkout|add|cart)\b/i },
];

function detectTopic(text: string): { id: string; label: string; color: string } | null {
  for (const rule of TOPIC_RULES) {
    if (rule.keywords.test(text)) return rule;
  }
  return null;
}

// ─── Conversation grouping ───────────────────────────────────────
interface Conversation {
  id: string;
  guestMessage: ChatMessage;
  aiReply: ChatMessage | null;
  topic: { id: string; label: string; color: string } | null;
  timestamp: string;
}

function groupConversations(messages: ChatMessage[]): Conversation[] {
  // Messages come newest-first from the API — reverse to chronological
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const convos: Conversation[] = [];
  let i = 0;

  while (i < sorted.length) {
    const msg = sorted[i];

    if (msg.sender_type === "guest") {
      // Look ahead for an AI reply
      const next = sorted[i + 1];
      const aiReply = next && next.sender_type === "ai" ? next : null;

      convos.push({
        id: msg.id,
        guestMessage: msg,
        aiReply,
        topic: detectTopic(msg.body),
        timestamp: msg.created_at,
      });

      i += aiReply ? 2 : 1;
    } else {
      // Orphan AI message (no preceding guest message) — skip or show solo
      i++;
    }
  }

  return convos.reverse(); // newest first
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────

export function TextLog({ messages }: { messages: ChatMessage[] }) {
  const [filterTopic, setFilterTopic] = useState<string | null>(null);

  const conversations = useMemo(() => groupConversations(messages), [messages]);

  // Count topics for the insight bar
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversations) {
      if (c.topic) {
        counts.set(c.topic.id, (counts.get(c.topic.id) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const rule = TOPIC_RULES.find((r) => r.id === id)!;
        return { id, label: rule.label, color: rule.color, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [conversations]);

  const filtered = filterTopic
    ? conversations.filter((c) => c.topic?.id === filterTopic)
    : conversations;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-black p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
          GUEST CONVERSATIONS
        </span>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            {conversations.length} chats
          </span>
        </div>
      </div>

      {/* Topic insight bar */}
      {topicCounts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">
            WHAT GUESTS ARE ASKING ABOUT
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topicCounts.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTopic(filterTopic === t.id ? null : t.id)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold transition active:scale-95"
                style={{
                  backgroundColor: filterTopic === t.id ? `${t.color}25` : "rgba(255,255,255,0.05)",
                  color: filterTopic === t.id ? t.color : "rgba(255,255,255,0.4)",
                  border: `1px solid ${filterTopic === t.id ? `${t.color}40` : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
                <span className="rounded-full px-1 font-mono text-[9px]" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  {t.count}
                </span>
              </button>
            ))}
            {filterTopic && (
              <button
                onClick={() => setFilterTopic(null)}
                className="rounded-full px-2 py-1 font-sans text-[10px] text-white/30 transition hover:text-white/50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Mini bar chart */}
          <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            {topicCounts.map((t) => (
              <div
                key={t.id}
                className="h-full transition-all"
                style={{
                  width: `${(t.count / conversations.length) * 100}%`,
                  backgroundColor: t.color,
                  opacity: filterTopic && filterTopic !== t.id ? 0.2 : 0.7,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-6 text-center font-sans text-sm text-white/20">
            {filterTopic ? "No conversations about this topic yet." : "No conversations yet. Guest chats will appear here."}
          </p>
        )}
        {filtered.map((convo) => (
          <div
            key={convo.id}
            className="group rounded-xl transition"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Guest message */}
            <div className="flex items-start gap-2.5 px-3 pt-3 pb-1.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(74,222,128,0.15)" }}>
                <span className="font-sans text-[8px] font-bold text-green-400">G</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[13px] leading-[1.5] text-white/75">{convo.guestMessage.body}</p>
              </div>
              <span className="shrink-0 font-sans text-[9px] text-white/20">{timeAgo(convo.timestamp)}</span>
            </div>

            {/* AI reply */}
            {convo.aiReply && (
              <div className="flex items-start gap-2.5 px-3 pt-1 pb-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
                  <span className="font-sans text-[8px] font-bold" style={{ color: "#F97316" }}>AI</span>
                </div>
                <p className="min-w-0 flex-1 font-sans text-[12px] leading-[1.5] text-white/45">{convo.aiReply.body}</p>
              </div>
            )}

            {/* Bottom meta */}
            <div className="flex items-center gap-2 border-t px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <span className="font-mono text-[9px] text-white/15">{formatTime(convo.timestamp)}</span>
              {convo.topic && (
                <span
                  className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-semibold"
                  style={{ backgroundColor: `${convo.topic.color}15`, color: convo.topic.color }}
                >
                  {convo.topic.label}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
