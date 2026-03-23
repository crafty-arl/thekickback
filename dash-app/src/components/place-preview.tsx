"use client";

import { motion, AnimatePresence } from "framer-motion";

export interface PlaceData {
  name: string;
  type: string;
  address: string;
  tagline: string;
  description: string;
  themeColor: string;
  hours: string;
  capacity: number;
  slug: string;
}

export function PlacePreview({ data }: { data: PlaceData }) {
  const themeColor = data.themeColor || "#F97316";

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="relative w-[375px] overflow-hidden rounded-[40px] border-[3px]"
        style={{
          height: 720,
          borderColor: "rgba(255,255,255,0.1)",
          backgroundColor: "#0A0A0A",
        }}
      >
        {/* Phone notch */}
        <div
          className="absolute left-1/2 top-0 z-10 h-7 w-32 -translate-x-1/2 rounded-b-2xl"
          style={{ backgroundColor: "#0A0A0A" }}
        />

        {/* Content */}
        <div className="h-full overflow-y-auto pt-10 no-scrollbar">
          {/* Hero area */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`hero-${data.name}-${data.type}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative flex h-48 items-end p-5"
              style={{
                background: `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}08 50%, rgba(0,0,0,0.8) 100%)`,
              }}
            >
              <div>
                <h2 className="font-sans text-[22px] font-bold text-white">
                  {data.name || "Your Place"}
                </h2>
                {data.tagline && (
                  <motion.p
                    key={`tagline-${data.tagline}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 font-sans text-[13px] italic text-white/40"
                  >
                    &ldquo;{data.tagline}&rdquo;
                  </motion.p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {data.type && (
                    <span
                      className="rounded-md px-2 py-0.5 font-sans text-[10px] font-medium capitalize text-white/40"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {data.type}
                    </span>
                  )}
                  {data.address && (
                    <span className="font-sans text-[10px] text-white/25">
                      {data.address}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Vibe bar */}
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 0 6px ${themeColor}`,
              }}
            />
            <span
              className="font-sans text-[11px] font-semibold"
              style={{ color: themeColor }}
            >
              Quiet
            </span>
            <span className="font-sans text-[10px] text-white/20">
              0/{data.capacity} capacity
            </span>
          </div>

          {/* Description */}
          {data.description && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-5 py-4"
            >
              <p className="font-sans text-[13px] leading-relaxed text-white/50">
                {data.description}
              </p>
            </motion.div>
          )}

          {/* Hours */}
          {data.hours && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-5 rounded-xl p-3"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="font-sans text-[10px] font-semibold tracking-wide text-white/25">
                HOURS
              </p>
              <p className="mt-1 font-sans text-[12px] text-white/50">
                {data.hours}
              </p>
            </motion.div>
          )}

          {/* Placeholder offerings */}
          <div className="px-5 py-4">
            <p className="mb-3 font-sans text-[10px] font-semibold tracking-[2px] text-white/20">
              WHAT WE OFFER
            </p>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="mb-2 rounded-xl p-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="h-3 w-24 rounded"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                />
                <div
                  className="mt-2 h-2 w-16 rounded"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                />
              </div>
            ))}
            <p className="mt-2 text-center font-sans text-[10px] text-white/15">
              Offerings auto-generated after setup
            </p>
          </div>

          {/* Chat preview dock */}
          <div
            className="mx-5 mb-5 rounded-2xl p-3"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${themeColor}20` }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={themeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-sans text-[12px] text-white/50">
                  Ask about {data.name || "this place"}...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* URL bar at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center py-2"
          style={{
            backgroundColor: "rgba(10,10,10,0.95)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span className="font-mono text-[10px] text-white/20">
            join.thekickback.net/{data.slug || "your-place"}
          </span>
        </div>
      </div>
    </div>
  );
}
