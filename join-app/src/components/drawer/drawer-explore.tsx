"use client";

import { type RefObject } from "react";
import { motion } from "framer-motion";
import { type Venue, getVibeHexColor } from "@/lib/venues";
import type { Tag } from "../map/the-dock";
import {
  type UserProfile, type Perk, type DrawerSnap,
  TIER_CONFIG, CATEGORY_ICONS, CATEGORY_LABELS, ACCENT, PERK_EMOJI,
  getDistance,
} from "./the-drawer";

interface DrawerExploreProps {
  user: UserProfile;
  venues: Venue[];
  tags: Tag[];
  activeTag: Tag | null;
  onTagSelect: (tag: Tag | null) => void;
  onVenueSelect: (venue: Venue) => void;
  happeningNow: Venue[];
  nearYou: { venue: Venue; dist: number }[];
  quietSpots: Venue[];
  yourSpots: { venue: Venue; xp: number }[];
  recommended: Venue[];
  affordablePerks: Perk[];
  balance: number;
  venueNameMap: Map<string, string>;
  exploreOfferings: { id: string; name: string; type: string; price_cents: number; venue_id: string; description: string | null; image_url: string | null; category: string | null }[];
  exploreDigitalAssets: { id: string; name: string; asset_type: string; category: string; venue_id: string; xp_cost: number | null; cash_price_cents: number | null; is_animated: boolean; description: string | null }[];
  userLocation: { latitude: number; longitude: number } | null;
  tierColor: string;
  onAvatarTap: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  send: (text?: string) => void;
  snap: DrawerSnap;
}

function VenueCard({ venue, onClick, delay, distance, xp }: { venue: Venue; onClick: () => void; delay: number; distance?: number; xp?: number }) {
  const themeColor = venue.themeColor || getVibeHexColor(venue.vibe);
  const catIcon = CATEGORY_ICONS[venue.category] || CATEGORY_ICONS.venue;
  const catLabel = venue.category === "coworking" ? "Cowork" : venue.category;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex shrink-0 overflow-hidden  text-left"
      style={{ width: 180, height: 140, scrollSnapAlign: "start", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex w-full flex-col">
        <div className="relative flex h-[60%] items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}25 0%, ${themeColor}08 60%, rgba(0,0,0,0.4) 100%)` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${themeColor}50`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={catIcon} /></svg>
          {xp !== undefined && xp > 0 && (
            <div className="absolute right-2 top-2 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <span className="font-mono text-[9px] font-bold" style={{ color: themeColor }}>&#9889; {xp}</span>
            </div>
          )}
          {venue.occupancy > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <span className="font-sans text-[9px] font-semibold text-white/50">{venue.occupancy} in</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between px-3 py-2">
          <p className="truncate font-sans text-[16px] font-bold text-white/90">{venue.name}</p>
          <div className="flex items-center gap-1.5">
            <span className=" px-1.5 py-0.5 font-sans text-[10px] font-semibold capitalize text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{catLabel}</span>
            {venue.neighborhood && <span className="truncate font-sans text-[10px] text-white/20">{venue.neighborhood}</span>}
            {distance !== undefined && <span className="ml-auto shrink-0 font-sans text-[10px] font-medium text-white/25">{distance.toFixed(1)} mi</span>}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function Shelf({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-5 pb-2.5">
        <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">{title}</span>
        {count !== undefined && <span className="font-sans text-[12px] text-white/15">{count}</span>}
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
        {children}
      </div>
    </div>
  );
}

export function DrawerExplore({
  user, venues, tags, activeTag, onTagSelect, onVenueSelect,
  happeningNow, nearYou, quietSpots, yourSpots, recommended,
  affordablePerks, balance, venueNameMap,
  exploreOfferings, exploreDigitalAssets,
  tierColor, onAvatarTap, scrollRef, send, snap,
}: DrawerExploreProps) {
  return (
    <>
      {/* Profile strip */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <button onClick={onAvatarTap} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`, border: `2px solid ${tierColor}40` }}>
          <span className="font-sans text-[20px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
        </button>
        <div className="flex flex-1 flex-col">
          <span className="font-sans text-[20px] font-bold text-white/90">Discover</span>
        </div>
        {user.streak > 0 && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1" style={{ backgroundColor: "rgba(249,115,22,0.08)" }}>
            <span className="text-[12px]">&#x1f525;</span>
            <span className="font-mono text-[12px] font-bold text-orange">{user.streak}</span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
              {activeTag && (
                <button onClick={() => onTagSelect(null)} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[16px] font-medium active:scale-95" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", minHeight: 44 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  All
                </button>
              )}
              {tags.map((tag) => {
                const isActive = activeTag?.id === tag.id;
                return (
                  <button key={tag.id} onClick={() => onTagSelect(isActive ? null : tag)} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[16px] font-medium active:scale-95" style={{ backgroundColor: isActive ? `${tag.color}20` : "rgba(255,255,255,0.04)", color: isActive ? tag.color : "rgba(255,255,255,0.45)", border: `1px solid ${isActive ? `${tag.color}40` : "rgba(255,255,255,0.06)"}`, minHeight: 44 }}>
                    {(tag.type === "venue" || tag.type === "vibe") && <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />}
                    {tag.label}
                    {tag.venueIds.length > 1 && <span style={{ opacity: 0.5 }}>{tag.venueIds.length}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* All Places */}
        <Shelf title="PLACES" count={venues.length}>
          {venues.slice(0, 20).map((v, i) => <VenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.03, 0.15)} xp={yourSpots.find((s) => s.venue.id === v.id)?.xp} />)}
        </Shelf>

        {/* Offerings by category */}
        {exploreOfferings.length > 0 && (() => {
          const OFFER_CATEGORIES: { key: string; label: string; types: string[]; icon: string }[] = [
            { key: "food", label: "FOOD & DRINKS", types: ["product"], icon: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3" },
            { key: "events", label: "EVENTS", types: ["event"], icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
            { key: "services", label: "SERVICES", types: ["service"], icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2M12 8v4l3 3" },
            { key: "reserve", label: "RESERVATIONS", types: ["reservation"], icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
            { key: "membership", label: "MEMBERSHIPS", types: ["membership"], icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
            { key: "shop", label: "SHOP", types: ["package", "custom"], icon: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" },
          ];
          return OFFER_CATEGORIES.map(({ key, label, types, icon }) => {
            const items = exploreOfferings.filter((o) => types.includes(o.type));
            if (items.length === 0) return null;
            return (
              <div key={key} className="mb-5">
                <div className="flex items-center justify-between px-5 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                    <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">{label}</span>
                  </div>
                  <span className="font-sans text-[12px] text-white/15">{items.length}</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
                  {items.map((item, i) => {
                    const venue = venues.find((v) => v.id === item.venue_id);
                    const color = venue?.themeColor || getVibeHexColor(venue?.vibe || "quiet");
                    return (
                      <motion.button key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.15) }} onClick={() => { if (venue) onVenueSelect(venue); }} className="flex shrink-0 flex-col overflow-hidden  text-left active:scale-[0.97]" style={{ width: 180, scrollSnapAlign: "start", backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${color}15` }}>
                        <div className="relative h-20 w-full" style={{ background: item.image_url ? undefined : `linear-gradient(135deg, ${color}20 0%, ${color}06 100%)` }}>
                          {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={`${color}40`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                            </div>
                          )}
                          <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                            <span className="font-mono text-[12px] font-bold" style={{ color }}>${(item.price_cents / 100).toFixed(item.price_cents % 100 === 0 ? 0 : 2)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 px-2.5 py-2">
                          <span className="truncate font-sans text-[14px] font-semibold text-white/80">{item.name}</span>
                          {item.description && <span className="line-clamp-1 font-sans text-[10px] leading-[1.3] text-white/30">{item.description}</span>}
                          <span className="mt-0.5 truncate font-sans text-[10px] font-medium text-white/20">{venue?.name || "Venue"}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}

        {/* Venue shelves */}
        {recommended.length > 0 && (
          <Shelf title="RECOMMENDED" count={recommended.length}>
            {recommended.map((v, i) => <VenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.04, 0.2)} />)}
          </Shelf>
        )}
        {yourSpots.length > 0 && (
          <Shelf title="YOUR SPOTS">
            {yourSpots.map(({ venue, xp }, i) => <VenueCard key={venue.id} venue={venue} onClick={() => onVenueSelect(venue)} delay={Math.min(i * 0.04, 0.2)} xp={xp} />)}
          </Shelf>
        )}
        {happeningNow.length > 0 && (
          <Shelf title="HAPPENING NOW" count={happeningNow.length}>
            {happeningNow.map((v, i) => <VenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.04, 0.2)} xp={user?.venueProfiles.find((vp) => vp.venue_id === v.id)?.xp} />)}
          </Shelf>
        )}
        {nearYou.length > 0 && (
          <Shelf title="NEAR YOU">
            {nearYou.map(({ venue, dist }, i) => <VenueCard key={venue.id} venue={venue} onClick={() => onVenueSelect(venue)} delay={Math.min(i * 0.04, 0.2)} distance={dist} />)}
          </Shelf>
        )}
        {quietSpots.length > 0 && (
          <Shelf title="GOOD FOR FOCUS">
            {quietSpots.map((v, i) => <VenueCard key={v.id} venue={v} onClick={() => onVenueSelect(v)} delay={Math.min(i * 0.04, 0.2)} />)}
          </Shelf>
        )}

        {/* Perks */}
        {affordablePerks.length > 0 && (
          <Shelf title="PERKS YOU CAN CLAIM" count={affordablePerks.length}>
            {affordablePerks.map((perk, i) => {
              const emoji = PERK_EMOJI[perk.category] || "\ud83c\udfaf";
              const canAfford = balance >= perk.point_cost;
              return (
                <motion.button key={perk.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: canAfford ? 1 : 0.4, scale: 1 }} transition={{ type: "spring", damping: 25, stiffness: 300, delay: Math.min(i * 0.04, 0.2) }} whileTap={{ scale: 0.93 }} onClick={() => {
                  const v = venues.find((v) => v.id === perk.venue_id);
                  if (v) { onVenueSelect(v); setTimeout(() => send(`Tell me about the ${perk.name} perk`), 300); }
                }} className="flex shrink-0 flex-col items-center" style={{ width: 80, scrollSnapAlign: "start" }}>
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ background: canAfford ? "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))" : "rgba(255,255,255,0.04)", border: `2px solid ${canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                    <span className="text-[28px]">{emoji}</span>
                  </div>
                  <p className="mt-1.5 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueNameMap.get(perk.venue_id) || "Venue"}</p>
                  <div className="mt-0.5 rounded-full px-2 py-0.5" style={{ backgroundColor: canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${canAfford ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                    <span className={`font-mono text-[9px] font-bold ${canAfford ? "text-orange" : "text-white/25"}`}>{perk.point_cost} pts</span>
                  </div>
                </motion.button>
              );
            })}
          </Shelf>
        )}

        <div className="h-4" />
      </div>
    </>
  );
}
