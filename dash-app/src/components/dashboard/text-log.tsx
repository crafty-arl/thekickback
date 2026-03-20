"use client";

import { useState, useMemo } from "react";
import { ChatMessage } from "@/lib/dashboard";

// ─── Topics with friendly emoji labels ───────────────────────────
const TOPIC_RULES: { id: string; label: string; emoji: string; color: string; bg: string; keywords: RegExp }[] = [
  { id: "menu", label: "Food & Drinks", emoji: "🍸", color: "#F97316", bg: "#F9731610", keywords: /\b(menu|food|drink|cocktail|beer|wine|coffee|latte|eat|hungry|specials?|appetizer|entree|dessert|vegan|gluten)\b/i },
  { id: "reserve", label: "Reservations", emoji: "🪑", color: "#a78bfa", bg: "#a78bfa10", keywords: /\b(reserv|book|booth|table|seat|spot|tonight|tomorrow|friday|saturday|party|group|private)\b/i },
  { id: "vibe", label: "Vibe Check", emoji: "✨", color: "#4ade80", bg: "#4ade8010", keywords: /\b(vibe|busy|crowd|packed|quiet|loud|energy|atmosphere|wait|line|full|empty|scene)\b/i },
  { id: "events", label: "Events", emoji: "🎵", color: "#60a5fa", bg: "#60a5fa10", keywords: /\b(event|show|live|music|dj|performance|tonight|happening|schedule|open mic|comedy)\b/i },
  { id: "hours", label: "Hours & Location", emoji: "📍", color: "#facc15", bg: "#facc1510", keywords: /\b(hour|open|close|when|where|address|direction|parking|located|find you)\b/i },
  { id: "membership", label: "Membership", emoji: "👑", color: "#f87171", bg: "#f8717110", keywords: /\b(member|join|sign up|perk|reward|points|xp|loyalty|tier|vip|upgrade|subscription)\b/i },
  { id: "order", label: "Orders & Prices", emoji: "💳", color: "#2dd4bf", bg: "#2dd4bf10", keywords: /\b(order|price|cost|how much|pay|buy|purchase|checkout|add|cart)\b/i },
];

function detectTopic(text: string): (typeof TOPIC_RULES)[number] | null {
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
  topic: (typeof TOPIC_RULES)[number] | null;
  timestamp: string;
}

function groupConversations(messages: ChatMessage[]): Conversation[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const convos: Conversation[] = [];
  let i = 0;

  while (i < sorted.length) {
    const msg = sorted[i];
    if (msg.sender_type === "guest") {
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
      i++;
    }
  }

  return convos.reverse();
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

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversations) {
      if (c.topic) counts.set(c.topic.id, (counts.get(c.topic.id) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ ...TOPIC_RULES.find((r) => r.id === id)!, count }))
      .sort((a, b) => b.count - a.count);
  }, [conversations]);

  const filtered = filterTopic
    ? conversations.filter((c) => c.topic?.id === filterTopic)
    : conversations;

  const topTopic = topicCounts[0];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Big number summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{conversations.length}</p>
          <p className="font-sans text-[13px] text-black/40">Total chats</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4">
          <p className="font-mono text-[28px] font-bold tracking-tight text-black">{topicCounts.length}</p>
          <p className="font-sans text-[13px] text-black/40">Topics asked</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-5 py-4 sm:col-span-2">
          {topTopic ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[22px]">{topTopic.emoji}</span>
                <p className="font-sans text-[18px] font-bold text-black">{topTopic.label}</p>
              </div>
              <p className="mt-0.5 font-sans text-[13px] text-black/40">
                Most asked about ({topTopic.count} {topTopic.count === 1 ? "chat" : "chats"})
              </p>
            </>
          ) : (
            <>
              <p className="font-sans text-[18px] font-bold text-black/20">No topics yet</p>
              <p className="font-sans text-[13px] text-black/30">Chats will be categorized here</p>
            </>
          )}
        </div>
      </div>

      {/* ── Topic filter pills ── */}
      {topicCounts.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-sans text-[13px] font-semibold text-black/50">
            What are guests asking about?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterTopic(null)}
              className="rounded-full px-4 py-2 font-sans text-[13px] font-medium transition active:scale-95"
              style={{
                backgroundColor: filterTopic === null ? "#000" : "rgba(0,0,0,0.04)",
                color: filterTopic === null ? "#fff" : "rgba(0,0,0,0.4)",
              }}
            >
              All ({conversations.length})
            </button>
            {topicCounts.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTopic(filterTopic === t.id ? null : t.id)}
                className="flex items-center gap-2 rounded-full px-4 py-2 font-sans text-[13px] font-medium transition active:scale-95"
                style={{
                  backgroundColor: filterTopic === t.id ? t.color : "rgba(0,0,0,0.04)",
                  color: filterTopic === t.id ? "#fff" : "rgba(0,0,0,0.5)",
                }}
              >
                <span className="text-[14px]">{t.emoji}</span>
                {t.label}
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none"
                  style={{
                    backgroundColor: filterTopic === t.id ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Topic bar — visual breakdown */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
            {topicCounts.map((t) => (
              <div
                key={t.id}
                className="h-full transition-all duration-300"
                style={{
                  width: `${(t.count / conversations.length) * 100}%`,
                  backgroundColor: t.color,
                  opacity: filterTopic && filterTopic !== t.id ? 0.15 : 1,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Conversation cards ── */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-black/5 bg-white px-6 py-12 text-center">
            <p className="text-[32px]">💬</p>
            <p className="mt-2 font-sans text-[15px] font-medium text-black/40">
              {filterTopic ? "No chats about this topic yet" : "No guest chats yet"}
            </p>
            <p className="mt-1 font-sans text-[13px] text-black/25">
              {filterTopic ? "Try a different filter" : "When guests message your AI, conversations show up here"}
            </p>
          </div>
        )}

        {filtered.map((convo) => (
          <div
            key={convo.id}
            className="overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-black/10"
          >
            {/* Guest question */}
            <div className="flex items-start gap-3 px-5 pt-4 pb-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black">
                <span className="font-sans text-[11px] font-bold text-white">G</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[12px] font-semibold text-black/40">Guest asked</span>
                  <span className="font-sans text-[12px] text-black/25">{timeAgo(convo.timestamp)}</span>
                </div>
                <p className="mt-1 font-sans text-[15px] leading-[1.6] text-black/80">
                  {convo.guestMessage.body}
                </p>
              </div>
            </div>

            {/* AI reply */}
            {convo.aiReply && (
              <div className="flex items-start gap-3 border-t border-black/[0.04] px-5 pt-3 pb-4" style={{ backgroundColor: "rgba(249,115,22,0.02)" }}>
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#F97316" }}>
                  <span className="font-sans text-[11px] font-bold text-white">AI</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-[12px] font-semibold" style={{ color: "#F97316" }}>Your AI replied</span>
                  <p className="mt-1 font-sans text-[14px] leading-[1.6] text-black/55">
                    {convo.aiReply.body}
                  </p>
                </div>
              </div>
            )}

            {/* Topic tag */}
            {convo.topic && (
              <div className="flex items-center gap-2 border-t border-black/[0.04] px-5 py-2.5">
                <span className="text-[13px]">{convo.topic.emoji}</span>
                <span className="font-sans text-[12px] font-medium" style={{ color: convo.topic.color }}>
                  {convo.topic.label}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
