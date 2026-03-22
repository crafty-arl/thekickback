"use client";

import { motion } from "framer-motion";

interface Props {
  page: {
    description: string | null;
    menu_sections: { name: string; items: string[] }[];
    hours: { day: string; open: string; close: string }[];
    theme_color: string;
  };
  venue: {
    rules: string[];
    address?: string;
    neighborhood?: string;
  };
}

export function VenueInfo({ page, venue }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Address */}
      {venue.address && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <h2 className="mb-3 font-sans text-[11px] font-medium tracking-[2px] text-white/30">
            LOCATION
          </h2>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3  border border-white/[0.06] bg-white/[0.02] p-4 active:opacity-80"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center " style={{ backgroundColor: `${page.theme_color}25` }}>
              <span className="text-[16px]">📍</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[13px] font-medium text-white/70">{venue.address}</p>
              {venue.neighborhood && (
                <p className="font-sans text-[11px] text-white/30">{venue.neighborhood}</p>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </motion.div>
      )}

      {/* Description */}
      {page.description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="font-sans text-sm leading-relaxed text-white/40"
        >
          {page.description}
        </motion.p>
      )}

      {/* Menu */}
      {page.menu_sections.length > 0 && (
        <motion.div
          id="menu"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h2 className="mb-3 font-sans text-[11px] font-medium tracking-[2px] text-white/30">
            MENU
          </h2>
          <div className="flex flex-col gap-4">
            {page.menu_sections.map((section) => (
              <div
                key={section.name}
                className=" border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <h3 className="mb-2 font-sans text-sm font-semibold text-white/70">
                  {section.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span
                      key={item}
                      className=" border border-white/[0.06] px-3 py-1.5 font-sans text-xs text-white/50"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Hours */}
      {page.hours.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2 className="mb-3 font-sans text-[11px] font-medium tracking-[2px] text-white/30">
            HOURS
          </h2>
          <div className=" border border-white/[0.06] bg-white/[0.02] p-4">
            {page.hours.map((h) => (
              <div key={h.day} className="flex justify-between py-1.5">
                <span className="font-sans text-sm text-white/50">{h.day}</span>
                <span className="font-sans text-sm text-white/70">
                  {h.open} — {h.close}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Rules */}
      {venue.rules && venue.rules.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <h2 className="mb-3 font-sans text-[11px] font-medium tracking-[2px] text-white/30">
            HOUSE RULES
          </h2>
          <div className="flex flex-col gap-2">
            {venue.rules.map((rule: string) => (
              <div
                key={rule}
                className="flex items-center gap-3  px-1 py-1"
              >
                <div
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: page.theme_color }}
                />
                <span className="font-sans text-sm text-white/50">{rule}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
