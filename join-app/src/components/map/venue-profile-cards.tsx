"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { type Venue, getVibeHexColor, getVibeLabel, getOccupancyPercent } from "@/lib/venues";

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

interface VenueProfileCardsProps {
  venue: Venue;
}

const TYPE_ICONS: Record<string, string> = {
  membership: "👑", reservation: "🪑", service: "✂️", product: "☕",
  event: "🎟️", package: "📦", custom: "✦",
};

export function VenueProfileCards({ venue }: VenueProfileCardsProps) {
  const [page, setPage] = useState<VenuePageData | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const vibeColor = venue.themeColor || getVibeHexColor(venue.vibe);
  const pct = getOccupancyPercent(venue);

  useEffect(() => {
    // Fetch venue page data, gallery, and offerings
    Promise.all([
      fetch(`/api/venue-page?venueId=${venue.id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/offerings?venueId=${venue.id}`).then((r) => r.ok ? r.json() : { offerings: [] }),
    ]).then(([pageData, offerData]) => {
      if (pageData) {
        setPage(pageData.page || null);
        setGallery(pageData.gallery || []);
      }
      setOfferings(offerData.offerings || []);
    }).catch(() => {});
  }, [venue.id]);

  // Don't render until we have data
  if (!page && offerings.length === 0) return null;

  const theme = page?.theme_color || vibeColor;

  return (
    <div className="flex flex-col gap-2 pb-2">
      {/* ── Hero Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl"
        style={{ border: `1px solid ${theme}20` }}
      >
        {/* Gradient hero */}
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
              <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getVibeHexColor(venue.vibe) }} />
                <span className="font-sans text-[9px] font-semibold" style={{ color: getVibeHexColor(venue.vibe) }}>{getVibeLabel(venue.vibe)}</span>
              </div>
              <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-white/50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                {venue.occupancy}/{venue.capacity}
              </span>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-white leading-tight">{venue.name}</h2>
            {page?.tagline && <p className="mt-0.5 font-sans text-[11px] text-white/50">{page.tagline}</p>}
            {venue.neighborhood && (
              <p className="mt-0.5 font-sans text-[10px] text-white/25">{venue.neighborhood}{venue.address ? ` · ${venue.address}` : ""}</p>
            )}
          </div>
        </div>

        {/* Capacity bar */}
        <div className="px-4 py-2" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans text-[8px] font-semibold tracking-[1px] text-white/20">CAPACITY</span>
            <span className="font-mono text-[9px] text-white/30">{pct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: vibeColor }} />
          </div>
        </div>
      </motion.div>

      {/* ── Hours Card ── */}
      {page?.hours && page.hours.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="mb-1.5 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">HOURS</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {page.hours.map((h) => (
              <div key={h.day} className="flex gap-2">
                <span className="font-sans text-[10px] text-white/30">{h.day}</span>
                <span className="font-sans text-[10px] text-white/50">{h.open}{h.close ? `–${h.close}` : ""}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Gallery Card ── */}
      {gallery.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-1.5 overflow-x-auto rounded-2xl no-scrollbar"
        >
          {gallery.slice(0, 4).map((img) => (
            <div key={img.id} className="h-20 w-28 shrink-0 overflow-hidden rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <img src={img.image_url} alt={img.caption || ""} className="h-full w-full object-cover" />
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Offerings Card ── */}
      {offerings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">AVAILABLE</p>
          <div className="flex flex-col gap-1">
            {offerings.slice(0, 5).map((o) => {
              const price = o.price_cents === 0 ? "Free" : `$${(o.price_cents / 100).toFixed(0)}${o.recurring ? `/${o.interval || "mo"}` : ""}`;
              return (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="text-[11px]">{TYPE_ICONS[o.type] || "✦"}</span>
                  <span className="flex-1 truncate font-sans text-[11px] text-white/50">{o.name}</span>
                  <span className="font-mono text-[10px] font-semibold" style={{ color: theme }}>{price}</span>
                </div>
              );
            })}
            {offerings.length > 5 && (
              <span className="font-sans text-[9px] text-white/15">+{offerings.length - 5} more</span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Menu Card ── */}
      {page?.menu_sections && page.menu_sections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="mb-2 font-sans text-[8px] font-semibold tracking-[1px] text-white/20">MENU</p>
          {page.menu_sections.slice(0, 2).map((section) => (
            <div key={section.name} className="mb-2 last:mb-0">
              <p className="mb-1 font-sans text-[10px] font-medium text-white/35">{section.name}</p>
              <div className="flex flex-wrap gap-1">
                {section.items.slice(0, 6).map((item) => (
                  <span key={item} className="rounded-md px-2 py-0.5 font-sans text-[9px] text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
