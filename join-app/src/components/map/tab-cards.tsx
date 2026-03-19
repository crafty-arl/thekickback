"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { type Venue, getVibeLabel, getOccupancyPercent } from "@/lib/venues";

interface TabCardProps {
  body: string;
  venue: Venue;
  vibeColor: string;
}

/* ── AI context line — shown above every card ── */
function AiContext({ body, vibeColor }: { body: string; vibeColor: string }) {
  if (!body) return null;
  return (
    <div className="mb-3 rounded-xl px-3 py-2" style={{ borderLeft: `3px solid ${vibeColor}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
      <p className="font-sans text-[12px] italic leading-relaxed text-white/50">{body}</p>
    </div>
  );
}

/* ── Card shell ── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </motion.div>
  );
}

const VIBE_LEVELS = ["quiet", "moderate", "busy", "lit", "packed"] as const;
const NOISE_MAP: Record<string, { label: string; bars: number }> = {
  quiet: { label: "Whisper quiet", bars: 1 },
  moderate: { label: "Conversation level", bars: 2 },
  busy: { label: "Lively buzz", bars: 3 },
  lit: { label: "High energy", bars: 4 },
  packed: { label: "Full send", bars: 5 },
};

/* ═══════════════════════════════════════════════════
   VIBE — Occupancy, noise, atmosphere
   ═══════════════════════════════════════════════════ */
export function VibeCard({ body, venue, vibeColor }: TabCardProps) {
  const pct = getOccupancyPercent(venue);
  const noise = NOISE_MAP[venue.vibe] || { label: "Unknown", bars: 0 };

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      {/* Occupancy meter */}
      <div className="px-4 pb-3">
        <p className="mb-2 font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">OCCUPANCY</p>
        <div className="flex items-end gap-1">
          <span className="font-mono text-[32px] font-bold leading-none" style={{ color: vibeColor }}>{pct}</span>
          <span className="mb-1 font-sans text-[14px] text-white/30">%</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: vibeColor, boxShadow: `0 0 12px ${vibeColor}40` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] text-white/30">{venue.occupancy}/{venue.capacity}</span>
        </div>
      </div>

      {/* Vibe gauge */}
      <div className="px-4 pb-3">
        <p className="mb-2 font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">VIBE</p>
        <div className="flex gap-1">
          {VIBE_LEVELS.map((level) => {
            const isActive = level === venue.vibe;
            return (
              <div key={level} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="h-2 w-full rounded-full"
                  style={{ backgroundColor: isActive ? vibeColor : "rgba(255,255,255,0.06)", boxShadow: isActive ? `0 0 8px ${vibeColor}40` : "none" }}
                />
                <span className="font-sans text-[8px] font-semibold" style={{ color: isActive ? vibeColor : "rgba(255,255,255,0.15)" }}>
                  {getVibeLabel(level).toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Noise level */}
      <div className="px-4 pb-3">
        <p className="mb-2 font-sans text-[9px] font-semibold tracking-[1.5px] text-white/25">NOISE LEVEL</p>
        <div className="flex items-center gap-3">
          <div className="flex items-end gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-2 rounded-sm"
                style={{
                  height: 6 + i * 4,
                  backgroundColor: i <= noise.bars ? vibeColor : "rgba(255,255,255,0.06)",
                  opacity: i <= noise.bars ? 1 : 0.3,
                }}
              />
            ))}
          </div>
          <span className="font-sans text-[12px] text-white/40">{noise.label}</span>
        </div>
      </div>

      {/* Tags */}
      {venue.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {venue.tags.map((tag) => (
            <span key={tag} className="rounded-full px-2 py-0.5 font-sans text-[10px] font-medium" style={{ backgroundColor: `${vibeColor}12`, color: `${vibeColor}bb`, border: `1px solid ${vibeColor}20` }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   MENU — Real menu items from DB, categorized
   ═══════════════════════════════════════════════════ */
export function MenuCard({ body, venue, vibeColor }: TabCardProps) {
  const [sections, setSections] = useState<{ name: string; items: { name: string; price?: string }[] }[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    // Fetch offerings that are food/drink products
    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => {
        const items = (d.offerings || []).filter((o: { type: string }) => o.type === "product" || o.type === "service");
        if (items.length > 0) {
          // Group by category
          const grouped: Record<string, { name: string; price?: string }[]> = {};
          for (const item of items) {
            const cat = item.category || "Menu";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ name: item.name, price: item.price_cents > 0 ? `$${(item.price_cents / 100).toFixed(0)}` : undefined });
          }
          setSections(Object.entries(grouped).map(([name, items]) => ({ name, items })));
        }
      })
      .catch(() => {});
  }, [venue.id]);

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Menu</span>
        </div>

        {/* Category tabs */}
        {sections.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
            {sections.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveSection(i)}
                className="shrink-0 rounded-full px-3 py-1 font-sans text-[10px] font-medium"
                style={{
                  backgroundColor: i === activeSection ? `${vibeColor}20` : "rgba(255,255,255,0.04)",
                  color: i === activeSection ? vibeColor : "rgba(255,255,255,0.3)",
                  border: `1px solid ${i === activeSection ? `${vibeColor}30` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Items */}
        {sections.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {sections[activeSection]?.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <span className="font-sans text-[12px] text-white/60">{item.name}</span>
                {item.price && <span className="font-mono text-[11px] font-bold" style={{ color: vibeColor }}>{item.price}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">Ask me about the menu — I know what we&apos;re serving.</p>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="font-sans text-[9px] text-white/15">Say &quot;I&apos;ll have the...&quot; to order</p>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   EVENTS — Upcoming events, paid/free badges
   ═══════════════════════════════════════════════════ */
export function EventsCard({ body, venue, vibeColor }: TabCardProps) {
  const [events, setEvents] = useState<{ id: string; name: string; description: string | null; price_cents: number }[]>([]);

  useEffect(() => {
    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => {
        setEvents((d.offerings || []).filter((o: { type: string }) => o.type === "event"));
      })
      .catch(() => {});
  }, [venue.id]);

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Events</span>
        </div>

        {events.length > 0 ? (
          <div className="flex flex-col gap-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[13px] font-semibold text-white/80">{ev.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold"
                    style={{
                      backgroundColor: ev.price_cents === 0 ? "rgba(74,222,128,0.12)" : `${vibeColor}15`,
                      color: ev.price_cents === 0 ? "#4ade80" : vibeColor,
                    }}
                  >
                    {ev.price_cents === 0 ? "FREE" : `$${(ev.price_cents / 100).toFixed(0)}`}
                  </span>
                </div>
                {ev.description && <p className="mt-1 font-sans text-[11px] text-white/30">{ev.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">Ask me about upcoming events.</p>
        )}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   RESERVE — Bookable spaces/tables
   ═══════════════════════════════════════════════════ */
export function ReserveCard({ body, venue, vibeColor }: TabCardProps) {
  const [reservables, setReservables] = useState<{ id: string; name: string; description: string | null; price_cents: number; duration_minutes: number | null; capacity: number | null }[]>([]);

  useEffect(() => {
    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => {
        setReservables((d.offerings || []).filter((o: { type: string }) => o.type === "reservation"));
      })
      .catch(() => {});
  }, [venue.id]);

  const spotsLeft = venue.capacity - venue.occupancy;

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className="font-sans text-[14px] font-bold text-white/90">Reserve</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: `${vibeColor}12` }}>
            <span className="font-mono text-[11px] font-bold" style={{ color: vibeColor }}>{spotsLeft}</span>
            <span className="font-sans text-[9px] text-white/30">spots open</span>
          </div>
        </div>

        {reservables.length > 0 ? (
          <div className="flex flex-col gap-2">
            {reservables.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${vibeColor}12` }}>
                  <span className="text-[16px]">🪑</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-semibold text-white/80">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.capacity && <span className="font-sans text-[10px] text-white/25">Seats {r.capacity}</span>}
                    {r.duration_minutes && <span className="font-sans text-[10px] text-white/25">{r.duration_minutes}min</span>}
                  </div>
                </div>
                <span className="font-mono text-[13px] font-bold" style={{ color: vibeColor }}>
                  {r.price_cents === 0 ? "Free" : `$${(r.price_cents / 100).toFixed(0)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">Tell me what you need — a booth, table, or private room.</p>
        )}

        <p className="mt-3 font-sans text-[9px] text-white/15">Say &quot;Book [name] for [time]&quot; to reserve</p>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   SHOP — Merch, community items, packages
   ═══════════════════════════════════════════════════ */
export function ShopCard({ body, venue, vibeColor }: TabCardProps) {
  const [items, setItems] = useState<{ id: string; type: string; name: string; description: string | null; price_cents: number }[]>([]);

  useEffect(() => {
    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => {
        setItems((d.offerings || []).filter((o: { type: string }) =>
          ["product", "package", "custom"].includes(o.type)
        ));
      })
      .catch(() => {});
  }, [venue.id]);

  const typeIcons: Record<string, string> = {
    product: "☕", package: "📦", custom: "✦", service: "✂️",
  };

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Shop</span>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[14px]">{typeIcons[item.type] || "✦"}</span>
                  <span className="truncate font-sans text-[12px] font-semibold text-white/70">{item.name}</span>
                </div>
                {item.description && <p className="truncate font-sans text-[9px] text-white/25 mb-2">{item.description}</p>}
                <span className="mt-auto font-mono text-[13px] font-bold" style={{ color: vibeColor }}>
                  {item.price_cents === 0 ? "Free" : `$${(item.price_cents / 100).toFixed(0)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">Ask me what&apos;s available to buy.</p>
        )}

        <p className="mt-3 font-sans text-[9px] text-white/15">Say &quot;I want [item]&quot; to purchase</p>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   SUBSCRIBE — Push notification toggle
   ═══════════════════════════════════════════════════ */
export function SubscribeCard({ body, venue, vibeColor }: TabCardProps) {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Stay in the loop</span>
        </div>

        <p className="mb-4 font-sans text-[12px] text-white/40">
          Get notified about events, specials, and updates from {venue.name}.
        </p>

        <div className="flex flex-col gap-2">
          {["Events & specials", "Vibe alerts (when it gets busy)", "New menu items", "Member perks"].map((opt) => (
            <div key={opt} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: subscribed ? vibeColor : "rgba(255,255,255,0.1)" }} />
              <span className="flex-1 font-sans text-[12px] text-white/50">{opt}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setSubscribed(!subscribed)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-bold active:scale-[0.97]"
          style={{
            backgroundColor: subscribed ? "rgba(255,255,255,0.06)" : vibeColor,
            color: subscribed ? "rgba(255,255,255,0.5)" : "#000",
            border: subscribed ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}
        >
          {subscribed ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              Subscribed
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
              Subscribe to {venue.name}
            </>
          )}
        </button>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   JOIN — Membership tiers with perks
   ═══════════════════════════════════════════════════ */
interface JoinCardProps extends TabCardProps {
  userId: string | null;
}

export function JoinCard({ body, venue, vibeColor, userId }: JoinCardProps) {
  const [memberships, setMemberships] = useState<{ id: string; name: string; description: string | null; price_cents: number; interval: string | null; perks: string[] }[]>([]);
  const [xp, setXp] = useState(0);
  const [milestones, setMilestones] = useState<{ name: string; threshold: number; color: string; reward: string | null }[]>([]);

  useEffect(() => {
    // Fetch memberships
    fetch(`/api/offerings?venueId=${venue.id}`)
      .then((r) => r.ok ? r.json() : { offerings: [] })
      .then((d) => {
        setMemberships((d.offerings || []).filter((o: { type: string }) => o.type === "membership"));
      })
      .catch(() => {});

    // Fetch XP and milestones
    const params = userId ? `userId=${userId}&venueId=${venue.id}` : `userId=anon&venueId=${venue.id}`;
    fetch(`/api/points?${params}`)
      .then((r) => r.ok ? r.json() : null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((d: any) => {
        if (!d) return;
        setXp(d.venueXp?.xp || 0);
        setMilestones(d.venueMilestones || []);
      })
      .catch(() => {});
  }, [venue.id, userId]);

  const currentMilestone = [...milestones].reverse().find((m) => xp >= m.threshold);
  const nextMilestone = milestones.find((m) => m.threshold > xp);

  return (
    <Card>
      <AiContext body={body} vibeColor={vibeColor} />

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vibeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="font-sans text-[14px] font-bold text-white/90">Join {venue.name}</span>
        </div>

        {/* XP Progress */}
        {milestones.length > 0 && (
          <div className="mb-4 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-[10px] font-semibold" style={{ color: currentMilestone?.color || vibeColor }}>
                {currentMilestone?.name || "New"}
              </span>
              <span className="font-mono text-[11px] text-white/30">{xp} XP</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${nextMilestone ? Math.min((xp / nextMilestone.threshold) * 100, 100) : 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: currentMilestone?.color || vibeColor }}
              />
            </div>
            {nextMilestone && (
              <p className="mt-1 font-sans text-[9px] text-white/20">
                {nextMilestone.threshold - xp} XP to {nextMilestone.name}
                {nextMilestone.reward ? ` — ${nextMilestone.reward}` : ""}
              </p>
            )}

            {/* Milestone dots */}
            <div className="mt-2 flex gap-1">
              {milestones.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: xp >= m.threshold ? `${m.color}15` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${xp >= m.threshold ? `${m.color}25` : "rgba(255,255,255,0.04)"}`,
                    opacity: xp >= m.threshold ? 1 : 0.4,
                  }}
                >
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: xp >= m.threshold ? m.color : "rgba(255,255,255,0.1)" }} />
                  <span className="font-sans text-[8px] font-semibold" style={{ color: xp >= m.threshold ? m.color : "rgba(255,255,255,0.2)" }}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Membership tiers */}
        {memberships.length > 0 ? (
          <div className="flex flex-col gap-2">
            {memberships.map((m) => {
              const price = m.price_cents === 0 ? "Free" : `$${(m.price_cents / 100).toFixed(0)}/${m.interval || "mo"}`;
              return (
                <div key={m.id} className="rounded-xl p-3" style={{ background: `linear-gradient(135deg, ${vibeColor}08 0%, transparent 60%)`, border: `1px solid ${vibeColor}20` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">👑</span>
                      <span className="font-sans text-[14px] font-bold text-white/90">{m.name}</span>
                    </div>
                    <span className="font-mono text-[14px] font-bold" style={{ color: vibeColor }}>{price}</span>
                  </div>
                  {m.description && <p className="mt-1 font-sans text-[11px] text-white/30">{m.description}</p>}
                  {m.perks.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {m.perks.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full" style={{ backgroundColor: vibeColor }} />
                          <span className="font-sans text-[10px] text-white/40">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-sans text-[11px] text-white/20">Ask about membership options.</p>
        )}

        <p className="mt-3 font-sans text-[9px] text-white/15">Say &quot;I want to join&quot; to sign up</p>
      </div>
    </Card>
  );
}
