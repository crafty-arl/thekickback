"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";

interface Thread {
  id: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}

interface OfferingData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  price_cents: number;
  recurring: boolean;
  interval: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  membership: "\u{1F451}", reservation: "\u{1FA91}", service: "\u2702\uFE0F", product: "\u2615",
  event: "\u{1F39F}\uFE0F", package: "\u{1F4E6}", custom: "\u2726",
};

interface VenueContactProps {
  venue: Venue;
  onClose: () => void;
  onChat: () => void;
  onThreadSelect?: (threadId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function VenueContact({ venue, onClose, onChat }: VenueContactProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [page, setPage] = useState<{ tagline: string | null; description: string | null; theme_color: string; hero_image: string | null; hours: { day: string; open: string; close: string }[] } | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const vibeColor = venue.themeColor || "#F97316";

  useEffect(() => {
    fetch(`/api/venue-page?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.page) setPage(d.page); })
      .catch(() => {});

    fetch(`/api/threads?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.messages?.length) {
          setThread({
            id: d.threadId,
            lastMessage: d.messages[d.messages.length - 1]?.body || "",
            lastMessageAt: d.messages[d.messages.length - 1]?.created_at || "",
            messageCount: d.messages.length,
          });
        }
      })
      .catch(() => {});

    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => setOfferings(d.offerings || []))
      .catch(() => {});

    try {
      const favs = JSON.parse(localStorage.getItem("kb-favorites") || "[]");
      setIsFavorite(favs.includes(venue.id));
    } catch {}
  }, [venue.id]);

  const toggleFavorite = () => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("kb-favorites") || "[]");
      const next = isFavorite ? favs.filter((id) => id !== venue.id) : [...favs, venue.id];
      localStorage.setItem("kb-favorites", JSON.stringify(next));
      setIsFavorite(!isFavorite);
    } catch {}
  };

  const theme = page?.theme_color || vibeColor;
  const memberships = offerings.filter((o) => o.type === "membership");
  const otherOfferings = offerings.filter((o) => o.type !== "membership");
  const grouped = otherOfferings.reduce<Record<string, OfferingData[]>>((acc, o) => { (acc[o.type] ||= []).push(o); return acc; }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col overflow-y-auto overscroll-contain"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <motion.button onClick={onClose} whileTap={{ scale: 0.9 }} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="opacity-50"><polyline points="15 18 9 12 15 6" /></svg>
        </motion.button>
        <span className="font-sans text-[11px] font-semibold tracking-[1px] text-white/25">VENUE INFO</span>
        <div className="w-7" />
      </div>

      {/* Hero */}
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl" style={{ border: `1px solid ${theme}20` }}>
        <div
          className="relative flex items-end px-4 pb-4 pt-14"
          style={{
            background: page?.hero_image
              ? `url(${page.hero_image}) center/cover`
              : `linear-gradient(135deg, ${theme}25 0%, ${theme}08 50%, rgba(0,0,0,0.5) 100%)`,
          }}
        >
          {page?.hero_image && <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 100%)" }} />}
          <div className="relative z-10 w-full">
            {venue.occupancy > 0 && (
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  <span className="font-sans text-[9px] font-semibold text-white/50">{venue.occupancy} checked in</span>
                </div>
              </div>
            )}
            <h2 className="font-sans text-[20px] font-bold text-white leading-tight">{venue.name}</h2>
            {page?.tagline && <p className="mt-0.5 font-sans text-[11px] text-white/45">{page.tagline}</p>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mx-4 mb-3 flex gap-2">
        <button onClick={onChat} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-bold text-black active:scale-[0.97]" style={{ backgroundColor: theme }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Chat
        </button>
        <button onClick={toggleFavorite} className="flex h-12 w-12 items-center justify-center rounded-xl active:scale-[0.95]" style={{ backgroundColor: isFavorite ? `${theme}15` : "rgba(255,255,255,0.04)", border: `1px solid ${isFavorite ? `${theme}30` : "rgba(255,255,255,0.06)"}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? theme : "none"} stroke={isFavorite ? theme : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        </button>
        <button onClick={() => { const slug = venue.slug || venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); const url = `https://join.thekickback.net/${slug}`; if (navigator.share) navigator.share({ title: venue.name, url }); else navigator.clipboard.writeText(url); }} className="flex h-12 w-12 items-center justify-center rounded-xl active:scale-[0.95]" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
        </button>
      </div>

      {/* Location */}
      {(venue.address || venue.neighborhood) && (
        <a
          href={venue.address ? `https://maps.google.com/?q=${encodeURIComponent(venue.address)}` : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 active:scale-[0.98]"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <div className="flex-1 min-w-0">
            {venue.address && <p className="font-sans text-[11px] text-white/50 truncate">{venue.address}</p>}
            {venue.neighborhood && <p className="font-sans text-[9px] text-white/25">{venue.neighborhood}</p>}
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </a>
      )}

      {/* Hours */}
      {page?.hours && page.hours.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="mb-1.5 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">HOURS</p>
          <div className="flex flex-col gap-0.5">
            {page.hours.map((h) => (
              <div key={h.day} className="flex justify-between">
                <span className="font-sans text-[10px] text-white/30">{h.day}</span>
                <span className="font-sans text-[10px] text-white/50">{h.open}{h.close ? `\u2013${h.close}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memberships */}
      {memberships.length > 0 && (
        <div className="mx-4 mb-3">
          <p className="mb-1.5 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">MEMBERSHIPS</p>
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={onChat}
              className="mb-1.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.98]"
              style={{ backgroundColor: `${theme}08`, border: `1px solid ${theme}20` }}
            >
              <span className="text-[16px]">{"\u{1F451}"}</span>
              <div className="flex-1 min-w-0">
                <span className="font-sans text-[12px] font-bold text-white/80">{m.name}</span>
                {m.description && <p className="truncate font-sans text-[9px] text-white/30">{m.description}</p>}
              </div>
              <span className="font-mono text-[11px] font-bold" style={{ color: theme }}>${(m.price_cents / 100).toFixed(0)}/{m.interval || "mo"}</span>
            </button>
          ))}
        </div>
      )}

      {/* Offerings */}
      {Object.keys(grouped).length > 0 && (
        <div className="mx-4 mb-3">
          <p className="mb-1.5 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">OFFERINGS</p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {Object.entries(grouped).map(([type, items]) => (
              <button
                key={type}
                onClick={onChat}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 active:scale-95"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-[12px]">{TYPE_ICONS[type] || "\u2726"}</span>
                <span className="font-sans text-[10px] font-medium text-white/50 capitalize">{type}s</span>
                <span className="font-mono text-[9px] text-white/25">{items.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {page?.description && (
        <div className="mx-4 mb-3">
          <p className="font-sans text-[12px] leading-[1.6] text-white/35">{page.description}</p>
        </div>
      )}

      {/* Past conversation */}
      {thread && (
        <div className="mx-4 mb-3">
          <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1.5px] text-white/20">YOUR CONVERSATION</p>
          <button onClick={onChat} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.98]" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${theme}12` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-sans text-[11px] text-white/50">{thread.lastMessage}</p>
              <p className="font-sans text-[9px] text-white/20">{thread.messageCount} messages · {timeAgo(thread.lastMessageAt)}</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}

      {/* Full page link */}
      <div className="mx-4 mb-4">
        <a
          href={`https://join.thekickback.net/${venue.slug || venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 active:scale-[0.98]"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          <span className="font-sans text-[11px] text-white/40">View full page</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" className="ml-auto"><polyline points="9 18 15 12 9 6" /></svg>
        </a>
      </div>
    </motion.div>
  );
}
