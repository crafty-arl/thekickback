"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Thread {
  id: string;
  venueId: string | null;
  threadType: "venue" | "master";
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  unread: boolean;
  venue: {
    id: string;
    name: string;
    vibe: string;
    type: string;
    neighborhood: string | null;
  } | null;
}

interface ThreadsListProps {
  onThreadSelect: (venueId: string | null) => void;
  onThreadDelete?: (venueId: string | null) => void;
}

const VIBE_COLORS: Record<string, string> = {
  quiet: "#4ade80", moderate: "#facc15", busy: "#f97316", lit: "#f87171", packed: "#f87171",
};

const ACCENT = "#a78bfa";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function ThreadsList({ onThreadSelect, onThreadDelete }: ThreadsListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/threads")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setThreads(data.threads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(thread.id);
    const params = thread.threadType === "master" ? "master=true" : `venueId=${thread.venueId}`;
    const res = await fetch(`/api/threads?${params}`, { method: "DELETE" });
    if (res.ok) {
      setThreads((prev) => prev.filter((t) => t.id !== thread.id));
      onThreadDelete?.(thread.venueId);
    }
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2 px-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className="mt-3 font-sans text-[13px] text-white/25">No conversations yet</p>
        <p className="mt-1 font-sans text-[10px] text-white/15">Chat with a place to start a thread</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 py-2">
      <AnimatePresence>
        {threads.map((thread, i) => {
          const isMaster = thread.threadType === "master";
          const name = isMaster ? "KickBack" : (thread.venue?.name || "Place");
          const vibe = thread.venue?.vibe || "quiet";
          const color = isMaster ? ACCENT : (VIBE_COLORS[vibe] || "#9ca3af");
          const isDeleting = deleting === thread.id;
          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, height: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-1"
            >
              <button
                onClick={() => onThreadSelect(thread.venueId)}
                className="flex flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors active:scale-[0.98]"
                style={{
                  backgroundColor: thread.unread ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${thread.unread ? `${color}20` : "rgba(255,255,255,0.04)"}`,
                }}
              >
                {/* Avatar */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                    border: `1.5px solid ${color}30`,
                  }}
                >
                  {isMaster ? (
                    <span className="font-sans text-[12px] font-bold" style={{ color }}>KB</span>
                  ) : (
                    <span className="font-sans text-[14px] font-bold" style={{ color }}>
                      {name[0]}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate font-sans text-[13px] font-semibold ${thread.unread ? "text-white/90" : "text-white/60"}`}>
                      {name}
                    </span>
                    {!isMaster && thread.venue && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-sans text-[9px]" style={{ color }}>{vibe}</span>
                      </div>
                    )}
                    {isMaster && (
                      <span className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-semibold" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                        Concierge
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 truncate font-sans text-[11px] ${thread.unread ? "text-white/45" : "text-white/20"}`}>
                    {thread.lastMessage}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-sans text-[10px] text-white/20">{timeAgo(thread.lastMessageAt)}</span>
                  {thread.unread && (
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  )}
                </div>
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(thread, e)}
                disabled={isDeleting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-red-500/10 active:scale-90 disabled:opacity-30"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Thread count badge (for the pill) ───────────────────────────

export function useThreadCount(): { count: number; unread: number } {
  const [count, setCount] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/threads")
      .then((r) => {
        if (!r.ok) return { threads: [], unreadCount: 0 };
        return r.json();
      })
      .then((data) => {
        setCount(data.threads?.length || 0);
        setUnread(data.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  return { count, unread };
}
