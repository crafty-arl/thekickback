"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";

interface VenuePageData {
  tagline: string | null;
  description: string | null;
  theme_color: string;
  hero_image: string | null;
  hours: { day: string; open: string; close: string }[];
  menu_sections: { name: string; items: string[] }[];
}

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
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

interface DigitalAssetData {
  id: string;
  name: string;
  asset_type: string;
  category: string;
  description: string | null;
  preview_url: string | null;
  xp_cost: number | null;
  wallet_price_cents: number | null;
  cash_price_cents: number | null;
  is_animated: boolean;
  min_tier: string | null;
  duration_hours: number | null;
}

interface VenueProfileCardsProps {
  venue: Venue;
  onAction?: (command: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  membership: "\u{1F451}", reservation: "\u{1FA91}", service: "\u2702\uFE0F", product: "\u2615",
  event: "\u{1F39F}\uFE0F", package: "\u{1F4E6}", custom: "\u2726",
};

const TYPE_LABELS: Record<string, string> = {
  membership: "Memberships", reservation: "Reservations", service: "Services",
  product: "Products", event: "Events", package: "Packages", custom: "More",
};

const ASSET_EMOJI: Record<string, string> = {
  sticker: "\u{1F3F7}\uFE0F",
  badge: "\u{1F3C5}",
  "3d_pin": "\u{1F4CC}",
};

const ASSET_COLORS: Record<string, { bg: string; fg: string }> = {
  sticker: { bg: "rgba(74,222,128,0.15)", fg: "#4ADE80" },
  badge: { bg: "rgba(249,115,22,0.15)", fg: "#F97316" },
  "3d_pin": { bg: "rgba(168,139,250,0.15)", fg: "#A78BFA" },
};

export function VenueProfileCards({ venue, onAction }: VenueProfileCardsProps) {
  const [page, setPage] = useState<VenuePageData | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const [digitalAssets, setDigitalAssets] = useState<DigitalAssetData[]>([]);
  const vibeColor = venue.themeColor || "#F97316";

  useEffect(() => {
    Promise.all([
      fetch(`/api/venue-page?venueId=${venue.id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/offerings?venueId=${venue.id}`).then((r) => r.ok ? r.json() : { offerings: [] }),
      fetch(`/api/digital-assets?venueId=${venue.id}`).then((r) => r.ok ? r.json() : { assets: [] }),
    ]).then(([pageData, offerData, assetData]) => {
      if (pageData) {
        setPage(pageData.page || null);
        setGallery(pageData.gallery || []);
      }
      setOfferings(offerData.offerings || []);
      setDigitalAssets(assetData.assets || []);
    }).catch(() => { });
  }, [venue.id]);

  if (!page && offerings.length === 0 && digitalAssets.length === 0) return null;

  const theme = page?.theme_color || vibeColor;

  // Group offerings by type, memberships first
  const memberships = offerings.filter((o) => o.type === "membership");
  const otherOfferings = offerings.filter((o) => o.type !== "membership");
  const typeGroups = otherOfferings.reduce<Record<string, OfferingData[]>>((acc, o) => {
    (acc[o.type] ||= []).push(o);
    return acc;
  }, {});

  const handleOfferingTap = (o: OfferingData) => {
    if (!onAction) return;
    if (o.type === "membership") {
      onAction(`I want to join the ${o.name} membership`);
    } else if (o.type === "reservation") {
      onAction(`I'd like to book ${o.name}`);
    } else if (o.type === "event") {
      onAction(`Tell me about the ${o.name} event`);
    } else if (o.type === "service") {
      onAction(`I'd like to book ${o.name}`);
    } else {
      onAction(`I want ${o.name}`);
    }
  };

  const formatPrice = (o: OfferingData) => {
    if (o.price_cents === 0) return "Free";
    const base = `$${(o.price_cents / 100).toFixed(0)}`;
    return o.recurring ? `${base}/${o.interval || "mo"}` : base;
  };

  return (
    <div className="flex flex-col gap-2 pb-2">
      {/* ── Hero Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden "
        style={{ border: `1px solid ${theme}20` }}
      >
        <div
          className="relative flex items-end px-4 pb-3 pt-10"
          style={{
            background: page?.hero_image
              ? `url(${page.hero_image}) center/cover`
              : `linear-gradient(135deg, ${theme}25 0%, ${theme}08 50%, rgba(0,0,0,0.4) 100%)`,
          }}
        >
          {page?.hero_image && (
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.8) 100%)" }} />
          )}
          <div className="relative z-10 w-full">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: theme }}>
                <div className="h-1 w-1 rounded-full bg-black animate-pulse" />
                <span className="font-sans text-[8px] font-bold tracking-[1px] text-black">LIVE</span>
              </div>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-white leading-tight">{venue.name}</h2>
            {page?.tagline && <p className="mt-0.5 font-sans text-[11px] text-white/50">{page.tagline}</p>}
            {venue.neighborhood && (
              <p className="mt-0.5 font-sans text-[10px] text-white/25">{venue.neighborhood}{venue.address ? ` \u00b7 ${venue.address}` : ""}</p>
            )}
          </div>
        </div>

      </motion.div>

      {/* ── Membership Cards (featured) ── */}
      {memberships.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col gap-1.5"
        >
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => handleOfferingTap(m)}
              className="w-full overflow-hidden  text-left transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${theme}12 0%, ${theme}04 100%)`,
                border: `1px solid ${theme}25`,
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center " style={{ backgroundColor: `${theme}15` }}>
                  <span className="text-[18px]">{"\u{1F451}"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-[13px] font-bold text-white/90">{m.name}</span>
                    <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ backgroundColor: `${theme}20`, color: theme }}>
                      {formatPrice(m)}
                    </span>
                  </div>
                  {m.description && <p className="mt-0.5 line-clamp-1 font-sans text-[10px] text-white/35">{m.description}</p>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </motion.div>
      )}

      {/* ── Quick Actions Strip (other offerings) ── */}
      {Object.keys(typeGroups).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {Object.entries(typeGroups).map(([type, items]) => (
            <button
              key={type}
              onClick={() => {
                if (items.length === 1) {
                  handleOfferingTap(items[0]);
                } else if (onAction) {
                  const cmds: Record<string, string> = {
                    event: "any events tonight?",
                    reservation: "I'd like to reserve a spot",
                    service: "what services do you offer?",
                    product: "what can I order?",
                    package: "show me your packages",
                  };
                  onAction(cmds[type] || `show me ${type} options`);
                }
              }}
              className="flex shrink-0 items-center gap-2  px-3 py-2.5 transition-all active:scale-[0.96]"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-[13px]">{TYPE_ICONS[type] || "\u2726"}</span>
              <div className="flex flex-col items-start">
                <span className="font-sans text-[11px] font-semibold text-white/60">{TYPE_LABELS[type] || type}</span>
                <span className="font-mono text-[9px] text-white/25">{items.length} available</span>
              </div>
            </button>
          ))}
        </motion.div>
      )}

      {/* ── Digital Collectibles ── */}
      {digitalAssets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[11px]">{"\u{1F3A8}"}</span>
            <span className="font-sans text-[10px] font-semibold tracking-[1px] text-white/30">COLLECTIBLES</span>
            <span className="font-mono text-[9px] text-white/15">{digitalAssets.length}</span>
          </div>
          <div
            className="flex gap-1.5 overflow-x-auto no-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {digitalAssets.map((asset) => {
              const colors = ASSET_COLORS[asset.asset_type] || { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.5)" };
              const priceLabel = asset.xp_cost
                ? `${asset.xp_cost} XP`
                : asset.cash_price_cents
                  ? `$${(asset.cash_price_cents / 100).toFixed(2)}`
                  : "Free";
              return (
                <button
                  key={asset.id}
                  onClick={() => onAction?.(`I want the ${asset.name} ${asset.asset_type}`)}
                  className="flex shrink-0 flex-col items-center gap-1  px-3 py-2.5 transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: `1px solid ${colors.fg}20`,
                    width: 90,
                  }}
                >
                  <span className="text-[20px]">{ASSET_EMOJI[asset.asset_type] || "\u2726"}</span>
                  <span className="w-full truncate text-center font-sans text-[10px] font-semibold text-white/70">
                    {asset.name}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-bold tracking-wide"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {asset.asset_type === "3d_pin" ? "3D" : asset.asset_type.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] font-bold" style={{ color: colors.fg }}>
                    {priceLabel}
                  </span>
                  {asset.is_animated && (
                    <span className="font-sans text-[7px] text-white/20">{"\u2728"} animated</span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Gallery Strip (compact) ── */}
      {gallery.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-1.5 overflow-x-auto  no-scrollbar"
        >
          {gallery.slice(0, 4).map((img) => (
            <div key={img.id} className="h-20 w-28 shrink-0 overflow-hidden " style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <img src={img.image_url} alt={img.caption || ""} className="h-full w-full object-cover" />
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
